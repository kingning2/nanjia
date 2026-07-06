//! 图片压缩公开 API（向后兼容层，核心逻辑在 `image_compress` 模块）

use std::path::Path;

pub use crate::image_compress::compress_bytes_to_webp as compress_image_to_webp;

pub fn convert_bytes_to_webp(bytes: &[u8]) -> Result<Vec<u8>, String> {
    Ok(compress_image_to_webp(bytes)?.bytes)
}

pub fn convert_to_webp(path: &Path) -> Result<Vec<u8>, String> {
    Ok(crate::image_compress::compress_file_to_webp(path)?.bytes)
}
