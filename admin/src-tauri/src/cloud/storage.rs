use std::path::Path;

use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, instrument, warn};

use reqwest::header::AUTHORIZATION;

use crate::cloud::api_error::format_user_error;
use crate::cloud::client::CloudClient;
use crate::image_util::convert_to_webp;
use crate::video_compress_config::UPLOAD_VIDEO_MAX_BYTES;

const UPLOAD_INFO_PATH: &str = "/v1/storages/get-objects-upload-info";
const UPLOAD_ACTION: &str = "GetObjectsUploadInfo";
const DELETE_OBJECTS_PATH: &str = "/v1/storages/delete-objects";
const DELETE_OBJECTS_ACTION: &str = "DeleteObjects";
/// 转 WebP 后的单文件大小上限（仅本模块校验）
const UPLOAD_WEBP_MAX_BYTES: usize = 10 * 1024 * 1024;

fn ensure_webp_within_limit(webp_bytes: &[u8]) -> Result<(), String> {
    if webp_bytes.len() <= UPLOAD_WEBP_MAX_BYTES {
        return Ok(());
    }

    warn!(
        webp_bytes = webp_bytes.len(),
        max = UPLOAD_WEBP_MAX_BYTES,
        "WebP 超过大小上限，拒绝上传"
    );

    Err(format!(
        "转 WebP 后不能超过 10MB（当前约 {:.1}MB），请换一张更小的图片或降低分辨率",
        webp_bytes.len() as f64 / 1024.0 / 1024.0
    ))
}

#[derive(Debug, Serialize)]
struct UploadInfoRequestItem {
    #[serde(rename = "objectId")]
    object_id: String,
}

#[derive(Debug, Serialize)]
struct DeleteObjectRequestItem {
    #[serde(rename = "cloudObjectId")]
    cloud_object_id: String,
}

