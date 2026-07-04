//! 图片上传：解码（image）→ 必要时缩放（fast_image_resize / Lanczos3）→ WebP（libwebp）

use std::path::Path;

use fast_image_resize as fir;
use fir::images::Image;
use fir::{PixelType, Resizer};
use image::GenericImageView;
use tracing::debug;

/// 仅对超大图缩小边长；1920 在小程序上已足够清晰
const MAX_EDGE: u32 = 1920;
/// libwebp 有损质量 0–100（94 高画质，不做二次降质）
const WEBP_QUALITY: f32 = 94.0;

#[derive(Debug, Clone)]
pub struct WebpCompressOutput {
    pub original_width: u32,
    pub original_height: u32,
    pub output_width: u32,
    pub output_height: u32,
    pub bytes: Vec<u8>,
}

pub fn convert_bytes_to_webp(bytes: &[u8]) -> Result<Vec<u8>, String> {
    Ok(compress_image_to_webp(bytes)?.bytes)
}

pub fn convert_to_webp(path: &Path) -> Result<Vec<u8>, String> {
    let img = image::open(path).map_err(|err| format!("读取图片失败: {err}"))?;
    to_webp_bytes(&img).map(|output| output.bytes)
}

pub fn compress_image_to_webp(source: &[u8]) -> Result<WebpCompressOutput, String> {
    let img = image::load_from_memory(source).map_err(|err| format!("读取图片失败: {err}"))?;
    let (original_width, original_height) = img.dimensions();
    if original_width == 0 || original_height == 0 {
        return Err("图片尺寸无效".into());
    }
    let output = to_webp_bytes(&img)?;
    Ok(WebpCompressOutput {
        original_width,
        original_height,
        output_width: output.output_width,
        output_height: output.output_height,
        bytes: output.bytes,
    })
}

struct WebpBytes {
    output_width: u32,
    output_height: u32,
    bytes: Vec<u8>,
}

fn to_webp_bytes(img: &image::DynamicImage) -> Result<WebpBytes, String> {
    let (width, height) = img.dimensions();
    if width == 0 || height == 0 {
        return Err("图片尺寸无效".into());
    }

    let rgba = if width <= MAX_EDGE && height <= MAX_EDGE {
        img.to_rgba8()
    } else {
        let (dst_width, dst_height) = thumbnail_dimensions(width, height, MAX_EDGE, MAX_EDGE);
        resize_with_fast_image_resize(img, dst_width, dst_height)?
    };

    let (w, h) = rgba.dimensions();
    let encoded = webp::Encoder::from_rgba(rgba.as_raw(), w, h).encode(WEBP_QUALITY);
    debug!(
        width = w,
        height = h,
        webp_bytes = encoded.len(),
        quality = WEBP_QUALITY,
        "libwebp 编码完成"
    );
    Ok(WebpBytes {
        output_width: w,
        output_height: h,
        bytes: encoded.to_vec(),
    })
}

/// 与 `image::DynamicImage::thumbnail` 相同的适配尺寸计算
fn thumbnail_dimensions(src_w: u32, src_h: u32, max_w: u32, max_h: u32) -> (u32, u32) {
    let scale = (max_w as f32 / src_w as f32).min(max_h as f32 / src_h as f32);
    let new_w = (scale * src_w as f32).max(1.) as u32;
    let new_h = (scale * src_h as f32).max(1.) as u32;
    (new_w, new_h)
}

fn resize_with_fast_image_resize(
    img: &image::DynamicImage,
    dst_width: u32,
    dst_height: u32,
) -> Result<image::RgbaImage, String> {
    let (width, height) = img.dimensions();
    let src_image = Image::from_vec_u8(width, height, img.to_rgba8().into_raw(), PixelType::U8x4)
        .map_err(|err| format!("fast_image_resize 源图准备失败: {err}"))?;

    let mut dst_image = Image::new(dst_width, dst_height, PixelType::U8x4);
    let mut resizer = Resizer::new();
    resizer
        .resize(&src_image, &mut dst_image, None)
        .map_err(|err| format!("fast_image_resize 缩放失败: {err}"))?;

    image::RgbaImage::from_raw(dst_width, dst_height, dst_image.into_vec())
        .ok_or_else(|| "fast_image_resize 输出无效".into())
}
