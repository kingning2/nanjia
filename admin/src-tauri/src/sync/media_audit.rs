use std::collections::BTreeSet;

use serde_json::Value;
use tracing::warn;

use crate::cloud::client::CloudClient;
use crate::cloud::database::{delete_media_files_by_file_id_for_client, MediaFileRecord};
use crate::cloud::db_util::{
    list_all_collections, normalize_document_item, query_documents, query_documents_paged,
};
use crate::cloud::storage::{delete_storage_reference_for_client, object_id_from_reference};
use crate::cloud::{
    CATEGORIES_COLLECTION, HOME_SETTINGS_COLLECTION, MATERIAL_CARDS_COLLECTION,
    MATERIAL_DETAILS_COLLECTION, MEDIA_FILES_COLLECTION, PROJECTS_COLLECTION,
};
use crate::local::env_profile::get_profile;

use super::refs::collect_media_refs;
use super::types::{MediaCleanupResult, MediaRedundancyItem, MediaRedundancyReport};

const LIST_LIMIT: u32 = 1000;

const FALLBACK_SCAN_COLLECTIONS: &[&str] = &[
    CATEGORIES_COLLECTION,
    PROJECTS_COLLECTION,
    MATERIAL_CARDS_COLLECTION,
    MATERIAL_DETAILS_COLLECTION,
    HOME_SETTINGS_COLLECTION,
];

pub fn analyze_media_redundancy(profile_id: &str) -> Result<MediaRedundancyReport, String> {
    let profile = get_profile(profile_id)?.ok_or_else(|| "环境不存在".to_string())?;
    let client = CloudClient::from_profile(&profile)?;

    let (referenced_keys, referenced_raw, library) = scan_media_usage(&client)?;
    let valid_library: Vec<_> = library
        .iter()
        .filter(|item| is_valid_media_record(item))
        .collect();
    let library_count = valid_library.len() as u32;
    let referenced_count = referenced_raw.len() as u32;

    let unused: Vec<_> = filter_unused_media(&valid_library, &referenced_keys, &referenced_raw);
    let mut unused_items = Vec::new();
    let mut unused_image_count = 0u32;
    let mut unused_video_count = 0u32;
    let mut safe_unused_count = 0u32;
    let mut suspect_unused_count = 0u32;

    for item in &unused {
        let kind = media_kind(&item.mime_type);
        if kind == "video" {
            unused_video_count += 1;
        } else {
            unused_image_count += 1;
        }
        let cloud_path = resolve_cloud_path(&item.cloud_path, &item.file_id);
        let reference_hits = find_raw_reference_hits(&client, &item.file_id, &cloud_path);
        if reference_hits.is_empty() {
            safe_unused_count += 1;
        } else {
            suspect_unused_count += 1;
        }
        if unused_items.len() < 40 {
            unused_items.push(MediaRedundancyItem {
                file_id: item.file_id.clone(),
                original_name: item.original_name.clone(),
                cloud_path,
                mime_type: item.mime_type.clone(),
                kind: kind.to_string(),
                safe_to_delete: reference_hits.is_empty(),
                reference_hits,
            });
        }
    }

    let library_keys: BTreeSet<String> = valid_library
        .iter()
        .map(|item| media_match_key(&item.file_id))
        .collect();
    let stale_reference_count = referenced_raw
        .iter()
        .filter(|reference| !library_keys.contains(&media_match_key(reference)))
        .count() as u32;

    Ok(MediaRedundancyReport {
        profile_id: profile_id.to_string(),
        env_name: profile.name,
        referenced_count,
        library_count,
        unused_count: unused_image_count + unused_video_count,
        unused_image_count,
        unused_video_count,
        stale_reference_count,
        safe_unused_count,
        suspect_unused_count,
        unused_items,
    })
}