#[derive(Debug, Deserialize)]
struct DeleteObjectResponseItem {
    code: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UploadInfoResponseItem {
    #[serde(rename = "uploadUrl")]
    upload_url: Option<String>,
    authorization: Option<String>,
    token: Option<String>,
    #[serde(rename = "cloudObjectMeta")]
    cloud_object_meta: Option<String>,
    #[serde(rename = "cloudObjectId")]
    cloud_object_id: Option<String>,
    #[serde(rename = "downloadUrl")]
    download_url: Option<String>,
    code: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadImageResult {
    #[serde(rename = "fileID")]
    pub file_id: String,
    pub cloud_path: String,
    pub download_url: Option<String>,
    pub original_name: String,
}

#[instrument(skip(bytes), fields(original_name, prefix = ?prefix, input_bytes = bytes.len()))]
pub fn upload_bytes_as_webp(
    bytes: &[u8],
    original_name: &str,
    prefix: Option<&str>,
) -> Result<UploadImageResult, String> {
    let client = CloudClient::from_env()?;
    debug!("开始转换 WebP");
    let webp_bytes = crate::image_util::convert_bytes_to_webp(bytes)?;
    debug!(webp_bytes = webp_bytes.len(), "WebP 转换完成");
    ensure_webp_within_limit(&webp_bytes)?;

    let cloud_path = build_cloud_path(prefix, original_name);
    let upload_info = get_upload_info(&client, &cloud_path)?;

    put_object(
        &upload_info.upload_url,
        &upload_info.authorization,
        &upload_info.token,
        &upload_info.cloud_object_meta,
        &webp_bytes,
        "image/webp",
    )?;

    let file_id = upload_info
        .cloud_object_id
        .clone()
        .unwrap_or_else(|| format!("cloud://{}.{cloud_path}", client.config().env_id));
    info!(%cloud_path, %file_id, "图片上传完成");

    Ok(UploadImageResult {
        file_id,
        cloud_path,
        download_url: upload_info.download_url,
        original_name: original_name.to_string(),
    })
}

/// 上传已压缩的 WebP 字节（跳过再次转码）
#[instrument(skip(webp_bytes), fields(original_name, prefix = ?prefix, webp_bytes = webp_bytes.len()))]
pub fn upload_webp_bytes(
    webp_bytes: &[u8],
    original_name: &str,
    prefix: Option<&str>,
) -> Result<UploadImageResult, String> {
    let client = CloudClient::from_env()?;
    upload_webp_bytes_for_client(&client, webp_bytes, original_name, prefix)
}

pub fn upload_webp_bytes_for_client(
    client: &CloudClient,
    webp_bytes: &[u8],
    original_name: &str,
    prefix: Option<&str>,
) -> Result<UploadImageResult, String> {
    ensure_webp_within_limit(webp_bytes)?;

    let cloud_path = build_media_cloud_path(prefix, original_name, "webp");
    let upload_info = get_upload_info(client, &cloud_path)?;

    put_object(
        &upload_info.upload_url,
        &upload_info.authorization,
        &upload_info.token,
        &upload_info.cloud_object_meta,
        webp_bytes,
        "image/webp",
    )?;

    let file_id = upload_info
        .cloud_object_id
        .clone()
        .unwrap_or_else(|| format!("cloud://{}.{cloud_path}", client.config().env_id));
    info!(%cloud_path, %file_id, "WebP 直传完成");

    Ok(UploadImageResult {
        file_id,
        cloud_path,
        download_url: upload_info.download_url,
        original_name: original_name.to_string(),
    })
}

#[instrument(skip(bytes), fields(original_name, prefix = ?prefix, input_bytes = bytes.len(), content_type, extension))]
pub fn upload_bytes_raw(
    bytes: &[u8],
    original_name: &str,
    prefix: Option<&str>,
    content_type: &str,
    extension: &str,
) -> Result<UploadImageResult, String> {
    let client = CloudClient::from_env()?;
    upload_bytes_raw_for_client(
        &client,
        bytes,
        original_name,
        prefix,
        content_type,
        extension,
    )
}

pub fn upload_bytes_raw_for_client(
    client: &CloudClient,
    bytes: &[u8],
    original_name: &str,
    prefix: Option<&str>,
    content_type: &str,
    extension: &str,
) -> Result<UploadImageResult, String> {
    if bytes.len() > UPLOAD_VIDEO_MAX_BYTES {
        return Err(format!(
            "视频不能超过 20MB（当前约 {:.1}MB）",
            bytes.len() as f64 / 1024.0 / 1024.0
        ));
    }

    let cloud_path = build_media_cloud_path(prefix, original_name, extension);
    let upload_info = get_upload_info(client, &cloud_path)?;

    put_object(
        &upload_info.upload_url,
        &upload_info.authorization,
        &upload_info.token,
        &upload_info.cloud_object_meta,
        bytes,
        content_type,
    )?;

    let file_id = upload_info
        .cloud_object_id
        .clone()
        .unwrap_or_else(|| format!("cloud://{}.{cloud_path}", client.config().env_id));
    info!(%cloud_path, %file_id, "视频上传完成");

    Ok(UploadImageResult {
        file_id,
        cloud_path,
        download_url: upload_info.download_url,
        original_name: original_name.to_string(),
    })
}

/// CloudBase API 的 JSON 响应里 `&` 常写成 `\u0026`；若未反序列化就拿来用会签名校验失败。
fn normalize_download_url(url: &str) -> String {
    url.replace("\\u0026", "&")
}

/// 将 `cloud://` fileID 或历史 HTTPS 临时链接解析为 objectId（COS 路径）
pub fn object_id_from_reference(reference: &str) -> Option<String> {
    let trimmed = reference.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("cloud://") {
        let slash = rest.find('/')?;
        return Some(rest[slash + 1..].to_string());
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        let parsed = reqwest::Url::parse(trimmed).ok()?;
        let path = parsed.path().trim_start_matches('/');
        if path.is_empty() {
            return None;
        }
        return Some(path.to_string());
    }
    Some(trimmed.trim_start_matches('/').to_string())
}

/// 删除云存储对象，并尽力清理 `media_files` 中对应记录（对象不存在时视为成功）
pub fn delete_storage_reference(reference: &str) -> Result<(), String> {
    let client = CloudClient::from_env()?;
    delete_storage_reference_for_client(&client, reference)
}

pub fn delete_storage_reference_for_client(
    client: &CloudClient,
    reference: &str,
) -> Result<(), String> {
    let cloud_object_id = normalize_cloud_object_id(client, reference)?;
    delete_storage_object_for_client(client, &cloud_object_id)?;

    if let Err(err) =
        crate::cloud::database::delete_media_files_by_file_id_for_client(client, reference)
    {
        warn!(error = %err, %reference, "云存储已删除，但 media_files 记录清理失败");
    }

    info!(%cloud_object_id, "云存储对象已删除");
    Ok(())
}

/// delete-objects 需要完整 fileID（cloud://…），不能用 COS 路径 objectId
fn normalize_cloud_object_id(client: &CloudClient, reference: &str) -> Result<String, String> {
    let trimmed = reference.trim();
    if trimmed.starts_with("cloud://") {
        return Ok(trimmed.to_string());
    }
    let object_id = object_id_from_reference(trimmed)
        .ok_or_else(|| "无法从 fileID / URL 解析云存储路径".to_string())?;
    Ok(format!(
        "cloud://{}/{}",
        client.config().env_id,
        object_id.trim_start_matches('/')
    ))
}

fn delete_storage_object_for_client(
    client: &CloudClient,
    cloud_object_id: &str,
) -> Result<(), String> {
    let body = serde_json::to_string(&vec![DeleteObjectRequestItem {
        cloud_object_id: cloud_object_id.to_string(),
    }])
    .map_err(|err| err.to_string())?;

    let url = client.gateway_url(DELETE_OBJECTS_PATH);
    info!(url = %url, cloud_object_id, body = %body, "请求删除云存储对象");
    let response = client.post_json(DELETE_OBJECTS_PATH, DELETE_OBJECTS_ACTION, &body)?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        if is_storage_object_missing(status.as_u16(), "", &text) {
            warn!(cloud_object_id, "云存储对象不存在，跳过删除");
            return Ok(());
        }

        error!(url = %url, %status, response = %text, "删除云存储对象失败");
        return Err(format_user_error(
            DELETE_OBJECTS_ACTION,
            status.as_u16(),
            &text,
        ));
    }

    let items: Vec<DeleteObjectResponseItem> = response
        .json()
        .map_err(|err| format!("解析删除云存储响应失败: {err}"))?;

    if let Some(item) = items.into_iter().next() {
        let code = item.code.as_deref().unwrap_or("SUCCESS");
        let message = item.message.as_deref().unwrap_or("");
        if code != "SUCCESS" && !is_storage_object_missing(status_code_hint(code), code, message) {
            error!(code, %message, cloud_object_id, "删除云存储对象业务错误");
            return Err(format_user_error(
                DELETE_OBJECTS_ACTION,
                400,
                &serde_json::json!({ "code": code, "message": message }).to_string(),
            ));
        }
        if code != "SUCCESS" {
            warn!(cloud_object_id, code, %message, "云存储对象不存在，仅清理媒体库记录");
        }
    }

    Ok(())
}

fn status_code_hint(code: &str) -> u16 {
    if is_storage_object_missing_code(code) {
        404
    } else {
        400
    }
}

fn is_storage_object_missing_code(code: &str) -> bool {
    matches!(
        code,
        "STORAGE_FILE_NONEXIST"
            | "STORAGE_OBJECT_NOT_EXIST"
            | "OBJECT_NOT_EXIST"
            | "OBJECT_NOT_FOUND"
    )
}

fn is_storage_object_missing(status: u16, code: &str, body: &str) -> bool {
    status == 404
        || is_storage_object_missing_code(code)
        || body.contains("STORAGE_FILE_NONEXIST")
        || body.contains("OBJECT_NOT_EXIST")
        || body.contains("STORAGE_OBJECT_NOT_EXIST")
        || body.contains("OBJECT_NOT_FOUND")
}

/// 获取云存储文件当前可访问的临时 HTTPS 链接（签名会过期，勿写入数据库）
pub fn get_download_url_for_reference(reference: &str) -> Result<String, String> {
    let client = CloudClient::from_env()?;
    get_download_url_for_client(&client, reference)
}

pub fn get_download_url_for_client(
    client: &CloudClient,
    reference: &str,
) -> Result<String, String> {
    let object_id = object_id_from_reference(reference)
        .ok_or_else(|| "无法从 fileID / URL 解析云存储路径".to_string())?;
    get_download_url_with_client(client, &object_id)
}

fn get_download_url_with_client(client: &CloudClient, object_id: &str) -> Result<String, String> {
    let body = serde_json::to_string(&vec![UploadInfoRequestItem {
        object_id: object_id.to_string(),
    }])
    .map_err(|err| err.to_string())?;

    let url = client.gateway_url(UPLOAD_INFO_PATH);
    info!(url = %url, object_id, "请求文件临时访问链接");
    let response = client.post_json(UPLOAD_INFO_PATH, UPLOAD_ACTION, &body)?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        error!(url = %url, %status, response = %text, "获取临时访问链接失败");
        return Err(format_user_error(
            "GetObjectsUploadInfo",
            status.as_u16(),
            &text,
        ));
    }

