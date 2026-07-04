use crate::sync::{
    analyze_media_redundancy as analyze_media_redundancy_impl,
    delete_unused_media as delete_unused_media_impl,
    MediaCleanupResult,
    MediaRedundancyReport,
};

#[tauri::command]
pub async fn analyze_media_redundancy(profile_id: String) -> Result<MediaRedundancyReport, String> {
    tauri::async_runtime::spawn_blocking(move || analyze_media_redundancy_impl(&profile_id))
        .await
        .map_err(|err| format!("媒体分析异常: {err}"))?
}

#[tauri::command]
pub async fn delete_unused_media(profile_id: String) -> Result<MediaCleanupResult, String> {
    tauri::async_runtime::spawn_blocking(move || delete_unused_media_impl(&profile_id))
        .await
        .map_err(|err| format!("删除未使用媒体异常: {err}"))?
}
