use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCleanupResult {
    pub deleted_count: u32,
    pub failed_count: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRedundancyItem {
    pub file_id: String,
    pub original_name: String,
    pub cloud_path: String,
    pub mime_type: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRedundancyReport {
    pub profile_id: String,
    pub env_name: String,
    pub referenced_count: u32,
    pub library_count: u32,
    pub unused_count: u32,
    pub unused_image_count: u32,
    pub unused_video_count: u32,
    pub stale_reference_count: u32,
    pub unused_items: Vec<MediaRedundancyItem>,
}

pub const CONTENT_COLLECTIONS: &[&str] = &[
    crate::cloud::CATEGORIES_COLLECTION,
    crate::cloud::PROJECTS_COLLECTION,
    crate::cloud::MATERIAL_CARDS_COLLECTION,
    crate::cloud::MATERIAL_DETAILS_COLLECTION,
    crate::cloud::HOME_SETTINGS_COLLECTION,
];
