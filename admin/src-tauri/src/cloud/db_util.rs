use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use tracing::info;

use super::client::{ensure_success, CloudClient};
use crate::config::build_sorted_query;

pub const DB_BASE: &str = "/v1/database/instances/(default)/databases/(default)";

pub fn collection_documents_path(collection: &str) -> String {
    format!("{DB_BASE}/collections/{collection}/documents")
}

pub fn document_path(collection: &str, id: &str) -> String {
    format!("{DB_BASE}/collections/{collection}/documents/{id}")
}

pub fn query_documents_paged(
    client: &CloudClient,
    collection: &str,
    where_clause: Option<Value>,
    limit: u32,
    offset: u32,
) -> Result<Value, String> {
    let query = match &where_clause {
        None => "{}".to_string(),
        Some(filter) => serde_json::to_string(filter).map_err(|err| err.to_string())?,
    };
    let query_string = build_sorted_query(&[
        ("limit", &limit.to_string()),
        ("offset", &offset.to_string()),
        ("query", &query),
    ]);
    let path = format!("{}?{query_string}", collection_documents_path(collection));
    let url = client.gateway_url(&path);
    info!(collection, url = %url, "分页查询文档");
    let response = client.get(&path, "QueryDocuments")?;
    ensure_success(response, "查询文档", &url)
}

pub fn list_all_collections(client: &CloudClient) -> Result<Vec<String>, String> {
    let mut names = std::collections::BTreeSet::new();
    let mut offset = 0u32;
    const LIMIT: u32 = 100;

    loop {
        let query_string = build_sorted_query(&[
            ("limit", &LIMIT.to_string()),
            ("offset", &offset.to_string()),
        ]);
        let path = format!("{DB_BASE}/collections?{query_string}");
        let url = client.gateway_url(&path);
        info!(url = %url, "列出数据库集合");
        let response = client.get(&path, "ListCollections")?;
        let value = ensure_success(response, "列出集合", &url)?;
        let batch = parse_collection_names(&value);
        let count = batch.len();
        for name in batch {
            names.insert(name);
        }
        if count < LIMIT as usize {
            break;
        }
        offset += LIMIT;
    }

    Ok(names.into_iter().collect())
}

pub fn query_documents(
    client: &CloudClient,
    collection: &str,
    where_clause: Option<Value>,
    limit: u32,
    offset: u32,
) -> Result<Value, String> {
    let order = json!([{ "field": "sort", "direction": "asc" }]);
    // Gateway：条件直接作为 query JSON（如 {"categoryId":"x"}），不要包一层 where
    let query = match &where_clause {
        None => "{}".to_string(),
        Some(filter) => serde_json::to_string(filter).map_err(|err| err.to_string())?,
    };
    let order_str = serde_json::to_string(&order).map_err(|err| err.to_string())?;
    let query_string = build_sorted_query(&[
        ("limit", &limit.to_string()),
        ("offset", &offset.to_string()),
        ("order", &order_str),
        ("query", &query),
    ]);
    let path = format!("{}?{query_string}", collection_documents_path(collection));
    let url = client.gateway_url(&path);
    info!(collection, url = %url, "查询文档列表");
    let response = client.get(&path, "QueryDocuments")?;
    ensure_success(response, "查询文档", &url)
}

pub fn get_document(client: &CloudClient, collection: &str, id: &str) -> Result<Value, String> {
    let path = document_path(collection, id);
    let url = client.gateway_url(&path);
    info!(collection, document_id = %id, url = %url, "查询单条文档");
    let response = client.get(&path, "GetDocument")?;
    ensure_success(response, "查询文档", &url)
}

pub fn insert_document(
    client: &CloudClient,
    collection: &str,
    document: Value,
) -> Result<String, String> {
    let path = collection_documents_path(collection);
    let url = client.gateway_url(&path);
    let body =
        serde_json::to_string(&json!({ "data": [document] })).map_err(|err| err.to_string())?;
    info!(collection, url = %url, "插入文档");
    let response = client.post_json(&path, "InsertDocument", &body)?;
    let value = ensure_success(response, "插入文档", &url)?;
    extract_inserted_id(&value).ok_or_else(|| "插入成功但未返回文档 ID".to_string())
}

