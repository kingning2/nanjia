//! 高性能自适应图片压缩引擎
//!
//! 流水线：扫描 → IO 读取 → 解码+压缩（Rayon）→ IO 写入
//! 根据 CPU / 内存自动调整线程数与 channel 容量，避免 OOM。

mod codec;
mod config;
mod hardware;
mod pipeline;
mod progress;
mod types;

pub use codec::{compress_bytes_to_webp, compress_file_to_webp};
pub use config::EngineConfig;
pub use hardware::{detect_hardware, HardwareProfile};
pub use pipeline::{run_directory, run_in_memory};
pub use progress::{ProgressHook, ProgressSnapshot};
pub use types::{BatchResult, DirectoryBatchOptions, InMemoryBatchResult, InMemoryItem};

/// Tauri 进度事件名（前端 `listen` 同一常量）
pub const PROGRESS_EVENT: &str = "image-compress-progress";
