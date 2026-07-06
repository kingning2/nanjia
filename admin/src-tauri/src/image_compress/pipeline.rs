//! 自适应流水线：扫描 → IO 读取 → CPU 解码压缩（Rayon）→ IO 写入

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crossbeam_channel::{bounded, Receiver, Sender};
use rayon::ThreadPoolBuilder;
use tracing::{error, info, warn};
use walkdir::WalkDir;

use super::codec::compress_bytes_to_webp;
use super::config::EngineConfig;
use super::hardware::{detect_hardware, HardwareProfile};
use super::progress::{ProgressHook, ProgressSnapshot, ProgressTracker};
use super::types::{
    BatchResult, CompressFailure, CompressJob, CompressedItem, DirectoryBatchOptions,
    InMemoryBatchResult, InMemoryItem, InMemoryResult, LoadedJob, is_image_path,
};

/// 日志间隔（避免刷屏）
const PROGRESS_LOG_INTERVAL: Duration = Duration::from_secs(2);
/// UI 事件推送间隔（比日志更频繁，保证进度条可见）
const PROGRESS_HOOK_INTERVAL: Duration = Duration::from_millis(250);

/// 运行目录批量压缩
pub fn run_directory(
    opts: DirectoryBatchOptions,
    on_progress: Option<ProgressHook>,
) -> Result<BatchResult, String> {
    let hw = detect_hardware();
    let config = EngineConfig::from_hardware(&hw);
    log_engine_startup(&hw, &config);

    if !opts.input_dir.is_dir() {
        return Err(format!("输入目录不存在: {}", opts.input_dir.display()));
    }
    fs::create_dir_all(&opts.output_dir)
        .map_err(|err| format!("创建输出目录失败: {}", err))?;

    let progress = Arc::new(ProgressTracker::new());
    let failures: Arc<std::sync::Mutex<Vec<CompressFailure>>> =
        Arc::new(std::sync::Mutex::new(Vec::new()));

    let (path_tx, path_rx) = bounded::<CompressJob>(config.channel_scan);
    let (loaded_tx, loaded_rx) = bounded::<LoadedJob>(config.channel_pipeline);
    let (done_tx, done_rx) = bounded::<CompressedItem>(config.channel_write);

    let output_dir = opts.output_dir.clone();
    let output_ext = opts.output_ext.clone();
    let recursive = opts.recursive;
    let input_dir = opts.input_dir.clone();
    let progress_scan = Arc::clone(&progress);

    // ── 阶段 1：扫描（独立线程，WalkDir 流式发送，不 collect 全量路径）──
    let scanner = thread::Builder::new()
        .name("img-scan".into())
        .spawn(move || scan_directory(&input_dir, &output_dir, &output_ext, recursive, path_tx, progress_scan))
        .map_err(|err| format!("启动扫描线程失败: {err}"))?;

    // ── 阶段 2：IO 读取（独立线程，不占用 CPU 压缩池）──
    let mut readers = Vec::with_capacity(config.io_readers);
    for i in 0..config.io_readers {
        let path_rx = path_rx.clone();
        let loaded_tx = loaded_tx.clone();
        let handle = thread::Builder::new()
            .name(format!("img-read-{i}"))
            .spawn(move || reader_loop(path_rx, loaded_tx))
            .map_err(|err| format!("启动读取线程失败: {err}"))?;
        readers.push(handle);
    }
    drop(path_rx);
    drop(loaded_tx);

    // ── 阶段 3：解码 + 压缩（Rayon scope，每张图处理完即释放）──
    let pool = ThreadPoolBuilder::new()
        .num_threads(config.rayon_threads)
        .thread_name(|i| format!("img-compress-{i}"))
        .build()
        .map_err(|err| format!("创建 Rayon 线程池失败: {err}"))?;

    let progress_compress = Arc::clone(&progress);
    let failures_compress = Arc::clone(&failures);
    let worker_count = config.rayon_threads;
    let loaded_rx_workers = loaded_rx.clone();
    let done_tx_workers = done_tx.clone();
    let compress_handle = thread::Builder::new()
        .name("img-compress-coord".into())
        .spawn(move || {
            pool.install(|| {
                rayon::scope(|scope| {
                    for _ in 0..worker_count {
                        let loaded_rx = loaded_rx_workers.clone();
                        let done_tx = done_tx_workers.clone();
                        let progress = Arc::clone(&progress_compress);
                        let failures = Arc::clone(&failures_compress);
                        scope.spawn(move |_| {
                            compress_worker_loop(loaded_rx, done_tx, progress, failures);
                        });
                    }
                });
            });
        })
        .map_err(|err| format!("启动压缩协调线程失败: {err}"))?;
    drop(loaded_rx);
    drop(done_tx);

    // ── 阶段 4：IO 写入（独立线程，不阻塞压缩）──
    let progress_write = Arc::clone(&progress);
    let writer = thread::Builder::new()
        .name("img-write".into())
        .spawn(move || writer_loop(done_rx, progress_write))
        .map_err(|err| format!("启动写入线程失败: {err}"))?;

    // ── 进度日志（独立线程，原子读快照）──
    let progress_log = Arc::clone(&progress);
    let pipeline_done = Arc::new(AtomicBool::new(false));
    let pipeline_done_log = Arc::clone(&pipeline_done);
    let log_thread = thread::Builder::new()
        .name("img-progress".into())
        .spawn(move || progress_watch_loop(progress_log, pipeline_done_log, on_progress))
        .map_err(|err| format!("启动进度线程失败: {err}"))?;

    // 等待流水线结束
    if let Err(err) = scanner.join() {
        warn!("扫描线程异常结束: {err:?}");
    }
    for handle in readers {
        if let Err(err) = handle.join() {
            warn!("读取线程异常结束: {err:?}");
        }
    }
    if let Err(err) = compress_handle.join() {
        warn!("压缩线程异常结束: {err:?}");
    }
    if let Err(err) = writer.join() {
        warn!("写入线程异常结束: {err:?}");
    }
    pipeline_done.store(true, Ordering::Relaxed);
    let _ = log_thread.join();

    let snapshot = progress.snapshot();
    let failure_list = failures
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_default();

    log_final_summary(&snapshot, &config);

    Ok(BatchResult {
        total: snapshot.total,
        succeeded: snapshot.succeeded,
        failed: snapshot.failed,
        bytes_in: snapshot.bytes_in,
        bytes_out: snapshot.bytes_out,
        elapsed_ms: snapshot.elapsed_ms,
        failures: failure_list,
    })
}