/// 删除当前环境中未被内容引用的媒体（删除前会重新扫描，避免误删）
pub fn delete_unused_media(profile_id: &str) -> Result<MediaCleanupResult, String> {
    let profile = get_profile(profile_id)?.ok_or_else(|| "环境不存在".to_string())?;
    let client = CloudClient::from_profile(&profile)?;

    let (referenced_keys, referenced_raw, library) = scan_media_usage(&client)?;
    let (invalid, valid): (Vec<_>, Vec<_>) = library
        .into_iter()
        .partition(|item| !is_valid_media_record(item));

    let mut deleted_count = 0u32;
    let mut errors = Vec::new();

    for item in invalid {
        match delete_media_files_by_file_id_for_client(&client, &item.file_id) {
            Ok(()) => deleted_count += 1,
            Err(err) => errors.push(format!("无效登记 {}: {err}", item.file_id)),
        }
    }

    let valid_refs: Vec<_> = valid.iter().collect();
    let unused = filter_unused_media(&valid_refs, &referenced_keys, &referenced_raw);

    for item in unused {
        let label = resolve_cloud_path(&item.cloud_path, &item.file_id);
        let hits = find_raw_reference_hits(&client, &item.file_id, &label);
        if !hits.is_empty() {
            errors.push(format!("{label}: 数据库仍有疑似引用，已跳过"));
            continue;
        }
        match delete_storage_reference_for_client(&client, &item.file_id) {
            Ok(()) => deleted_count += 1,
            Err(err) => errors.push(format!("{label}: {err}")),
        }
    }

    Ok(MediaCleanupResult {
        deleted_count,
        failed_count: errors.len() as u32,
        errors,
    })
}

fn scan_media_usage(
    client: &CloudClient,
) -> Result<(BTreeSet<String>, BTreeSet<String>, Vec<MediaFileRecord>), String> {
    let mut referenced_keys = BTreeSet::new();
    let mut referenced_raw = BTreeSet::new();

    for collection in resolve_scan_collections(client) {
        // media_files 是媒体库登记，不是业务内容引用
        if collection == MEDIA_FILES_COLLECTION {
            continue;
        }
        let docs = match list_all_documents(client, &collection) {
            Ok(docs) => docs,
            Err(err) => {
                warn!(collection = %collection, error = %err, "扫描集合失败，跳过");
                continue;
            }
        };
        for doc in docs {
            for reference in collect_media_refs(&doc) {
                referenced_raw.insert(reference.clone());
                referenced_keys.insert(media_match_key(&reference));
            }
        }
    }

    let library = list_all_media_files(client)?;
    Ok((referenced_keys, referenced_raw, library))
}

fn resolve_scan_collections(client: &CloudClient) -> Vec<String> {
    match list_all_collections(client) {
        Ok(names) if !names.is_empty() => names,
        Ok(_) => {
            warn!("ListCollections 返回空列表，使用内置集合列表");
            fallback_scan_collections()
        }
        Err(err) => {
            warn!(error = %err, "ListCollections 失败，使用内置集合列表");
            fallback_scan_collections()
        }
    }
}

fn fallback_scan_collections() -> Vec<String> {
    FALLBACK_SCAN_COLLECTIONS
        .iter()
        .map(|name| (*name).to_string())
        .collect()
}

fn list_all_documents(client: &CloudClient, collection: &str) -> Result<Vec<Value>, String> {
    list_all_documents_impl(client, collection, true).or_else(|ordered_err| {
        warn!(
            collection = %collection,
            error = %ordered_err,
            "按 sort 分页查询失败，尝试无排序查询"
        );
        list_all_documents_impl(client, collection, false)
    })
}

fn list_all_documents_impl(
    client: &CloudClient,
    collection: &str,
    ordered: bool,
) -> Result<Vec<Value>, String> {
    let mut all = Vec::new();
    let mut offset = 0u32;
    loop {
        let value = if ordered {
            query_documents(client, collection, None, LIST_LIMIT, offset)?
        } else {
            query_documents_paged(client, collection, None, LIST_LIMIT, offset)?
        };
        let docs = parse_raw_document_list(&value);
        let count = docs.len();
        all.extend(docs);
        if count < LIST_LIMIT as usize {
            break;
        }
        offset += LIST_LIMIT;
    }
    Ok(all)
}

fn filter_unused_media<'a>(
    library: &[&'a MediaFileRecord],
    referenced_keys: &BTreeSet<String>,
    referenced_raw: &BTreeSet<String>,
) -> Vec<&'a MediaFileRecord> {
    library
        .iter()
        .copied()
        .filter(|item| {
            let key = media_match_key(&item.file_id);
            !referenced_keys.contains(&key) && !referenced_raw.contains(&item.file_id)
        })
        .collect()
}

