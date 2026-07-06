use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::Serialize;

/// 进度回调（Tauri 事件推送等）
pub type ProgressHook = Arc<dyn Fn(ProgressSnapshot) + Send + Sync>;

/// 无锁进度统计（原子操作，避免 Mutex 竞争）
pub struct ProgressTracker {
    discovered: AtomicU64,
    completed: AtomicU64,
    succeeded: AtomicU64,
    failed: AtomicU64,
    bytes_in: AtomicU64,
    bytes_out: AtomicU64,
    start: Instant,
}

/// 进度快照（供日志 / Tauri 事件）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSnapshot {
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

impl ProgressTracker {
    pub fn new() -> Self {
        Self {
            discovered: AtomicU64::new(0),
            completed: AtomicU64::new(0),
            succeeded: AtomicU64::new(0),
            failed: AtomicU64::new(0),
            bytes_in: AtomicU64::new(0),
            bytes_out: AtomicU64::new(0),
            start: Instant::now(),
        }
    }

    pub fn record_discovered(&self) {
        self.discovered.fetch_add(1, Ordering::Relaxed);
    }

    pub fn set_total(&self, total: u64) {
        self.discovered.store(total, Ordering::Relaxed);
    }

    pub fn record_success(&self, bytes_in: u64, bytes_out: u64) {
        self.bytes_in.fetch_add(bytes_in, Ordering::Relaxed);
        self.bytes_out.fetch_add(bytes_out, Ordering::Relaxed);
        self.succeeded.fetch_add(1, Ordering::Relaxed);
        self.completed.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_failure(&self) {
        self.failed.fetch_add(1, Ordering::Relaxed);
        self.completed.fetch_add(1, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> ProgressSnapshot {
        let total = self.discovered.load(Ordering::Relaxed);
        let completed = self.completed.load(Ordering::Relaxed);
        let succeeded = self.succeeded.load(Ordering::Relaxed);
        let failed = self.failed.load(Ordering::Relaxed);
        let bytes_in = self.bytes_in.load(Ordering::Relaxed);
        let bytes_out = self.bytes_out.load(Ordering::Relaxed);
        let elapsed_ms = self.start.elapsed().as_millis() as u64;
        let elapsed_secs = elapsed_ms as f64 / 1000.0;

        let images_per_sec = if elapsed_secs > 0.0 {
            completed as f64 / elapsed_secs
        } else {
            0.0
        };

        let remaining = total.saturating_sub(completed);
        let eta_secs = if images_per_sec > 0.0 && remaining > 0 {
            Some(remaining as f64 / images_per_sec)
        } else {
            None
        };

        let compression_ratio = if bytes_in > 0 {
            Some(bytes_out as f64 / bytes_in as f64)
        } else {
            None
        };

        ProgressSnapshot {
            total,
            completed,
            succeeded,
            failed,
            bytes_in,
            bytes_out,
            elapsed_ms,
            images_per_sec,
            eta_secs,
            compression_ratio,
        }
    }
}

impl Default for ProgressTracker {
    fn default() -> Self {
        Self::new()
    }
}
