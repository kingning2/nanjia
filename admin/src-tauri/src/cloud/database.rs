use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{error, info, instrument};

use super::client::{ensure_success, CloudClient};
use super::db_util::{delete_document, query_documents};
use super::MEDIA_FILES_COLLECTION;
use crate::config::build_sorted_query;

const DB_BASE: &str = "/v1/database/instances/(default)/databases/(default)";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFileRecord {
    pub id: String,
    #[serde(rename = "fileID")]
    pub file_id: String,
    pub cloud_path: String,
    pub download_url: Option<String>,
    pub original_name: String,
    pub mime_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMediaFileInput {
    #[serde(rename = "fileID")]
    pub file_id: String,
    pub cloud_path: String,
    pub download_url: Option<String>,
    pub original_name: String,
    pub mime_type: String,
}

#[instrument(skip(input), fields(file_id = %input.file_id, cloud_path = %input.cloud_path, original_name = %input.original_name))]
pub fn save_media_file(input: SaveMediaFileInput) -> Result<MediaFileRecord, String> {
    let client = CloudClient::from_env()?;
    save_media_file_for_client(&client, input)
}

/// 与日常上传一致：写入目标环境的 `media_files` 集合（fileID 已存在则跳过）
pub fn save_media_file_for_client(
    client: &CloudClient,
    input: SaveMediaFileInput,
) -> Result<MediaFileRecord, String> {
    let trimmed_id = input.file_id.trim();
    if !trimmed_id.is_empty() {
        let filter = json!({ "fileID": trimmed_id });
        let existing = query_documents(client, MEDIA_FILES_COLLECTION, Some(filter), 1, 0)?;
        let records = parse_media_list(&existing)?;
        if let Some(record) = records.into_iter().next() {
            return Ok(record);
        }
    }

    let created_at = Utc::now().to_rfc3339();
    let document = json!({
        "fileID": input.file_id,
        "cloudPath": input.cloud_path,
        "downloadUrl": input.download_url,
        "originalName": input.original_name,
        "mimeType": input.mime_type,
        "createdAt": created_at,
    });

    let path = format!("{DB_BASE}/collections/{MEDIA_FILES_COLLECTION}/documents");
    let url = client.gateway_url(&path);
    let body =
        serde_json::to_string(&json!({ "data": [document] })).map_err(|err| err.to_string())?;
    info!(url = %url, body = %body, "准备插入 media_files 文档");

    let response = client.post_json(&path, "InsertDocument", &body)?;
    let value = ensure_success(response, "保存媒体记录", &url)?;

    let id =
        extract_inserted_id(&value).unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());
    info!(document_id = %id, url = %url, "媒体记录已写入云数据库");

    Ok(MediaFileRecord {
        id,
        file_id: input.file_id,
        cloud_path: input.cloud_path,
        download_url: input.download_url,
        original_name: input.original_name,
        mime_type: input.mime_type,
        created_at,
    })
}

#[instrument(fields(limit, skip_count = skip))]
pub fn list_media_files(limit: u32, skip: u32) -> Result<Vec<MediaFileRecord>, String> {
    let client = CloudClient::from_env()?;
    list_media_files_for_client(&client, limit, skip)
}

pub fn list_media_files_for_client(
    client: &CloudClient,
    limit: u32,
    skip: u32,
) -> Result<Vec<MediaFileRecord>, String> {
    let order = serde_json::to_string(&[json!({ "field": "createdAt", "direction": "desc" })])
        .map_err(|err| err.to_string())?;
    let query = build_sorted_query(&[
        ("limit", &limit.to_string()),
        ("offset", &skip.to_string()),
        ("order", &order),
        ("query", "{}"),
    ]);
    let path = format!("{DB_BASE}/collections/{MEDIA_FILES_COLLECTION}/documents?{query}");
    let url = client.gateway_url(&path);
    info!(url = %url, "查询 media_files");

    let response = client.get(&path, "QueryDocuments")?;
    let value = ensure_success(response, "查询媒体记录", &url)?;
    let records = parse_media_list(&value)?;
    info!(count = records.len(), url = %url, "媒体记录查询完成");
    Ok(records)
}

/// 按 fileID 删除媒体库记录（不存在时视为成功）
pub fn delete_media_files_by_file_id(file_id: &str) -> Result<(), String> {
    let client = CloudClient::from_env()?;
    delete_media_files_by_file_id_for_client(&client, file_id)
}

