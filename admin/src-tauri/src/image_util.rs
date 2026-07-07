//! 图片转码公开 API（薄封装，核心在 `imgflow` crate）

use std::path::Path;

use imgflow::EncodeOutput;

pub fn compress_image_to_webp(bytes: &[u8]) -> Result<EncodeOutput, String> {
    imgflow::transcode_bytes(bytes).map_err(|e| e.to_string())
}

pub fn convert_bytes_to_webp(bytes: &[u8]) -> Result<Vec<u8>, String> {
    Ok(compress_image_to_webp(bytes)?.bytes)
}

pub fn convert_to_webp(path: &Path) -> Result<Vec<u8>, String> {
    Ok(imgflow::transcode_file(path)
        .map_err(|e| e.to_string())?
        .bytes)
}
