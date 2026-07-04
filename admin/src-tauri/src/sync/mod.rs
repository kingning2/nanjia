mod media_audit;
mod refs;
mod types;

pub use types::{
    MediaCleanupResult, MediaRedundancyReport, CONTENT_COLLECTIONS,
};

pub fn analyze_media_redundancy(profile_id: &str) -> Result<MediaRedundancyReport, String> {
    media_audit::analyze_media_redundancy(profile_id)
}

pub fn delete_unused_media(profile_id: &str) -> Result<MediaCleanupResult, String> {
    media_audit::delete_unused_media(profile_id)
}
