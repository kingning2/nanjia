use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::instrument;

use super::client::CloudClient;
use super::db_util::{
    build_document, delete_document, get_document, insert_document, json_string_field, now_rfc3339,
    omit_null, parse_document_list, parse_ejson_date, parse_ejson_id, parse_single_document,
    query_documents, update_document,
};
use super::{
    CATEGORIES_COLLECTION, HOME_SETTINGS_COLLECTION, MATERIAL_CARDS_COLLECTION,
    MATERIAL_DETAILS_COLLECTION, PROJECTS_COLLECTION,
};

const LIST_LIMIT: u32 = 1000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRecord {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_en: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_zh: Option<String>,
    pub desc: Option<String>,
    pub sort: i64,
    pub published: Option<bool>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySaveParams {
    pub id: Option<String>,
    pub name: String,
    pub title_en: Option<String>,
    pub title_zh: Option<String>,
    pub desc: Option<String>,
    pub sort: i64,
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    pub id: String,
    pub category_id: String,
    pub title: String,
    pub cover: String,
    pub images: Vec<MaterialDetailImageRecord>,
    pub desc: Option<String>,
    pub price: Option<f64>,
    pub sort: i64,
    pub published: Option<bool>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSaveParams {
    pub id: Option<String>,
    pub category_id: String,
    pub title: String,
    pub cover: String,
    pub images: Option<Vec<MaterialDetailImageRecord>>,
    pub desc: Option<String>,
    pub price: Option<f64>,
    pub sort: i64,
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialCardRecord {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub cover: String,
    pub sort: i64,
    pub published: Option<bool>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialCardSaveParams {
    pub id: Option<String>,
    pub project_id: String,
    pub title: String,
    pub cover: String,
    pub sort: i64,
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialDetailMediaRecord {
    #[serde(rename = "type")]
    pub media_type: String,
    pub src: String,
    pub sort: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialDetailImageRecord {
    pub image: String,
    pub sort: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialDetailRecord {
    pub id: String,
    pub card_id: String,
    pub title: String,
    pub content: String,
    pub media: Vec<MaterialDetailMediaRecord>,
    pub sort: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialDetailSaveParams {
    pub id: Option<String>,
    pub card_id: String,
    pub title: String,
    pub content: String,
    pub media: Vec<MaterialDetailMediaRecord>,
    pub sort: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeSettingsRecord {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hero_media_type: Option<String>,
    pub videos: Vec<HomeCarouselVideoRecord>,
    pub hero_images: Vec<MaterialDetailImageRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hero_carousel_interval: Option<i64>,
    pub images: Vec<MaterialDetailImageRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_compress_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_video_compress_preset: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_store_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_slogan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_latitude: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_longitude: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_hours: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_wechat_qr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xiaohongshu_qr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub xiaohongshu_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub douyin_qr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub douyin_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_category_id: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeCarouselVideoRecord {
    pub video: String,
    pub sort: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeSettingsSaveParams {
    pub id: Option<String>,
    pub hero_media_type: Option<String>,
    pub videos: Vec<HomeCarouselVideoRecord>,
    #[serde(default)]
    pub hero_images: Vec<MaterialDetailImageRecord>,
    pub hero_carousel_interval: Option<i64>,
    pub images: Vec<MaterialDetailImageRecord>,
    pub video_compress_enabled: Option<bool>,
    pub default_video_compress_preset: Option<String>,
    pub contact_store_name: Option<String>,
    pub contact_slogan: Option<String>,
    pub contact_address: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_latitude: Option<f64>,
    pub contact_longitude: Option<f64>,
    pub contact_hours: Option<String>,
    pub contact_wechat_qr: Option<String>,
    pub xiaohongshu_qr: Option<String>,
    pub xiaohongshu_hint: Option<String>,
    pub douyin_qr: Option<String>,
    pub douyin_hint: Option<String>,
    pub primary_category_id: Option<String>,
}

#[instrument]
pub fn list_categories() -> Result<Vec<CategoryRecord>, String> {
    let client = CloudClient::from_env()?;
    let value = query_documents(&client, CATEGORIES_COLLECTION, None, LIST_LIMIT, 0)?;
    parse_document_list(&value)
}

#[instrument]
pub fn get_category(id: &str) -> Result<Option<CategoryRecord>, String> {
    let client = CloudClient::from_env()?;
    let value = get_document(&client, CATEGORIES_COLLECTION, id)?;
    parse_single_document(&value)
}

#[instrument(skip(params))]
pub fn save_category(params: CategorySaveParams) -> Result<CategoryRecord, String> {
    if let Some(id) = params.id.clone() {
        let patch = omit_null(json!({
            "name": params.name,
            "titleEn": json_string_field(&params.title_en),
            "titleZh": json_string_field(&params.title_zh),
            "desc": json_string_field(&params.desc),
            "sort": params.sort,
            "published": params.published,
            "updatedAt": now_rfc3339(),
        }));
        let client = CloudClient::from_env()?;
        update_document(&client, CATEGORIES_COLLECTION, &id, patch)?;
        return get_category(&id)?.ok_or_else(|| format!("分类 {id} 不存在"));
    }

    let created_at = now_rfc3339();
    let document = omit_null(json!({
        "name": params.name,
        "titleEn": json_string_field(&params.title_en),
        "titleZh": json_string_field(&params.title_zh),
        "desc": json_string_field(&params.desc),
        "sort": params.sort,
        "published": params.published.unwrap_or(true),
        "createdAt": created_at,
        "updatedAt": created_at,
    }));
    let client = CloudClient::from_env()?;
    let id = insert_document(&client, CATEGORIES_COLLECTION, document)?;
    get_category(&id)?.ok_or_else(|| "新建分类后读取失败".to_string())
}

#[instrument]
pub fn delete_category(id: &str) -> Result<(), String> {
    for project in list_projects(id)? {
        delete_project(&project.id)?;
    }
    let client = CloudClient::from_env()?;
    delete_document(&client, CATEGORIES_COLLECTION, id)
}

#[instrument]
pub fn list_projects(category_id: &str) -> Result<Vec<ProjectRecord>, String> {
    let client = CloudClient::from_env()?;
    let where_clause = json!({ "categoryId": category_id });
    let value = query_documents(
        &client,
        PROJECTS_COLLECTION,
        Some(where_clause),
        LIST_LIMIT,
        0,
    )?;
    parse_document_list(&value)
}

#[instrument]
pub fn get_project(id: &str) -> Result<Option<ProjectRecord>, String> {
    let client = CloudClient::from_env()?;
    let value = get_document(&client, PROJECTS_COLLECTION, id)?;
    parse_single_document(&value)
}

#[instrument(skip(params))]
pub fn save_project(params: ProjectSaveParams) -> Result<ProjectRecord, String> {
    if let Some(id) = params.id.clone() {
        let patch = omit_null(json!({
            "categoryId": params.category_id,
            "title": params.title,
            "cover": params.cover,
            "images": params.images.as_ref().map(|items| {
                items.iter().map(|item| json!({
                    "image": item.image,
                    "sort": item.sort,
                })).collect::<Vec<_>>()
            }),
            "desc": json_string_field(&params.desc),
            "price": params.price,
            "sort": params.sort,
            "published": params.published,
            "updatedAt": now_rfc3339(),
        }));
        let client = CloudClient::from_env()?;
        update_document(&client, PROJECTS_COLLECTION, &id, patch)?;
        return get_project(&id)?.ok_or_else(|| format!("项目 {id} 不存在"));
    }

    let created_at = now_rfc3339();
    let document = omit_null(json!({
        "categoryId": params.category_id,
        "title": params.title,
        "cover": params.cover,
        "images": params.images.as_ref().map(|items| {
            items.iter().map(|item| json!({
                "image": item.image,
                "sort": item.sort,
            })).collect::<Vec<_>>()
        }),
        "desc": json_string_field(&params.desc),
        "price": params.price,
        "sort": params.sort,
        "published": params.published.unwrap_or(true),
        "createdAt": created_at,
        "updatedAt": created_at,
    }));
    let client = CloudClient::from_env()?;
    let id = insert_document(&client, PROJECTS_COLLECTION, document)?;
    get_project(&id)?.ok_or_else(|| "新建项目后读取失败".to_string())
}

#[instrument]
pub fn delete_project(id: &str) -> Result<(), String> {
    for card in list_material_cards(id)? {
        delete_material_card(&card.id)?;
    }
    let client = CloudClient::from_env()?;
    delete_document(&client, PROJECTS_COLLECTION, id)
}

#[instrument]
pub fn list_material_cards(project_id: &str) -> Result<Vec<MaterialCardRecord>, String> {
    let client = CloudClient::from_env()?;
    let where_clause = json!({ "projectId": project_id });
    let value = query_documents(
        &client,
        MATERIAL_CARDS_COLLECTION,
        Some(where_clause),
        LIST_LIMIT,
        0,
    )?;
    parse_document_list(&value)
}

#[instrument]
pub fn get_material_card(id: &str) -> Result<Option<MaterialCardRecord>, String> {
    let client = CloudClient::from_env()?;
    let value = get_document(&client, MATERIAL_CARDS_COLLECTION, id)?;
    parse_single_document(&value)
}

#[instrument(skip(params))]
pub fn save_material_card(params: MaterialCardSaveParams) -> Result<MaterialCardRecord, String> {
    if let Some(id) = params.id.clone() {
        let patch = omit_null(json!({
            "projectId": params.project_id,
            "title": params.title,
            "cover": params.cover,
            "sort": params.sort,
            "published": params.published,
            "updatedAt": now_rfc3339(),
        }));
        let client = CloudClient::from_env()?;
        update_document(&client, MATERIAL_CARDS_COLLECTION, &id, patch)?;
        return get_material_card(&id)?.ok_or_else(|| format!("素材卡片 {id} 不存在"));
    }

    let created_at = now_rfc3339();
    let document = omit_null(json!({
        "projectId": params.project_id,
        "title": params.title,
        "cover": params.cover,
        "sort": params.sort,
        "published": params.published.unwrap_or(true),
        "createdAt": created_at,
        "updatedAt": created_at,
    }));
    let client = CloudClient::from_env()?;
    let id = insert_document(&client, MATERIAL_CARDS_COLLECTION, document)?;
    get_material_card(&id)?.ok_or_else(|| "新建素材卡片后读取失败".to_string())
}

#[instrument]
pub fn delete_material_card(id: &str) -> Result<(), String> {
    for detail in list_material_details(id)? {
        delete_material_detail(&detail.id)?;
    }
    let client = CloudClient::from_env()?;
    delete_document(&client, MATERIAL_CARDS_COLLECTION, id)
}

#[instrument]
pub fn list_material_details(card_id: &str) -> Result<Vec<MaterialDetailRecord>, String> {
    let client = CloudClient::from_env()?;
    let where_clause = json!({ "cardId": card_id });
    let value = query_documents(
        &client,
        MATERIAL_DETAILS_COLLECTION,
        Some(where_clause),
        LIST_LIMIT,
        0,
    )?;
    parse_document_list(&value)
}

#[instrument]
pub fn get_material_detail(id: &str) -> Result<Option<MaterialDetailRecord>, String> {
    let client = CloudClient::from_env()?;
    let value = get_document(&client, MATERIAL_DETAILS_COLLECTION, id)?;
    parse_single_document(&value)
}

#[instrument(skip(params))]
pub fn save_material_detail(
    params: MaterialDetailSaveParams,
) -> Result<MaterialDetailRecord, String> {
    let media = sort_detail_media(params.media);
    if let Some(id) = params.id.clone() {
        let patch = omit_null(json!({
            "cardId": params.card_id,
            "title": params.title,
            "content": params.content,
            "media": build_document(&media)?,
            "images": [],
            "video": Value::Null,
            "sort": params.sort,
            "updatedAt": now_rfc3339(),
        }));
        let client = CloudClient::from_env()?;
        update_document(&client, MATERIAL_DETAILS_COLLECTION, &id, patch)?;
        return get_material_detail(&id)?.ok_or_else(|| format!("素材详情 {id} 不存在"));
    }

    let created_at = now_rfc3339();
    let document = omit_null(json!({
        "cardId": params.card_id,
        "title": params.title,
        "content": params.content,
        "media": build_document(&media)?,
        "images": [],
        "video": Value::Null,
        "sort": params.sort,
        "createdAt": created_at,
        "updatedAt": created_at,
    }));
    let client = CloudClient::from_env()?;
    let id = insert_document(&client, MATERIAL_DETAILS_COLLECTION, document)?;
    get_material_detail(&id)?.ok_or_else(|| "新建素材详情后读取失败".to_string())
}

#[instrument]
pub fn delete_material_detail(id: &str) -> Result<(), String> {
    let client = CloudClient::from_env()?;
    delete_document(&client, MATERIAL_DETAILS_COLLECTION, id)
}

#[instrument]
pub fn get_home_settings() -> Result<HomeSettingsRecord, String> {
    let client = CloudClient::from_env()?;
    let value = query_documents(&client, HOME_SETTINGS_COLLECTION, None, 1, 0)?;
    let list = parse_document_list::<HomeSettingsRecord>(&value)?;
    Ok(list.into_iter().next().unwrap_or(HomeSettingsRecord {
        id: String::new(),
        hero_media_type: Some("video".into()),
        videos: Vec::new(),
        hero_images: Vec::new(),
        hero_carousel_interval: None,
        images: Vec::new(),
        video_compress_enabled: Some(true),
        default_video_compress_preset: Some("standard".into()),
        contact_store_name: None,
        contact_slogan: None,
        contact_address: None,
        contact_phone: None,
        contact_latitude: None,
        contact_longitude: None,
        contact_hours: None,
        contact_wechat_qr: None,
        xiaohongshu_qr: None,
        xiaohongshu_hint: None,
        douyin_qr: None,
        douyin_hint: None,
        primary_category_id: None,
        updated_at: None,
    }))
}

#[instrument(skip(params))]
pub fn save_home_settings(params: HomeSettingsSaveParams) -> Result<HomeSettingsRecord, String> {
    let videos = sort_carousel_videos(params.videos);
    let hero_images = sort_detail_images(params.hero_images);
    let images = sort_detail_images(params.images);
    let client = CloudClient::from_env()?;

    if let Some(id) = params.id.clone().filter(|value| !value.is_empty()) {
        let patch = omit_null(json!({
            "heroMediaType": json_string_field(&params.hero_media_type),
            "videos": videos,
            "heroImages": hero_images,
            "heroCarouselInterval": params.hero_carousel_interval,
            "images": images,
            "videoCompressEnabled": params.video_compress_enabled,
            "defaultVideoCompressPreset": params.default_video_compress_preset,
            "contactStoreName": json_string_field(&params.contact_store_name),
            "contactSlogan": json_string_field(&params.contact_slogan),
            "contactAddress": json_string_field(&params.contact_address),
            "contactPhone": json_string_field(&params.contact_phone),
            "contactLatitude": params.contact_latitude,
            "contactLongitude": params.contact_longitude,
            "contactHours": json_string_field(&params.contact_hours),
            "contactWechatQr": json_string_field(&params.contact_wechat_qr),
            "xiaohongshuQr": json_string_field(&params.xiaohongshu_qr),
            "xiaohongshuHint": json_string_field(&params.xiaohongshu_hint),
            "douyinQr": json_string_field(&params.douyin_qr),
            "douyinHint": json_string_field(&params.douyin_hint),
            "primaryCategoryId": json_string_field(&params.primary_category_id),
            "updatedAt": now_rfc3339(),
        }));
        update_document(&client, HOME_SETTINGS_COLLECTION, &id, patch)?;
        return get_home_settings();
    }

    let document = build_document(json!({
        "heroMediaType": params.hero_media_type.clone().unwrap_or_else(|| "video".into()),
        "videos": videos,
        "heroImages": hero_images,
        "heroCarouselInterval": params.hero_carousel_interval.unwrap_or(4),
        "images": images,
        "videoCompressEnabled": params.video_compress_enabled.unwrap_or(true),
        "defaultVideoCompressPreset": params
            .default_video_compress_preset
            .unwrap_or_else(|| "standard".into()),
        "contactStoreName": json_string_field(&params.contact_store_name),
        "contactSlogan": json_string_field(&params.contact_slogan),
        "contactAddress": json_string_field(&params.contact_address),
        "contactPhone": json_string_field(&params.contact_phone),
        "contactLatitude": params.contact_latitude,
        "contactLongitude": params.contact_longitude,
        "contactHours": json_string_field(&params.contact_hours),
        "contactWechatQr": json_string_field(&params.contact_wechat_qr),
        "xiaohongshuQr": json_string_field(&params.xiaohongshu_qr),
        "xiaohongshuHint": json_string_field(&params.xiaohongshu_hint),
        "douyinQr": json_string_field(&params.douyin_qr),
        "douyinHint": json_string_field(&params.douyin_hint),
        "primaryCategoryId": json_string_field(&params.primary_category_id),
        "createdAt": now_rfc3339(),
        "updatedAt": now_rfc3339(),
    }))?;
    let id = insert_document(&client, HOME_SETTINGS_COLLECTION, document)?;
    get_home_settings().map(|mut record| {
        if record.id.is_empty() {
            record.id = id;
        }
        record
    })
}

fn sort_detail_images(
    mut images: Vec<MaterialDetailImageRecord>,
) -> Vec<MaterialDetailImageRecord> {
    images.sort_by_key(|item| item.sort);
    images
}

fn sort_carousel_videos(mut videos: Vec<HomeCarouselVideoRecord>) -> Vec<HomeCarouselVideoRecord> {
    videos.sort_by_key(|item| item.sort);
    videos
}

impl<'de> Deserialize<'de> for CategoryRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let doc = Value::deserialize(deserializer)?;
        map_category(&doc).ok_or_else(|| serde::de::Error::custom("无效分类文档"))
    }
}

impl<'de> Deserialize<'de> for ProjectRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let doc = Value::deserialize(deserializer)?;
        map_project(&doc).ok_or_else(|| serde::de::Error::custom("无效项目文档"))
    }
}

impl<'de> Deserialize<'de> for MaterialCardRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let doc = Value::deserialize(deserializer)?;
        map_material_card(&doc).ok_or_else(|| serde::de::Error::custom("无效素材卡片文档"))
    }
}

impl<'de> Deserialize<'de> for MaterialDetailRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let doc = Value::deserialize(deserializer)?;
        map_material_detail(&doc).ok_or_else(|| serde::de::Error::custom("无效素材详情文档"))
    }
}

impl<'de> Deserialize<'de> for HomeSettingsRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let doc = Value::deserialize(deserializer)?;
        map_home_settings(&doc).ok_or_else(|| serde::de::Error::custom("无效首页设置文档"))
    }
}

fn document_id(doc: &Value) -> Option<String> {
    doc.get("id")
        .and_then(parse_ejson_id)
        .or_else(|| doc.get("_id").and_then(parse_ejson_id))
}

fn map_category(doc: &Value) -> Option<CategoryRecord> {
    Some(CategoryRecord {
        id: document_id(doc)?,
        name: doc.get("name")?.as_str()?.to_string(),
        title_en: doc.get("titleEn").and_then(|v| v.as_str()).map(str::to_string),
        title_zh: doc.get("titleZh").and_then(|v| v.as_str()).map(str::to_string),
        desc: doc.get("desc").and_then(|v| v.as_str()).map(str::to_string),
        sort: doc.get("sort").and_then(parse_i64).unwrap_or(0),
        published: doc.get("published").and_then(|v| v.as_bool()),
        created_at: doc.get("createdAt").and_then(parse_ejson_date),
        updated_at: doc.get("updatedAt").and_then(parse_ejson_date),
    })
}

fn map_project(doc: &Value) -> Option<ProjectRecord> {
    Some(ProjectRecord {
        id: document_id(doc)?,
        category_id: doc.get("categoryId")?.as_str()?.to_string(),
        title: doc.get("title")?.as_str()?.to_string(),
        cover: doc.get("cover")?.as_str()?.to_string(),
        images: map_detail_images(doc.get("images")),
        desc: doc.get("desc").and_then(|v| v.as_str()).map(str::to_string),
        price: doc.get("price").and_then(parse_f64),
        sort: doc.get("sort").and_then(parse_i64).unwrap_or(0),
        published: doc.get("published").and_then(|v| v.as_bool()),
        created_at: doc.get("createdAt").and_then(parse_ejson_date),
        updated_at: doc.get("updatedAt").and_then(parse_ejson_date),
    })
}

fn map_material_card(doc: &Value) -> Option<MaterialCardRecord> {
    Some(MaterialCardRecord {
        id: document_id(doc)?,
        project_id: doc.get("projectId")?.as_str()?.to_string(),
        title: doc.get("title")?.as_str()?.to_string(),
        cover: doc.get("cover")?.as_str()?.to_string(),
        sort: doc.get("sort").and_then(parse_i64).unwrap_or(0),
        published: doc.get("published").and_then(|v| v.as_bool()),
        created_at: doc.get("createdAt").and_then(parse_ejson_date),
        updated_at: doc.get("updatedAt").and_then(parse_ejson_date),
    })
}

fn map_material_detail(doc: &Value) -> Option<MaterialDetailRecord> {
    let images = map_detail_images(doc.get("images"));
    let video = doc
        .get("video")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .filter(|s| !s.is_empty());
    let media = map_detail_media(doc.get("media"), images, video);

    Some(MaterialDetailRecord {
        id: document_id(doc)?,
        card_id: doc.get("cardId")?.as_str()?.to_string(),
        title: doc.get("title")?.as_str()?.to_string(),
        content: doc.get("content")?.as_str()?.to_string(),
        media,
        sort: doc.get("sort").and_then(parse_i64).unwrap_or(0),
        created_at: doc.get("createdAt").and_then(parse_ejson_date),
        updated_at: doc.get("updatedAt").and_then(parse_ejson_date),
    })
}

fn map_home_settings(doc: &Value) -> Option<HomeSettingsRecord> {
    Some(HomeSettingsRecord {
        id: document_id(doc)?,
        hero_media_type: doc
            .get("heroMediaType")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        videos: map_carousel_videos(doc.get("videos").or_else(|| doc.get("banners"))),
        hero_images: map_detail_images(doc.get("heroImages")),
        hero_carousel_interval: doc.get("heroCarouselInterval").and_then(parse_i64),
        images: map_detail_images(doc.get("images")),
        video_compress_enabled: doc.get("videoCompressEnabled").and_then(|v| v.as_bool()),
        default_video_compress_preset: doc
            .get("defaultVideoCompressPreset")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        contact_store_name: doc
            .get("contactStoreName")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        contact_slogan: doc
            .get("contactSlogan")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        contact_address: doc
            .get("contactAddress")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        contact_phone: doc
            .get("contactPhone")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        contact_latitude: doc.get("contactLatitude").and_then(parse_f64),
        contact_longitude: doc.get("contactLongitude").and_then(parse_f64),
        contact_hours: doc
            .get("contactHours")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        contact_wechat_qr: doc
            .get("contactWechatQr")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        xiaohongshu_qr: doc
            .get("xiaohongshuQr")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        xiaohongshu_hint: doc
            .get("xiaohongshuHint")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        douyin_qr: doc
            .get("douyinQr")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        douyin_hint: doc
            .get("douyinHint")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        primary_category_id: doc
            .get("primaryCategoryId")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .filter(|s| !s.is_empty()),
        updated_at: doc.get("updatedAt").and_then(parse_ejson_date),
    })
}

fn map_carousel_videos(value: Option<&Value>) -> Vec<HomeCarouselVideoRecord> {
    value
        .and_then(|v| v.as_array())
        .map(|items| {
            let mut mapped = items
                .iter()
                .filter_map(|item| {
                    let video = item
                        .get("video")
                        .or_else(|| item.get("image"))
                        .and_then(|v| v.as_str())?
                        .to_string();
                    Some(HomeCarouselVideoRecord {
                        video,
                        sort: item.get("sort").and_then(parse_i64).unwrap_or(0),
                    })
                })
                .collect::<Vec<_>>();
            mapped.sort_by_key(|item| item.sort);
            mapped
        })
        .unwrap_or_default()
}

fn map_detail_images(value: Option<&Value>) -> Vec<MaterialDetailImageRecord> {
    value
        .and_then(|v| v.as_array())
        .map(|items| {
            let mut mapped = items
                .iter()
                .filter_map(|item| {
                    Some(MaterialDetailImageRecord {
                        image: item.get("image")?.as_str()?.to_string(),
                        sort: item.get("sort").and_then(parse_i64).unwrap_or(0),
                    })
                })
                .collect::<Vec<_>>();
            mapped.sort_by_key(|item| item.sort);
            mapped
        })
        .unwrap_or_default()
}

fn map_detail_media(
    value: Option<&Value>,
    legacy_images: Vec<MaterialDetailImageRecord>,
    legacy_video: Option<String>,
) -> Vec<MaterialDetailMediaRecord> {
    if let Some(items) = value.and_then(|v| v.as_array()) {
        if !items.is_empty() {
            let mut mapped = items
                .iter()
                .filter_map(|item| {
                    let media_type = item.get("type")?.as_str()?;
                    if media_type != "image" && media_type != "video" {
                        return None;
                    }
                    let src = item.get("src")?.as_str()?.trim().to_string();
                    if src.is_empty() {
                        return None;
                    }
                    Some(MaterialDetailMediaRecord {
                        media_type: media_type.to_string(),
                        src,
                        sort: item.get("sort").and_then(parse_i64).unwrap_or(0),
                    })
                })
                .collect::<Vec<_>>();
            mapped.sort_by_key(|item| item.sort);
            return mapped;
        }
    }

    let mut media = Vec::new();
    if let Some(video) = legacy_video {
        media.push(MaterialDetailMediaRecord {
            media_type: "video".into(),
            src: video,
            sort: 0,
        });
        for (index, image) in legacy_images.into_iter().enumerate() {
            media.push(MaterialDetailMediaRecord {
                media_type: "image".into(),
                src: image.image,
                sort: (index as i64) + 1,
            });
        }
    } else {
        for image in legacy_images {
            media.push(MaterialDetailMediaRecord {
                media_type: "image".into(),
                src: image.image,
                sort: image.sort,
            });
        }
    }
    media.sort_by_key(|item| item.sort);
    media
}

fn sort_detail_media(mut media: Vec<MaterialDetailMediaRecord>) -> Vec<MaterialDetailMediaRecord> {
    media.sort_by_key(|item| item.sort);
    media
}

fn parse_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().map(|n| n as i64))
        .or_else(|| {
            value
                .get("$numberInt")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
        })
        .or_else(|| {
            value
                .get("$numberLong")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
        })
}

fn parse_f64(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_i64().map(|n| n as f64))
        .or_else(|| {
            value
                .get("$numberDouble")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse().ok())
        })
}