/// 内存批量压缩（Rayon par_iter，适合 Tauri 多文件字节流）
pub fn run_in_memory(
    items: Vec<InMemoryItem>,
    on_progress: Option<ProgressHook>,
) -> Result<InMemoryBatchResult, String> {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
    use rayon::prelude::*;

    if items.is_empty() {
        return Ok(InMemoryBatchResult {
            items: Vec::new(),
            total: 0,
            succeeded: 0,
            failed: 0,
            bytes_in: 0,
            bytes_out: 0,
            elapsed_ms: 0,
            failures: Vec::new(),
        });
    }

    let hw = detect_hardware();
    let config = EngineConfig::from_hardware(&hw);
    log_engine_startup(&hw, &config);

    let progress = Arc::new(ProgressTracker::new());
    progress.set_total(items.len() as u64);

    if let Some(ref hook) = on_progress {
        hook(progress.snapshot());
    }

    let pool = ThreadPoolBuilder::new()
        .num_threads(config.rayon_threads)
        .thread_name(|i| format!("img-batch-{i}"))
        .build()
        .map_err(|err| format!("创建 Rayon 线程池失败: {err}"))?;

    let pipeline_done = Arc::new(AtomicBool::new(false));
    let progress_log = Arc::clone(&progress);
    let pipeline_done_log = Arc::clone(&pipeline_done);
    let log_handle = thread::spawn(move || {
        progress_watch_loop(progress_log, pipeline_done_log, on_progress);
    });

    let progress_work = Arc::clone(&progress);
    let failures: Arc<std::sync::Mutex<Vec<CompressFailure>>> =
        Arc::new(std::sync::Mutex::new(Vec::new()));
    let failures_work = Arc::clone(&failures);

    let results: Vec<Result<InMemoryResult, (String, String)>> = pool.install(|| {
        items
            .into_par_iter()
            .map(|item| {
                let original_size = item.bytes.len();
                match compress_bytes_to_webp(&item.bytes) {
                    Ok(output) => {
                        progress_work.record_success(original_size as u64, output.bytes.len() as u64);
                        Ok(InMemoryResult {
                            label: item.label,
                            original_width: output.original_width,
                            original_height: output.original_height,
                            original_size,
                            output_width: output.output_width,
                            output_height: output.output_height,
                            output_size: output.bytes.len(),
                            webp_base64: BASE64.encode(&output.bytes),
                        })
                    }
                    Err(reason) => {
                        progress_work.record_failure();
                        error!(label = %item.label, error = %reason, "内存批量压缩失败");
                        Err((item.label, reason))
                    }
                }
            })
            .collect()
    });

    pipeline_done.store(true, Ordering::Relaxed);
    let _ = log_handle.join();
    let snapshot = progress.snapshot();
    log_final_summary(&snapshot, &config);

    let mut ok = Vec::new();
    for result in results {
        match result {
            Ok(item) => ok.push(item),
            Err((label, reason)) => {
                warn!(label = %label, error = %reason, "跳过损坏图片");
                if let Ok(mut guard) = failures_work.lock() {
                    guard.push(CompressFailure {
                        path: label,
                        reason,
                    });
                }
            }
        }
    }

    let failure_list = failures
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_default();

    Ok(InMemoryBatchResult {
        items: ok,
        total: snapshot.total,
        succeeded: snapshot.succeeded,
        failed: snapshot.failed,
        bytes_in: snapshot.bytes_in,
        bytes_out: snapshot.bytes_out,
        elapsed_ms: snapshot.elapsed_ms,
        failures: failure_list,
    })
}

