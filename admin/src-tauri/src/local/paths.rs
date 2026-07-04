use std::fs;
use std::path::PathBuf;

/// 管理端本地数据目录（仅存 active-env.json，不再使用 SQLite）
pub fn app_data_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("nanjia-beauty-admin")
}

pub fn ensure_app_data_dir() -> Result<(), String> {
    fs::create_dir_all(app_data_dir()).map_err(|err| format!("创建本地数据目录失败: {err}"))
}

pub fn active_env_path() -> PathBuf {
    app_data_dir().join("active-env.json")
}