    let items: Vec<UploadInfoResponseItem> = response
        .json()
        .map_err(|err| format!("解析临时访问链接响应失败: {err}"))?;

    let item = items
        .into_iter()
        .next()
        .ok_or_else(|| "临时访问链接响应为空".to_string())?;

    if let Some(message) = item.message {
        let code = item.code.as_deref().unwrap_or("UNKNOWN");
        error!(code, %message, "获取临时访问链接业务错误");
        return Err(format_user_error(
            "GetObjectsUploadInfo",
            404,
            &serde_json::json!({ "code": code, "message": message }).to_string(),
        ));
    }

    item.download_url
        .map(|url| normalize_download_url(&url))
        .ok_or_else(|| "图片不存在或已被删除".to_string())
}

#[instrument(skip(), fields(prefix = ?prefix, path = %local_path.display()))]
pub fn upload_local_image_as_webp(
    local_path: &Path,
    prefix: Option<&str>,
) -> Result<UploadImageResult, String> {
    let client = CloudClient::from_env()?;
    let original_name = local_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("image")
        .to_string();

    let webp_bytes = convert_to_webp(local_path)?;
    debug!(webp_bytes = webp_bytes.len(), "WebP 转换完成");
    ensure_webp_within_limit(&webp_bytes)?;
    let cloud_path = build_cloud_path(prefix, &original_name);
    let upload_info = get_upload_info(&client, &cloud_path)?;

    put_object(
        &upload_info.upload_url,
        &upload_info.authorization,
        &upload_info.token,
        &upload_info.cloud_object_meta,
        &webp_bytes,
        "image/webp",
    )?;

    let file_id = upload_info
        .cloud_object_id
        .clone()
        .unwrap_or_else(|| format!("cloud://{}.{cloud_path}", client.config().env_id));
    info!(%cloud_path, %file_id, "本地图片上传完成");

    Ok(UploadImageResult {
        file_id,
        cloud_path,
        download_url: upload_info.download_url,
        original_name,
    })
}