// ── 流水线各阶段 ─────────────────────────────────────────────

fn scan_directory(
    input_dir: &Path,
    output_dir: &Path,
    output_ext: &str,
    recursive: bool,
    path_tx: Sender<CompressJob>,
    progress: Arc<ProgressTracker>,
) {
    let walker = if recursive {
        WalkDir::new(input_dir)
    } else {
        WalkDir::new(input_dir).max_depth(1)
    };

    let mut id: u64 = 0;
    for entry in walker.into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() || !is_image_path(path) {
            continue;
        }

        let Some(output_path) = map_output_path(input_dir, output_dir, path, output_ext) else {
            warn!(path = %path.display(), "无法映射输出路径，跳过");
            continue;
        };

        if let Err(err) = fs::create_dir_all(
            output_path
                .parent()
                .unwrap_or_else(|| Path::new(".")),
        ) {
            warn!(path = %output_path.display(), error = %err, "创建输出子目录失败");
            continue;
        }

        progress.record_discovered();
        let job = CompressJob {
            id,
            input_path: path.to_path_buf(),
            output_path,
        };
        id += 1;

        if path_tx.send(job).is_err() {
            break;
        }
    }
}

fn map_output_path(
    input_dir: &Path,
    output_dir: &Path,
    input_path: &Path,
    output_ext: &str,
) -> Option<PathBuf> {
    let relative = input_path.strip_prefix(input_dir).ok()?;
    let stem = input_path.file_stem()?.to_str()?;
    let parent = relative.parent().unwrap_or_else(|| Path::new(""));
    Some(output_dir.join(parent).join(format!("{stem}.{output_ext}")))
}

fn reader_loop(path_rx: Receiver<CompressJob>, loaded_tx: Sender<LoadedJob>) {
    for job in path_rx {
        let bytes = match fs::read(&job.input_path) {
            Ok(data) => data,
            Err(err) => {
                error!(path = %job.input_path.display(), error = %err, "读取文件失败");
                continue;
            }
        };
        let loaded = LoadedJob {
            id: job.id,
            input_path: job.input_path,
            output_path: job.output_path,
            bytes,
        };
        if loaded_tx.send(loaded).is_err() {
            break;
        }
    }
}

