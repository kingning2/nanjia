use crate::cloud::provision::bootstrap_database;

#[tauri::command]
pub async fn ensure_database() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        bootstrap_database()?;
        Ok(true)
    })
    .await
    .map_err(|err| format!("数据库初始化任务异常: {err}"))?
}
