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
    pub safe_to_delete: bool,
    pub reference_hits: Vec<String>,
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
    pub safe_unused_count: u32,
    pub suspect_unused_count: u32,
    pub unused_items: Vec<MediaRedundancyItem>,
}