struct ResolvedUploadInfo {
    upload_url: String,
    authorization: String,
    token: String,
    cloud_object_meta: String,
    cloud_object_id: Option<String>,
    download_url: Option<String>,
}

fn get_upload_info(client: &CloudClient, cloud_path: &str) -> Result<ResolvedUploadInfo, String> {
    let body = serde_json::to_string(&vec![UploadInfoRequestItem {
        object_id: cloud_path.to_string(),
    }])
    .map_err(|err| err.to_string())?;

    let upload_url = client.gateway_url(UPLOAD_INFO_PATH);
    info!(url = %upload_url, cloud_path, body = %body, "请求上传凭证");
    let response = client.post_json(UPLOAD_INFO_PATH, UPLOAD_ACTION, &body)?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        error!(url = %upload_url, %status, response = %text, "获取上传凭证失败");
        return Err(format_user_error(UPLOAD_ACTION, status.as_u16(), &text));
    }

    let items: Vec<UploadInfoResponseItem> = response
        .json()
        .map_err(|err| format!("解析上传凭证失败: {err}"))?;

    let item = items
        .into_iter()
        .next()
        .ok_or_else(|| "上传凭证响应为空".to_string())?;

    if let Some(message) = item.message {
        error!(code = ?item.code, %message, "上传凭证业务错误");
        let code = item.code.as_deref().unwrap_or("UNKNOWN");
        return Err(format_user_error(
            UPLOAD_ACTION,
            400,
            &serde_json::json!({ "code": code, "message": message }).to_string(),
        ));
    }

    info!(cloud_path, "上传凭证获取成功");

    let cos_upload_url = item.upload_url.ok_or("缺少 uploadUrl")?;
    info!(url = %cos_upload_url, "获得 COS 上传地址");

    Ok(ResolvedUploadInfo {
        upload_url: cos_upload_url,
        authorization: item.authorization.ok_or("缺少 authorization")?,
        token: item.token.ok_or("缺少 token")?,
        cloud_object_meta: item.cloud_object_meta.ok_or("缺少 cloudObjectMeta")?,
        cloud_object_id: item.cloud_object_id,
        download_url: item.download_url.map(|url| normalize_download_url(&url)),
    })
}