pub fn delete_media_files_by_file_id_for_client(
    client: &CloudClient,
    file_id: &str,
) -> Result<(), String> {
    let trimmed = file_id.trim();
    if trimmed.is_empty() {
        return Ok(());
    }

    let filter = json!({ "fileID": trimmed });
    let value = query_documents(client, MEDIA_FILES_COLLECTION, Some(filter), 100, 0)?;

    let items = value
        .pointer("/data/list")
        .or_else(|| value.get("list"))
        .or_else(|| value.get("documents"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if items.is_empty() {
        return Ok(());
    }

    for item in items {
        let doc = if item.is_string() {
            serde_json::from_str(item.as_str().unwrap_or_default()).unwrap_or(item)
        } else {
            item
        };
        let id = doc
            .get("_id")
            .and_then(parse_ejson_id)
            .or_else(|| doc.get("id").and_then(|v| v.as_str()).map(str::to_string));
        if let Some(document_id) = id {
            delete_document(client, MEDIA_FILES_COLLECTION, &document_id)?;
        }
    }

    Ok(())
}

fn extract_inserted_id(value: &Value) -> Option<String> {
    if let Some(id) = value.get("_id").and_then(parse_ejson_id) {
        return Some(id);
    }
    if let Some(ids) = value
        .pointer("/data/insertedIds")
        .and_then(|v| v.as_array())
    {
        if let Some(first) = ids.first() {
            return first
                .as_str()
                .map(str::to_string)
                .or_else(|| parse_ejson_id(first));
        }
    }
    if let Some(ids) = value.get("insertedIds").and_then(|v| v.as_array()) {
        if let Some(first) = ids.first() {
            return first
                .as_str()
                .map(str::to_string)
                .or_else(|| parse_ejson_id(first));
        }
    }
    if let Some(id) = value.get("id").and_then(|v| v.as_str()) {
        return Some(id.to_string());
    }
    None
}

fn parse_media_list(value: &Value) -> Result<Vec<MediaFileRecord>, String> {
    let mut records = Vec::new();

    let items = value
        .pointer("/data/list")
        .or_else(|| value.get("list"))
        .or_else(|| value.get("documents"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if items.is_empty() && value.is_array() {
        return parse_media_list(&json!({ "list": value }));
    }

    for item in items {
        let doc = if item.is_string() {
            serde_json::from_str(item.as_str().unwrap_or_default()).unwrap_or(item)
        } else {
            item
        };
        if let Some(record) = map_document_to_record(&doc) {
            records.push(record);
        } else {
            error!(doc = %doc, "跳过无法解析的媒体记录");
        }
    }

    Ok(records)
}

fn map_document_to_record(doc: &Value) -> Option<MediaFileRecord> {
    let id = doc
        .get("_id")
        .and_then(parse_ejson_id)
        .or_else(|| doc.get("id").and_then(|v| v.as_str()).map(str::to_string))?;

    Some(MediaFileRecord {
        id,
        file_id: doc
            .get("fileID")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        cloud_path: doc
            .get("cloudPath")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        download_url: doc
            .get("downloadUrl")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        original_name: doc
            .get("originalName")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        mime_type: doc
            .get("mimeType")
            .and_then(|v| v.as_str())
            .unwrap_or("image/webp")
            .to_string(),
        created_at: doc
            .get("createdAt")
            .and_then(parse_ejson_date)
            .unwrap_or_default(),
    })
}

fn parse_ejson_id(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }
    value
        .get("$oid")
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

fn parse_ejson_date(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }
    if let Some(ms) = value.pointer("/$date/$numberLong").and_then(|v| v.as_str()) {
        if let Ok(timestamp) = ms.parse::<i64>() {
            if let Some(dt) = chrono::DateTime::from_timestamp_millis(timestamp) {
                return Some(dt.to_rfc3339());
            }
        }
    }
    None
}

#[cfg(test)]
mod live_tests {
    use super::list_media_files;
    use crate::cloud::client::CloudClient;

    #[test]
    #[ignore = "需要网络与 admin/.env"]
    fn list_media_files_live() {
        let _ = dotenvy::from_filename("../.env");
        match list_media_files(50, 0) {
            Ok(list) => println!("ok count={}", list.len()),
            Err(err) => panic!("{err}"),
        }
    }

    #[test]
    #[ignore = "需要网络与 admin/.env"]
    fn probe_db_auth() {
        let _ = dotenvy::from_filename("../.env");
        let client = CloudClient::from_env().unwrap();
        let base = "/v1/database/instances/(default)/databases/(default)/collections/media_files/documents";
        let cases: [(&str, String, &str, &str, &str); 3] = [
            (
                "GET simple",
                format!("{base}?limit=1&offset=0"),
                "GET",
                "QueryDocuments",
                "",
            ),
            ("GET noquery", base.to_string(), "GET", "QueryDocuments", ""),
            (
                "POST insert",
                base.to_string(),
                "POST",
                "InsertDocument",
                r#"{"data":[{"fileID":"x","cloudPath":"x","originalName":"x","mimeType":"image/webp","createdAt":"2026-01-01T00:00:00Z"}]}"#,
            ),
        ];
        for (name, path, method, action, body) in cases {
            let resp = if method == "GET" {
                client.get(&path, action)
            } else {
                client.post_json(&path, action, body)
            };
            match resp {
                Ok(r) => {
                    let s = r.status();
                    let t = r.text().unwrap_or_default();
                    let preview = if t.len() > 160 {
                        let mut end = 160;
                        while end > 0 && !t.is_char_boundary(end) {
                            end -= 1;
                        }
                        &t[..end]
                    } else {
                        &t
                    };
                    println!("{name}: HTTP {s} {preview}");
                }
                Err(e) => println!("{name}: ERR {e}"),
            }
        }
    }
}
