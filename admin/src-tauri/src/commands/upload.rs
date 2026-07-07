use std::path::{Path, PathBuf};

use tauri::ipc::{InvokeBody, Request};
use tauri::Emitter;

use tracing::{error, info, instrument, warn};

use serde::{Deserialize, Serialize};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

use crate::cloud::{
    database::{save_media_file, SaveMediaFileInput},
    delete_storage_reference, get_download_url_for_reference, list_media_files, upload_bytes_raw,
    upload_webp_bytes as upload_webp_to_storage, MediaFileRecord,
};
use crate::image_util::compress_image_to_webp;
use imgflow::{
    detect_hardware, run_directory, run_in_memory, BatchSummary, DirectoryOptions, EncodeOptions,
    EngineConfig, HardwareProfile, MemoryBatchResult, MemoryInput, ProgressCallback,
    ProgressSnapshot,
};

/// Tauri 进度事件名（前端 `listen` 同一常量）
const PROGRESS_EVENT: &str = "image-compress-progress";
use crate::video_compress_config::{
    parse_video_compress_preset, VideoCompressPreset, UPLOAD_VIDEO_SOURCE_MAX_BYTES,
};
use crate::video_util::{compress_video_file_with_preset, ensure_video_within_limit};

fn persist_upload(
    uploaded: crate::cloud::storage::UploadImageResult,
    mime_type: &str,
) -> Result<MediaFileRecord, String> {
    info!(

        file_id = %uploaded.file_id,

        cloud_path = %uploaded.cloud_path,

        original_name = %uploaded.original_name,

        "开始写入 media_files"

    );

    save_media_file(SaveMediaFileInput {
        file_id: uploaded.file_id,

        cloud_path: uploaded.cloud_path,

        download_url: uploaded.download_url,

        original_name: uploaded.original_name,

        mime_type: mime_type.to_string(),
    })
}