fn compress_worker_loop(
    loaded_rx: Receiver<LoadedJob>,
    done_tx: Sender<CompressedItem>,
    progress: Arc<ProgressTracker>,
    failures: Arc<std::sync::Mutex<Vec<CompressFailure>>>,
) {
    for job in loaded_rx {
        let original_size = job.bytes.len() as u64;
        let input_display = job.input_path.display().to_string();

        match compress_bytes_to_webp(&job.bytes) {
            Ok(output) => {
                let item = CompressedItem {
                    id: job.id,
                    input_path: job.input_path,
                    output_path: job.output_path,
                    original_size,
                    output,
                };
                if done_tx.send(item).is_err() {
                    break;
                }
            }
            Err(reason) => {
                error!(path = %input_display, error = %reason, "压缩失败");
                progress.record_failure();
                if let Ok(mut guard) = failures.lock() {
                    guard.push(CompressFailure {
                        path: input_display,
                        reason,
                    });
                }
            }
        }
        // job.bytes 在此作用域结束自动释放
    }
}

fn writer_loop(done_rx: Receiver<CompressedItem>, progress: Arc<ProgressTracker>) {
    for item in done_rx {
        let path_display = item.output_path.display().to_string();
        match fs::write(&item.output_path, &item.output.bytes) {
            Ok(()) => {
                progress.record_success(item.original_size, item.output.bytes.len() as u64);
            }
            Err(err) => {
                error!(path = %path_display, error = %err, "写入文件失败");
                progress.record_failure();
            }
        }
        // item.output.bytes 在此释放
    }
}

fn progress_watch_loop(
    progress: Arc<ProgressTracker>,
    done: Arc<AtomicBool>,
    on_progress: Option<ProgressHook>,
) {
    let mut last_logged = std::time::Instant::now();
    loop {
        thread::sleep(PROGRESS_HOOK_INTERVAL);
        let snap = progress.snapshot();
        if snap.total > 0 || snap.completed > 0 {
            if let Some(ref hook) = on_progress {
                hook(snap.clone());
            }
            if last_logged.elapsed() >= PROGRESS_LOG_INTERVAL {
                log_progress_snapshot(&snap);
                last_logged = std::time::Instant::now();
            }
        }
        if done.load(Ordering::Relaxed) {
            let final_snap = progress.snapshot();
            if final_snap.completed != snap.completed || final_snap.total != snap.total {
                if let Some(ref hook) = on_progress {
                    hook(final_snap.clone());
                }
                log_progress_snapshot(&final_snap);
            }
            break;
        }
    }
}

fn log_engine_startup(hw: &HardwareProfile, config: &EngineConfig) {
    info!(
        logical_cores = hw.cpu.logical_cores,
        physical_cores = hw.cpu.physical_cores,
        rayon_threads = config.rayon_threads,
        io_readers = config.io_readers,
        available_mem_mb = hw.memory.available_bytes / 1024 / 1024,
        channel_scan = config.channel_scan,
        channel_pipeline = config.channel_pipeline,
        channel_write = config.channel_write,
        sse42 = hw.simd.sse42,
        avx2 = hw.simd.avx2,
        avx512 = hw.simd.avx512,
        neon = hw.simd.neon,
        "图片压缩引擎启动"
    );
}

fn log_progress_snapshot(snap: &ProgressSnapshot) {
    info!(
        total = snap.total,
        completed = snap.completed,
        succeeded = snap.succeeded,
        failed = snap.failed,
        images_per_sec = format!("{:.1}", snap.images_per_sec),
        eta_secs = snap.eta_secs.map(|s| format!("{:.0}", s)),
        compression_ratio = snap
            .compression_ratio
            .map(|r| format!("{:.2}", r)),
        "压缩进度"
    );
}

fn log_final_summary(snap: &ProgressSnapshot, config: &EngineConfig) {
    info!(
        total = snap.total,
        succeeded = snap.succeeded,
        failed = snap.failed,
        elapsed_ms = snap.elapsed_ms,
        images_per_sec = format!("{:.1}", snap.images_per_sec),
        bytes_in_mb = format!("{:.1}", snap.bytes_in as f64 / 1024.0 / 1024.0),
        bytes_out_mb = format!("{:.1}", snap.bytes_out as f64 / 1024.0 / 1024.0),
        rayon_threads = config.rayon_threads,
        "图片压缩完成"
    );
}
