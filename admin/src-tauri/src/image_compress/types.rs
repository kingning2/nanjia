use std::path::PathBuf;

use serde::Serialize;

/// 单张图片处理任务（扫描阶段产出）
#[derive(Debug, Clone)]
pub struct CompressJob {
    pub id: u64,
    pub input_path: PathBuf,
    pub output_path: PathBuf,
}

/// 已读取到内存、待解码压缩的任务
#[derive(Debug)]
pub struct LoadedJob {
    pub id: u64,
    pub input_path: PathBuf,
    pub output_path: PathBuf,
    pub bytes: Vec<u8>,
}

/// 压缩成功结果
#[derive(Debug, Clone)]
pub struct CompressedItem {
    #[allow(dead_code)]
    pub id: u64,
    #[allow(dead_code)]
    pub input_path: PathBuf,
    pub output_path: PathBuf,
    pub original_size: u64,
    pub output: super::codec::WebpCompressOutput,
}

/// 单张失败记录
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressFailure {
    pub path: String,
    pub reason: String,
}

/// 目录批量压缩选项
#[derive(Debug, Clone)]
pub struct DirectoryBatchOptions {
    pub input_dir: PathBuf,
    pub output_dir: PathBuf,
    /// 是否递归子目录
    pub recursive: bool,
    /// 输出文件扩展名（默认 webp）
    pub output_ext: String,
}

/// 批量压缩汇总
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
    pub total: u64,
    pub succeeded: u64,
    pub failed: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub elapsed_ms: u64,
    pub failures: Vec<CompressFailure>,
}

/// 内存批量项（无磁盘路径，供 Tauri 多文件调用）
#[derive(Debug)]
pub struct InMemoryItem {
    #[allow(dead_code)]
    pub id: u64,
    pub label: String,
    pub bytes: Vec<u8>,
}

/// 内存批量结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InMemoryResult {
    pub label: String,
    pub original_width: u32,
    pub original_height: u32,
    pub original_size: usize,
    pub output_width: u32,
    pub output_height: u32,
    pub output_size: usize,
    pub webp_base64: String,
}

/// 内存批量压缩完整结果（含失败列表）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InMemoryBatchResult {
    pub items: Vec<InMemoryResult>,
    pub total: u64,
    pub succeeded: u64,
    pub failed: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub elapsed_ms: u64,
    pub failures: Vec<CompressFailure>,
}

pub const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp"];

pub fn is_image_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            IMAGE_EXTENSIONS
                .iter()
                .any(|allowed| ext.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}
