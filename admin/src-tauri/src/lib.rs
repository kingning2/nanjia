pub mod cloud;
mod commands;
mod config;
mod image_util;
pub mod local;
mod logging;
pub mod sync;
mod video_compress_config;
pub mod video_util;

use commands::{
    analyze_media_redundancy, delete_category, delete_material_card,
    delete_material_detail, delete_project, delete_storage_file, delete_unused_media,
    ensure_database, get_category, get_current_position_native, get_env_billing_info,
    get_home_settings, get_material_card,
    get_material_detail, get_project, list_categories, list_env_profiles, list_material_cards,
    list_material_details, list_projects, list_uploaded_media, migrate_env, preview_image_compress,
    resolve_storage_url, save_category, save_home_settings, save_material_card,
    save_material_detail, save_project, set_active_env_profile, sync_env_profiles_from_files,
    upload_video_bytes, upload_webp_bytes,
};
use tauri::Manager;

const APP_TITLE: &str = "南嘉管理后台";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _log_guard = logging::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if !cfg!(debug_assertions) {
                if let Ok(resource_dir) = app.path().resource_dir() {
                    let bundle_dir = resource_dir.join("bundled-env");
                    if let Err(err) = cloud::env_files::init_bundle_root(bundle_dir) {
                        tracing::error!(error = %err, "内置环境文件初始化失败");
                    }
                }
            }

            if let Err(err) = local::env_profile::init() {
                tracing::error!(error = %err, "环境配置初始化失败");
            } else {
                cloud::env_files::load_admin_dotenv();
            }

            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::include_image!("icons/32x32.png");
                if let Err(err) = window.set_icon(icon) {
                    tracing::warn!(error = %err, "设置任务栏图标失败");
                }
                if let Err(err) = window.set_title(APP_TITLE) {
                    tracing::warn!(error = %err, "设置窗口标题失败");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ensure_database,
            upload_video_bytes,
            preview_image_compress,
            upload_webp_bytes,
            list_uploaded_media,
            resolve_storage_url,
            delete_storage_file,
            list_categories,
            get_category,
            save_category,
            delete_category,
            list_projects,
            get_project,
            save_project,
            delete_project,
            list_material_cards,
            get_material_card,
            save_material_card,
            delete_material_card,
            list_material_details,
            get_material_detail,
            save_material_detail,
            delete_material_detail,
            get_home_settings,
            get_current_position_native,
            save_home_settings,
            list_env_profiles,
            set_active_env_profile,
            sync_env_profiles_from_files,
            get_env_billing_info,
            migrate_env,
            analyze_media_redundancy,
            delete_unused_media,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
