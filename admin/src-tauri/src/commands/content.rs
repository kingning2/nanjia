use crate::cloud::content::{
    self, CategoryRecord, CategorySaveParams, MaterialCardRecord, MaterialCardSaveParams,
    MaterialDetailRecord, MaterialDetailSaveParams, ProjectRecord, ProjectSaveParams,
};

#[tauri::command]
pub async fn list_categories() -> Result<Vec<CategoryRecord>, String> {
    tauri::async_runtime::spawn_blocking(content::list_categories)
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn get_category(id: String) -> Result<Option<CategoryRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::get_category(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn save_category(params: CategorySaveParams) -> Result<CategoryRecord, String> {
    tauri::async_runtime::spawn_blocking(move || content::save_category(params))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn delete_category(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || content::delete_category(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn list_projects(category_id: String) -> Result<Vec<ProjectRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::list_projects(&category_id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn get_project(id: String) -> Result<Option<ProjectRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::get_project(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn save_project(params: ProjectSaveParams) -> Result<ProjectRecord, String> {
    tauri::async_runtime::spawn_blocking(move || content::save_project(params))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn delete_project(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || content::delete_project(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn list_material_cards(project_id: String) -> Result<Vec<MaterialCardRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::list_material_cards(&project_id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn get_material_card(id: String) -> Result<Option<MaterialCardRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::get_material_card(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn save_material_card(
    params: MaterialCardSaveParams,
) -> Result<MaterialCardRecord, String> {
    tauri::async_runtime::spawn_blocking(move || content::save_material_card(params))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn delete_material_card(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || content::delete_material_card(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn list_material_details(card_id: String) -> Result<Vec<MaterialDetailRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::list_material_details(&card_id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn get_material_detail(id: String) -> Result<Option<MaterialDetailRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || content::get_material_detail(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn save_material_detail(
    params: MaterialDetailSaveParams,
) -> Result<MaterialDetailRecord, String> {
    tauri::async_runtime::spawn_blocking(move || content::save_material_detail(params))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn delete_material_detail(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || content::delete_material_detail(&id))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn get_home_settings() -> Result<content::HomeSettingsRecord, String> {
    tauri::async_runtime::spawn_blocking(content::get_home_settings)
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}

#[tauri::command]
pub async fn save_home_settings(
    params: content::HomeSettingsSaveParams,
) -> Result<content::HomeSettingsRecord, String> {
    tauri::async_runtime::spawn_blocking(move || content::save_home_settings(params))
        .await
        .map_err(|err| format!("任务异常: {err}"))?
}
