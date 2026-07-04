use serde_json::json;
use tracing::info;

use super::api_error::format_user_error;
use super::client::CloudClient;
use super::db_util::DB_BASE;
use super::{
    CATEGORIES_COLLECTION, MATERIAL_CARDS_COLLECTION, MATERIAL_DETAILS_COLLECTION,
    MEDIA_FILES_COLLECTION, PROJECTS_COLLECTION,
};

const ALL_COLLECTIONS: &[&str] = &[
    CATEGORIES_COLLECTION,
    PROJECTS_COLLECTION,
    MATERIAL_CARDS_COLLECTION,
    MATERIAL_DETAILS_COLLECTION,
    MEDIA_FILES_COLLECTION,
    super::HOME_SETTINGS_COLLECTION,
];

/// 确保集合存在（已存在则跳过）
fn ensure_all_collections_for(client: &CloudClient) -> Result<(), String> {
    for name in ALL_COLLECTIONS {
        ensure_collection(client, name)?;
    }
    info!("云数据库集合检查完成");
    Ok(())
}

/// 集合不存在则创建；已存在则忽略
pub fn ensure_collection(client: &CloudClient, collection_name: &str) -> Result<(), String> {
    let path = format!("{DB_BASE}/collections");
    let body = serde_json::to_string(&json!({ "collectionName": collection_name }))
        .map_err(|err| err.to_string())?;
    let url = client.gateway_url(&path);
    let response = client.post_json(&path, "CreateCollection", &body)?;
    let status = response.status();

    if status.is_success() {
        info!(collection = collection_name, url = %url, "集合已创建");
        return Ok(());
    }

    let text = response.text().unwrap_or_default();
    if is_collection_exists_error(status.as_u16(), &text) {
        info!(collection = collection_name, "集合已存在");
        return Ok(());
    }

    Err(format_user_error(
        "CreateCollection",
        status.as_u16(),
        &text,
    ))
}

fn is_collection_exists_error(status: u16, text: &str) -> bool {
    status == 409
        || text.contains("DATABASE_COLLECTION_ALREADY_EXIST")
        || text.contains("ALREADY_EXIST")
        || text.contains("already exist")
}

/// 建集合（由 `ensure_database` 命令手动触发）
pub fn bootstrap_database() -> Result<(), String> {
    bootstrap_database_with_client(&CloudClient::from_env()?)
}

/// 按环境 slug 初始化（`development` / `test` / `production`），直接读项目根 `.env.*`。
pub fn bootstrap_database_for_slug(slug: &str) -> Result<(), String> {
    bootstrap_database_with_client(&crate::cloud::env_files::client_for_slug(slug)?)
}

fn bootstrap_database_with_client(client: &CloudClient) -> Result<(), String> {
    ensure_all_collections_for(client)
}