pub fn update_document(
    client: &CloudClient,
    collection: &str,
    id: &str,
    patch: Value,
) -> Result<(), String> {
    let path = document_path(collection, id);
    let url = client.gateway_url(&path);
    let body = serde_json::to_string(&json!({ "data": { "$set": patch } }))
        .map_err(|err| err.to_string())?;
    info!(collection, document_id = %id, url = %url, "更新文档");
    let response = client.patch_json(&path, "UpdateDocument", &body)?;
    ensure_success(response, "更新文档", &url)?;
    Ok(())
}

pub fn delete_document(client: &CloudClient, collection: &str, id: &str) -> Result<(), String> {
    let path = document_path(collection, id);
    let url = client.gateway_url(&path);
    info!(collection, document_id = %id, url = %url, "删除文档");
    let response = client.delete(&path, "DeleteDocument")?;
    ensure_success(response, "删除文档", &url)?;
    Ok(())
}

pub fn parse_document_list<T>(value: &Value) -> Result<Vec<T>, String>
where
    T: DeserializeOwned,
{
    let items = value
        .pointer("/data/list")
        .or_else(|| value.get("list"))
        .or_else(|| value.get("documents"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut records = Vec::with_capacity(items.len());
    for item in items {
        let doc = normalize_document_item(item);
        let record: T =
            serde_json::from_value(doc).map_err(|err| format!("解析文档失败: {err}"))?;
        records.push(record);
    }
    Ok(records)
}

pub fn parse_single_document<T>(value: &Value) -> Result<Option<T>, String>
where
    T: DeserializeOwned,
{
    if let Some(data) = value.get("data") {
        if data.is_null() {
            return Ok(None);
        }
        if let Ok(record) = serde_json::from_value::<T>(normalize_document_item(data.clone())) {
            return Ok(Some(record));
        }
    }

    if let Ok(record) = serde_json::from_value::<T>(normalize_document_item(value.clone())) {
        return Ok(Some(record));
    }

    Ok(None)
}

pub fn normalize_document_item(item: Value) -> Value {
    if item.is_string() {
        return serde_json::from_str(item.as_str().unwrap_or_default()).unwrap_or(item);
    }

    let mut doc = item;
    if let Some(id) = doc.get("_id").and_then(parse_ejson_id) {
        doc["id"] = json!(id);
    }
    doc
}

pub fn extract_inserted_id(value: &Value) -> Option<String> {
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

pub fn parse_ejson_id(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }
    value
        .get("$oid")
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

pub fn parse_ejson_date(value: &Value) -> Option<String> {
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

pub fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn json_string_field(value: &Option<String>) -> Value {
    match value {
        Some(text) if !text.is_empty() => json!(text),
        _ => Value::Null,
    }
}

pub fn omit_null(mut value: Value) -> Value {
    if let Value::Object(map) = &mut value {
        map.retain(|_, v| !v.is_null());
    }
    value
}

pub fn build_document<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|err| err.to_string())
}

fn parse_collection_names(value: &Value) -> Vec<String> {
    extract_collection_items(value)
        .iter()
        .filter_map(collection_name_from_item)
        .collect()
}

fn extract_collection_items(value: &Value) -> Vec<Value> {
    for candidate in [
        value.get("collections"),
        value.pointer("/data/collections"),
        value.get("list"),
        value.pointer("/data/list"),
        value.get("data").filter(|item| item.is_array()),
    ]
    .into_iter()
    .flatten()
    {
        if let Some(items) = candidate.as_array() {
            return items.clone();
        }
    }
    Vec::new()
}

fn collection_name_from_item(item: &Value) -> Option<String> {
    if let Some(text) = item.as_str() {
        let name = text.trim();
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    item.get("name")
        .or_else(|| item.get("collectionName"))
        .or_else(|| item.get("CollectionName"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
}