fn header_value(request: &Request<'_>, key: &str) -> Option<String> {
    request
        .headers()
        .get(key)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

fn decode_header_name(value: &str) -> String {
    percent_encoding::percent_decode_str(value)
        .decode_utf8()
        .map(|text| text.into_owned())
        .unwrap_or_else(|_| value.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchManifestEntry {
    name: String,
    offset: usize,
    length: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressProgressEventDTO {
    pub session_id: String,
    pub total: u64,
    pub completed: u64,
    pub succeeded: u64,
    pub failed: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub elapsed_ms: u64,
    pub images_per_sec: f64,
    pub eta_secs: Option<f64>,
    pub compression_ratio: Option<f64>,
}

impl ImageCompressProgressEventDTO {
    fn from_snapshot(session_id: String, snap: ProgressSnapshot) -> Self {
        Self {
            session_id,
            total: snap.total,
            completed: snap.completed,
            succeeded: snap.succeeded,
            failed: snap.failed,
            bytes_in: snap.bytes_in,
            bytes_out: snap.bytes_out,
            elapsed_ms: snap.elapsed_ms,
            images_per_sec: snap.images_per_sec,
            eta_secs: snap.eta_secs,
            compression_ratio: snap.compression_ratio,
        }
    }
}

fn make_progress_emitter(app: tauri::AppHandle, session_id: String) -> ProgressCallback {
    std::sync::Arc::new(move |snap| {
        let payload = ImageCompressProgressEventDTO::from_snapshot(session_id.clone(), snap);
        if let Err(err) = app.emit(PROGRESS_EVENT, &payload) {
            warn!(error = %err, "图片压缩进度事件推送失败");
        }
    })
}

fn parse_batch_manifest(raw: &str, body_len: usize) -> Result<Vec<BatchManifestEntry>, String> {
    let decoded = decode_header_name(raw);
    let entries: Vec<BatchManifestEntry> =
        serde_json::from_str(&decoded).map_err(|err| format!("批量清单解析失败: {err}"))?;
    if entries.is_empty() {
        return Err("批量清单为空".into());
    }
    for entry in &entries {
        if entry.offset.saturating_add(entry.length) > body_len {
            return Err(format!("文件 {} 数据越界", entry.name));
        }
    }
    Ok(entries)
}

fn split_batch_body(body: &[u8], entries: &[BatchManifestEntry]) -> Vec<MemoryInput> {
    entries
        .iter()
        .map(|entry| MemoryInput {
            label: entry.name.clone(),
            bytes: body[entry.offset..entry.offset + entry.length].to_vec(),
        })
        .collect()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InMemoryItemDTO {
    pub label: String,
    pub original_width: u32,
    pub original_height: u32,
    pub original_size: usize,
    pub output_width: u32,
    pub output_height: u32,
    pub output_size: usize,
    pub webp_base64: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InMemoryBatchResultDTO {
    pub items: Vec<InMemoryItemDTO>,
    pub total: u64,
    pub succeeded: u64,
    pub failed: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub elapsed_ms: u64,
    pub failures: Vec<imgflow::TranscodeFailure>,
}

fn memory_batch_to_dto(result: MemoryBatchResult) -> InMemoryBatchResultDTO {
    let summary = result.summary;
    InMemoryBatchResultDTO {
        items: result
            .items
            .into_iter()
            .map(|item| InMemoryItemDTO {
                label: item.label,
                original_width: item.original_width,
                original_height: item.original_height,
                original_size: item.original_size,
                output_width: item.output_width,
                output_height: item.output_height,
                output_size: item.output_size,
                webp_base64: BASE64.encode(&item.bytes),
            })
            .collect(),
        total: summary.total,
        succeeded: summary.succeeded,
        failed: summary.failed,
        bytes_in: summary.bytes_in,
        bytes_out: summary.bytes_out,
        elapsed_ms: summary.elapsed_ms,
        failures: summary.failures,
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressPreviewDTO {
    pub original_width: u32,
    pub original_height: u32,
    pub original_size: usize,
    pub output_width: u32,
    pub output_height: u32,
    pub output_size: usize,
    pub webp_base64: String,
}

#[tauri::command]
#[instrument(skip(request))]
pub async fn preview_image_compress(
    request: Request<'_>,
) -> Result<ImageCompressPreviewDTO, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(data) => data.to_vec(),
        InvokeBody::Json(_) => {
            return Err("请使用二进制方式上传图片预览数据".into());
        }
    };

    if bytes.is_empty() {
        return Err("图片数据为空".into());
    }

    let original_size = bytes.len();

    tauri::async_runtime::spawn_blocking(move || {
        let output = compress_image_to_webp(&bytes)?;
        Ok(ImageCompressPreviewDTO {
            original_width: output.original_width,
            original_height: output.original_height,
            original_size,
            output_width: output.output_width,
            output_height: output.output_height,
            output_size: output.bytes.len(),
            webp_base64: BASE64.encode(&output.bytes),
        })
    })
    .await
    .map_err(|err| format!("预览任务异常: {err}"))?
}

/// 多图批量压缩预览（Rust 端 Rayon 并行，进度经 `image-compress-progress` 事件推送）
#[tauri::command]
#[instrument(skip(app, request))]
pub async fn batch_preview_image_compress(
    app: tauri::AppHandle,
    request: Request<'_>,
) -> Result<InMemoryBatchResultDTO, String> {
    let body = match request.body() {
        InvokeBody::Raw(data) => data.to_vec(),
        InvokeBody::Json(_) => {
            return Err("请使用二进制方式上传批量图片数据".into());
        }
    };

    if body.is_empty() {
        return Err("批量图片数据为空".into());
    }

    let manifest_raw = header_value(&request, "x-batch-manifest")
        .ok_or_else(|| "缺少 x-batch-manifest 请求头".to_string())?;
    let session_id = header_value(&request, "x-session-id")
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());

    let entries = parse_batch_manifest(&manifest_raw, body.len())?;
    let items = split_batch_body(&body, &entries);
    let hook = make_progress_emitter(app, session_id);

    info!(count = items.len(), "收到批量图片压缩请求");

    tauri::async_runtime::spawn_blocking(move || {
        run_in_memory(items, EncodeOptions::default(), Some(hook)).map(memory_batch_to_dto)
    })
    .await
    .map_err(|err| format!("批量压缩任务异常: {err}"))?
    .map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageCompressEngineInfoDTO {
    pub hardware: HardwareProfile,
    pub config: EngineConfig,
}

/// 返回当前硬件探测结果与引擎运行参数（线程数、channel 容量等）
#[tauri::command]
#[instrument]
pub async fn get_image_compress_engine_info() -> Result<ImageCompressEngineInfoDTO, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let hardware = detect_hardware();
        let config = EngineConfig::from_hardware(&hardware);
        Ok(ImageCompressEngineInfoDTO { hardware, config })
    })
    .await
    .map_err(|err| format!("引擎信息查询异常: {err}"))?
}

/// 目录批量压缩：扫描 → 读取 → 解码压缩 → 写入（流水线，支持数万张）
#[tauri::command]
#[instrument]
pub async fn batch_compress_directory(
    app: tauri::AppHandle,
    input_dir: String,
    output_dir: String,
    recursive: Option<bool>,
    session_id: Option<String>,
) -> Result<BatchSummary, String> {
    let input = PathBuf::from(input_dir);
    let output = PathBuf::from(output_dir);
    let recursive = recursive.unwrap_or(true);
    let session_id = session_id
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());
    let hook = make_progress_emitter(app, session_id);

    tauri::async_runtime::spawn_blocking(move || {
        run_directory(
            DirectoryOptions {
                input_dir: input,
                output_dir: output,
                recursive,
                encode: EncodeOptions::default(),
            },
            Some(hook),
        )
    })
    .await
    .map_err(|err| format!("批量压缩任务异常: {err}"))?
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[instrument(skip(request))]
pub async fn upload_webp_bytes(request: Request<'_>) -> Result<MediaFileRecord, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(data) => data.to_vec(),
        InvokeBody::Json(_) => {
            return Err("请使用二进制方式上传 WebP 数据".into());
        }
    };

    if bytes.is_empty() {
        return Err("WebP 数据为空".into());
    }

    let original_name = header_value(&request, "x-original-name")
        .map(|value| decode_header_name(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "image.webp".to_string());

    let prefix = header_value(&request, "x-upload-prefix");

    info!(
        original_name = %original_name,
        prefix = ?prefix,
        bytes = bytes.len(),
        "收到 WebP 直传"
    );

    tauri::async_runtime::spawn_blocking(move || {
        let uploaded = upload_webp_to_storage(&bytes, &original_name, prefix.as_deref())?;
        persist_upload(uploaded, "image/webp")
    })
    .await
    .map_err(|err| format!("上传任务异常: {err}"))?
}

fn guess_video_extension(name: &str) -> String {
    let ext = Path::new(name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("mp4")
        .to_ascii_lowercase();
    if matches!(ext.as_str(), "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v") {
        ext
    } else {
        "mp4".into()
    }
}

fn guess_video_mime(extension: &str) -> &'static str {
    match extension {
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "mkv" => "video/x-matroska",
        "webm" => "video/webm",
        _ => "video/mp4",
    }
}

fn parse_compress_header(value: Option<String>) -> bool {
    matches!(
        value.as_deref().map(str::trim),
        Some("1") | Some("true") | Some("yes")
    )
}

fn parse_compress_preset_header(value: Option<String>) -> VideoCompressPreset {
    value
        .as_deref()
        .and_then(parse_video_compress_preset)
        .unwrap_or(VideoCompressPreset::Standard)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoCompressPreviewDTO {
    pub original_size: usize,
    pub output_size: usize,
    pub compressed: bool,
    pub video_base64: String,
}

fn prepare_video_bytes(
    bytes: &[u8],
    original_name: &str,
    should_compress: bool,
    compress_preset: VideoCompressPreset,
) -> Result<(Vec<u8>, bool), String> {
    if !should_compress {
        return Ok((bytes.to_vec(), false));
    }

    let upload_id = uuid::Uuid::new_v4().simple().to_string();
    let extension = guess_video_extension(original_name);
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("myapp-video-{upload_id}-source.{extension}"));
    let output_path = temp_dir.join(format!("myapp-video-{upload_id}.mp4"));

    let result = (|| {
        std::fs::write(&input_path, bytes).map_err(|err| format!("写入临时视频失败: {err}"))?;
        compress_video_file_with_preset(&input_path, &output_path, compress_preset)?;
        let compressed =
            std::fs::read(&output_path).map_err(|err| format!("读取压缩视频失败: {err}"))?;
        ensure_video_within_limit(&compressed)?;
        Ok((compressed, true))
    })();

    let _ = std::fs::remove_file(&input_path);
    let _ = std::fs::remove_file(&output_path);
    result
}

#[tauri::command]
#[instrument(skip(request))]
pub async fn preview_video_compress(
    request: Request<'_>,
) -> Result<VideoCompressPreviewDTO, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(data) => data.to_vec(),
        InvokeBody::Json(_) => {
            return Err("请使用二进制方式上传视频预览数据".into());
        }
    };

    if bytes.is_empty() {
        return Err("视频数据为空".into());
    }

    if bytes.len() > UPLOAD_VIDEO_SOURCE_MAX_BYTES {
        return Err(format!(
            "源视频不能超过 200MB（当前约 {:.1}MB）",
            bytes.len() as f64 / 1024.0 / 1024.0
        ));
    }

    let original_name = header_value(&request, "x-original-name")
        .map(|value| decode_header_name(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "video.mp4".to_string());
    let should_compress = parse_compress_header(header_value(&request, "x-video-compress"));
    let compress_preset =
        parse_compress_preset_header(header_value(&request, "x-video-compress-preset"));
    let original_size = bytes.len();

    tauri::async_runtime::spawn_blocking(move || {
        let (output, compressed) =
            prepare_video_bytes(&bytes, &original_name, should_compress, compress_preset)?;
        Ok(VideoCompressPreviewDTO {
            original_size,
            output_size: output.len(),
            compressed,
            video_base64: BASE64.encode(&output),
        })
    })
    .await
    .map_err(|err| format!("视频压缩预览任务异常: {err}"))?
}

#[tauri::command]
#[instrument(skip(request))]
pub async fn upload_compressed_video_bytes(
    request: Request<'_>,
) -> Result<MediaFileRecord, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(data) => data.to_vec(),
        InvokeBody::Json(_) => {
            return Err("请使用二进制方式上传视频数据".into());
        }
    };

    if bytes.is_empty() {
        return Err("视频数据为空".into());
    }

    ensure_video_within_limit(&bytes)?;

    let original_name = header_value(&request, "x-original-name")
        .map(|value| decode_header_name(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "video.mp4".to_string());
    let prefix = header_value(&request, "x-upload-prefix");
    let source_path = PathBuf::from(&original_name);
    let stem = source_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("video");
    let output_name = format!("{stem}.mp4");

    info!(
        original_name = %original_name,
        prefix = ?prefix,
        bytes = bytes.len(),
        "收到已压缩视频直传"
    );

    tauri::async_runtime::spawn_blocking(move || {
        let uploaded = upload_bytes_raw(
            &bytes,
            &output_name,
            prefix.as_deref(),
            "video/mp4",
            "mp4",
        )?;
        persist_upload(uploaded, "video/mp4")
    })
    .await
    .map_err(|err| format!("上传任务异常: {err}"))?
}

#[tauri::command]
#[instrument(skip(request))]
pub async fn upload_video_bytes(request: Request<'_>) -> Result<MediaFileRecord, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(data) => data.to_vec(),
        InvokeBody::Json(_) => {
            warn!("收到 JSON 格式上传请求，应使用二进制 Raw Body");
            return Err("请使用二进制方式上传视频（不要 JSON 序列化字节数组）".into());
        }
    };

    if bytes.is_empty() {
        return Err("视频数据为空".into());
    }

    if bytes.len() > UPLOAD_VIDEO_SOURCE_MAX_BYTES {
        return Err(format!(
            "源视频不能超过 200MB（当前约 {:.1}MB）",
            bytes.len() as f64 / 1024.0 / 1024.0
        ));
    }

    let original_name = header_value(&request, "x-original-name")
        .map(|value| decode_header_name(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "video.mp4".to_string());

    let prefix = header_value(&request, "x-upload-prefix");
    let should_compress = parse_compress_header(header_value(&request, "x-video-compress"));
    let compress_preset =
        parse_compress_preset_header(header_value(&request, "x-video-compress-preset"));
    let upload_id = uuid::Uuid::new_v4().simple().to_string();
    let extension = guess_video_extension(&original_name);
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("myapp-video-{upload_id}-source.{extension}"));
    let output_path = temp_dir.join(format!("myapp-video-{upload_id}.mp4"));

    info!(
        original_name = %original_name,
        prefix = ?prefix,
        bytes = bytes.len(),
        should_compress,
        preset = ?compress_preset,
        "收到二进制视频上传"
    );

    tauri::async_runtime::spawn_blocking(move || {
        std::fs::write(&input_path, &bytes).map_err(|err| format!("写入临时视频失败: {err}"))?;

        let result = (|| {
            let source_path = PathBuf::from(&original_name);
            let stem = source_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("video");

            if should_compress {
                let (compressed, _) = prepare_video_bytes(
                    &bytes,
                    &original_name,
                    true,
                    compress_preset,
                )?;
                let output_name = format!("{stem}.mp4");
                let uploaded = upload_bytes_raw(
                    &compressed,
                    &output_name,
                    prefix.as_deref(),
                    "video/mp4",
                    "mp4",
                )?;
                persist_upload(uploaded, "video/mp4")
            } else {
                let output_name = if extension == "mp4" {
                    format!("{stem}.mp4")
                } else {
                    original_name.clone()
                };
                let mime = guess_video_mime(&extension);
                let uploaded =
                    upload_bytes_raw(&bytes, &output_name, prefix.as_deref(), mime, &extension)?;
                persist_upload(uploaded, mime)
            }
        })();

        let _ = std::fs::remove_file(&input_path);
        let _ = std::fs::remove_file(&output_path);
        result
    })
    .await
    .map_err(|err| format!("上传任务异常: {err}"))?
}

#[tauri::command]
#[instrument]
pub async fn resolve_storage_url(reference: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || get_download_url_for_reference(&reference))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
#[instrument]
pub async fn delete_storage_file(reference: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || delete_storage_reference(&reference))
        .await
        .map_err(|err| format!("删除任务异常: {err}"))?
}

#[tauri::command]
#[instrument]

pub async fn list_uploaded_media(
    limit: Option<u32>,
    skip: Option<u32>,
) -> Result<Vec<MediaFileRecord>, String> {
    let limit = limit.unwrap_or(50);

    let skip = skip.unwrap_or(0);

    info!(limit, skip, "查询媒体库");

    tauri::async_runtime::spawn_blocking(move || list_media_files(limit, skip))
        .await
        .map_err(|err| {
            error!(error = %err, "查询任务 panic/中断");

            format!("查询任务异常: {err}")
        })?
        .map_err(|err| {
            error!(error = %err, "查询媒体库失败");

            err
        })
}