fn parse_raw_document_list(value: &Value) -> Vec<Value> {
    let items = value
        .pointer("/data/list")
        .or_else(|| value.get("list"))
        .or_else(|| value.get("documents"))
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    items.into_iter().map(normalize_document_item).collect()
}

fn list_all_media_files(client: &CloudClient) -> Result<Vec<MediaFileRecord>, String> {
    let mut all = Vec::new();
    let mut offset = 0u32;
    loop {
        let batch =
            crate::cloud::database::list_media_files_for_client(client, LIST_LIMIT, offset)?;
        let count = batch.len();
        all.extend(batch);
        if count < LIST_LIMIT as usize {
            break;
        }
        offset += LIST_LIMIT;
    }
    Ok(all)
}

fn media_match_key(reference: &str) -> String {
    object_id_from_reference(reference).unwrap_or_else(|| reference.trim().to_string())
}

fn media_kind(mime_type: &str) -> &'static str {
    if mime_type.starts_with("video/") {
        "video"
    } else {
        "image"
    }
}

fn resolve_cloud_path(cloud_path: &str, file_id: &str) -> String {
    let trimmed = cloud_path.trim();
    if !trimmed.is_empty() {
        return trimmed.to_string();
    }
    object_id_from_reference(file_id).unwrap_or_else(|| file_id.trim().to_string())
}

/// 排除 media_files 里的测试/脏数据（如 fileID、cloudPath 全是 "x"）
fn is_valid_media_record(item: &MediaFileRecord) -> bool {
    let file_id = item.file_id.trim();
    let path = resolve_cloud_path(&item.cloud_path, file_id);
    if file_id.starts_with("cloud://") && path.contains('/') {
        return true;
    }
    path.contains('/') && path.len() > 3
}

fn find_raw_reference_hits(
    client: &CloudClient,
    file_id: &str,
    cloud_path: &str,
) -> Vec<String> {
    let needles = build_verification_needles(file_id, cloud_path);
    if needles.is_empty() {
        return Vec::new();
    }

    let mut hits = Vec::new();
    for collection in resolve_scan_collections(client) {
        if collection == MEDIA_FILES_COLLECTION {
            continue;
        }
        let Ok(docs) = list_all_documents(client, &collection) else {
            continue;
        };
        for doc in docs {
            let doc_id = document_id_label(&doc);
            let mut strings = Vec::new();
            collect_string_values(&doc, &mut strings);
            for text in strings {
                if needles.iter().any(|needle| text.contains(needle.as_str())) {
                    hits.push(format!("{collection}/{doc_id}"));
                    if hits.len() >= 5 {
                        return hits;
                    }
                    break;
                }
            }
        }
    }
    hits
}

fn build_verification_needles(file_id: &str, cloud_path: &str) -> Vec<String> {
    let mut needles = BTreeSet::new();
    let trimmed_id = file_id.trim();
    if !trimmed_id.is_empty() {
        needles.insert(trimmed_id.to_string());
        if let Some(key) = object_id_from_reference(trimmed_id) {
            needles.insert(key);
        }
    }
    let path = cloud_path.trim();
    if !path.is_empty() {
        needles.insert(path.to_string());
        if let Some(filename) = path.rsplit('/').next() {
            needles.insert(filename.to_string());
            if let Some(hash) = filename.rsplit('-').next() {
                if hash.len() >= 16 {
                    needles.insert(hash.to_string());
                }
            }
        }
    }
    needles
        .into_iter()
        .filter(|needle| needle.len() >= 12)
        .collect()
}

fn collect_string_values(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::String(text) => out.push(text.clone()),
        Value::Array(items) => items.iter().for_each(|item| collect_string_values(item, out)),
        Value::Object(map) => map.values().for_each(|item| collect_string_values(item, out)),
        _ => {}
    }
}

fn document_id_label(doc: &Value) -> String {
    doc.get("id")
        .or_else(|| doc.get("_id"))
        .and_then(|value| value.as_str())
        .unwrap_or("unknown")
        .to_string()
}

