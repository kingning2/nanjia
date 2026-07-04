use std::path::{Path, PathBuf};

use tauri::ipc::{InvokeBody, Request};

use tracing::{error, info, instrument, warn};

use serde::Serialize;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

use crate::cloud::{
    database::{save_media_file, SaveMediaFileInput},
    delete_storage_reference, get_download_url_for_reference, list_media_files, upload_bytes_raw,
    upload_webp_bytes as upload_webp_to_storage, MediaFileRecord,
};
use crate::image_util::compress_image_to_webp;
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
                compress_video_file_with_preset(&input_path, &output_path, compress_preset)?;
                let compressed = std::fs::read(&output_path)
                    .map_err(|err| format!("读取压缩视频失败: {err}"))?;
                ensure_video_within_limit(&compressed)?;
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