fn put_object(
    upload_url: &str,
    authorization: &str,
    token: &str,
    cloud_object_meta: &str,
    bytes: &[u8],
    content_type: &str,
) -> Result<(), String> {
    info!(method = "PUT", url = %upload_url, bytes = bytes.len(), ">>> 上传对象到 COS");
    let response = reqwest::blocking::Client::new()
        .put(upload_url)
        .header(AUTHORIZATION, authorization)
        .header("X-Cos-Security-Token", token)
        .header("X-Cos-Meta-Fileid", cloud_object_meta)
        .header("Content-Type", content_type)
        .body(bytes.to_vec())
        .send()
        .map_err(|err| {
            error!(method = "PUT", url = %upload_url, error = %err, "COS 网络请求失败");
            "图片上传失败，请检查网络后重试".to_string()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().unwrap_or_default();
        error!(method = "PUT", url = %upload_url, %status, response = %text, "COS 上传失败");
        return Err(format_user_error("上传图片", status.as_u16(), &text));
    }

    info!(method = "PUT", url = %upload_url, bytes = bytes.len(), "<<< COS 上传成功");
    Ok(())
}

fn build_cloud_path(prefix: Option<&str>, original_name: &str) -> String {
    build_media_cloud_path(prefix, original_name, "webp")
}

fn build_media_cloud_path(prefix: Option<&str>, original_name: &str, extension: &str) -> String {
    let stem = Path::new(original_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("media");
    let safe_stem: String = stem
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let id = uuid::Uuid::new_v4().simple().to_string();
    let base = prefix.unwrap_or("projects/uploads").trim_matches('/');
    let ext = extension.trim_start_matches('.');
    format!("{base}/{safe_stem}-{id}.{ext}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delete_request_uses_cloud_object_id() {
        let body = serde_json::to_string(&vec![DeleteObjectRequestItem {
            cloud_object_id: "cloud://env-id/media/foo.webp".to_string(),
        }])
        .unwrap();
        assert_eq!(
            body,
            r#"[{"cloudObjectId":"cloud://env-id/media/foo.webp"}]"#
        );
    }

    #[test]
    fn storage_file_nonexist_is_treated_as_missing() {
        assert!(is_storage_object_missing(
            400,
            "STORAGE_FILE_NONEXIST",
            "Storage file not exists."
        ));
    }

    #[test]
    fn normalize_download_url_decodes_json_ampersand_escape() {
        let raw = r"https://host.tcb.qcloud.la/path/file.mp4?sign=abc\u0026t=123";
        assert_eq!(
            normalize_download_url(raw),
            "https://host.tcb.qcloud.la/path/file.mp4?sign=abc&t=123"
        );
    }

    #[test]
    fn serde_json_already_decodes_u0026_in_download_url() {
        let json = r#"[{"downloadUrl":"https://host/path?sign=abc\u0026t=1"}]"#;
        let items: Vec<UploadInfoResponseItem> = serde_json::from_str(json).unwrap();
        assert_eq!(
            items[0].download_url.as_deref(),
            Some("https://host/path?sign=abc&t=1")
        );
        assert_eq!(
            normalize_download_url(items[0].download_url.as_deref().unwrap()),
            "https://host/path?sign=abc&t=1"
        );
    }
}

/// 真机探测：GetObjectsUploadInfo → downloadUrl → HTTP GET。
/// 运行：`cd admin/src-tauri && ADMIN_BUILD_ENV=test cargo test probe_storage_download_url -- --ignored --nocapture`
/// 指定 fileID：`PROBE_FILE_ID='cloud://...' ADMIN_BUILD_ENV=development cargo test probe_storage_download_url -- --ignored --nocapture`
#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::cloud::database::list_media_files;
    use crate::cloud::env_files::load_dotenv_for_slug;
    use crate::cloud::client::CloudClient;

    fn load_probe_env() -> String {
        let slug = std::env::var("ADMIN_BUILD_ENV")
            .or_else(|_| std::env::var("PROBE_ENV"))
            .unwrap_or_else(|_| "test".to_string())
            .trim()
            .to_ascii_lowercase();
        load_dotenv_for_slug(&slug).unwrap_or_else(|err| panic!("加载 .env.{slug} 失败: {err}"));
        slug
    }

    fn probe_reference(client: &CloudClient, reference: &str) {
        let object_id = object_id_from_reference(reference).unwrap_or_default();
        println!("\n--- reference ---\n{reference}");
        println!("object_id: {object_id}");

        let body = serde_json::to_string(&vec![UploadInfoRequestItem {
            object_id: object_id.clone(),
        }])
        .unwrap();
        let response = client
            .post_json(UPLOAD_INFO_PATH, UPLOAD_ACTION, &body)
            .unwrap_or_else(|err| panic!("GetObjectsUploadInfo 请求失败: {err}"));
        let status = response.status();
        let raw = response.text().unwrap_or_default();
        println!("GetObjectsUploadInfo HTTP {status}");
        println!("raw JSON（& 会显示为 \\u0026，浏览器请用下方 downloadUrl）: {raw}");

        match get_download_url_for_client(client, reference) {
            Ok(download_url) => {
                println!("downloadUrl: {download_url}");
                let get = reqwest::blocking::Client::new().get(&download_url).send();
                match get {
                    Ok(resp) => {
                        let get_status = resp.status();
                        let len = resp.content_length().unwrap_or(0);
                        println!("GET downloadUrl => HTTP {get_status}, Content-Length={len}");
                    }
                    Err(err) => println!("GET downloadUrl 失败: {err}"),
                }
            }
            Err(err) => println!("解析 downloadUrl 失败: {err}"),
        }
    }

    #[test]
    #[ignore = "需要网络与根目录 .env.*"]
    fn probe_storage_download_url() {
        let slug = load_probe_env();
        let client = CloudClient::from_env().expect("CloudClient::from_env");
        println!("env slug={slug}, env_id={}", client.config().env_id);

        if let Ok(reference) = std::env::var("PROBE_FILE_ID") {
            let reference = reference.trim();
            if !reference.is_empty() {
                probe_reference(&client, reference);
                return;
            }
        }

        let records = list_media_files(3, 0).expect("list_media_files");
        assert!(
            !records.is_empty(),
            "media_files 集合为空，请设置 PROBE_FILE_ID 或先上传媒体"
        );
        for record in records {
            probe_reference(&client, &record.file_id);
        }
    }
}
