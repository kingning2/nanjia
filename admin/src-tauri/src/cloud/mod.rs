pub const CATEGORIES_COLLECTION: &str = "categories";
pub const PROJECTS_COLLECTION: &str = "projects";
pub const MATERIAL_CARDS_COLLECTION: &str = "material_cards";
pub const MATERIAL_DETAILS_COLLECTION: &str = "material_details";
pub const MEDIA_FILES_COLLECTION: &str = "media_files";
pub const HOME_SETTINGS_COLLECTION: &str = "home_settings";

pub mod api_error;
pub mod billing;
pub mod client;
pub mod content;
pub mod database;
pub mod db_util;
pub mod env_files;
pub mod provision;
pub mod storage;
pub mod tc3;

pub use database::{list_media_files, MediaFileRecord};
pub use storage::{
    delete_storage_reference, get_download_url_for_reference, upload_bytes_as_webp,
    upload_bytes_raw, upload_local_image_as_webp, upload_webp_bytes,
};

pub fn load_dotenv() {
    env_files::load_admin_dotenv();
}
