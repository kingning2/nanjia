use std::collections::BTreeSet;

use serde_json::Value;

use crate::cloud::client::CloudClient;
use crate::cloud::database::{delete_media_files_by_file_id_for_client, MediaFileRecord};
use crate::cloud::db_util::{normalize_document_item, query_documents};
use crate::cloud::storage::{delete_storage_reference_for_client, object_id_from_reference};
use crate::local::env_profile::get_profile;

use super::refs::collect_media_refs;
use super::types::{
    MediaCleanupResult, MediaRedundancyItem, MediaRedundancyReport, CONTENT_COLLECTIONS,
};

const LIST_LIMIT: u32 = 1000;

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

    for item in &unused {
        let kind = media_kind(&item.mime_type);
        if kind == "video" {
            unused_video_count += 1;
        } else {
            unused_image_count += 1;
        }
        if unused_items.len() < 40 {
            unused_items.push(MediaRedundancyItem {
                file_id: item.file_id.clone(),
                original_name: item.original_name.clone(),
                cloud_path: resolve_cloud_path(&item.cloud_path, &item.file_id),
                mime_type: item.mime_type.clone(),
                kind: kind.to_string(),
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

    for collection in CONTENT_COLLECTIONS {
        let value = query_documents(client, collection, None, LIST_LIMIT, 0)?;
        let docs = parse_raw_document_list(&value);
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

