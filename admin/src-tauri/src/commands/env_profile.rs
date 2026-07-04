use crate::local::env_profile::{
    list_profiles, set_active_profile, sync_profiles_from_env_files, EnvProfileView,
};

#[tauri::command]
pub async fn list_env_profiles() -> Result<Vec<EnvProfileView>, String> {
    tauri::async_runtime::spawn_blocking(list_profiles)
        .await
        .map_err(|err| format!("读取环境列表异常: {err}"))?
}

#[tauri::command]
pub async fn set_active_env_profile(id: String) -> Result<EnvProfileView, String> {
    tauri::async_runtime::spawn_blocking(move || set_active_profile(&id))
        .await
        .map_err(|err| format!("切换环境异常: {err}"))?
}

#[tauri::command]
pub async fn sync_env_profiles_from_files() -> Result<Vec<EnvProfileView>, String> {
    tauri::async_runtime::spawn_blocking(sync_profiles_from_env_files)
        .await
        .map_err(|err| format!("同步环境文件异常: {err}"))?
}
