use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::AppHandle;
#[cfg(not(debug_assertions))]
use tauri::Manager;

use crate::local::env_profile::get_profile;
use crate::local::paths;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateEnvParams {
    pub source_profile_id: String,
    pub target_profile_id: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrateEnvResult {
    pub documents_processed: u32,
    pub media_uploaded: u32,
    pub skipped: u32,
    pub documents_deleted: u32,
    pub storage_objects_deleted: u32,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolRunResult {
    documents_processed: u32,
    media_uploaded: u32,
    skipped: u32,
    documents_deleted: Option<u32>,
    storage_objects_deleted: Option<u32>,
    errors: Vec<String>,
    duration_ms: u64,
}

#[cfg(debug_assertions)]
fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

#[cfg(not(debug_assertions))]
fn bundled_node_name() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

fn write_config(params: &MigrateEnvParams) -> Result<(serde_json::Value, PathBuf), String> {
    if params.source_profile_id == params.target_profile_id {
        return Err("源环境与目标环境不能相同".to_string());
    }

    let source = get_profile(&params.source_profile_id)?
        .ok_or_else(|| "来源环境不存在".to_string())?;
    let target = get_profile(&params.target_profile_id)?
        .ok_or_else(|| "目标环境不存在".to_string())?;

    let config = serde_json::json!({
        "oldEnvId": source.env_id,
        "newEnvId": target.env_id,
        "oldSecretId": source.secret_id,
        "oldSecretKey": source.secret_key,
        "newSecretId": target.secret_id,
        "newSecretKey": target.secret_key,
        "wipeTargetFirst": true,
        "concurrency": 5,
        "logLevel": "info",
        "pageSize": 100,
        "fileRetryCount": 3
    });

    paths::ensure_app_data_dir()?;
    let config_path = paths::app_data_dir().join("migrate-config.json");
    let config_body = serde_json::to_string(&config).map_err(|err| err.to_string())?;
    fs::write(&config_path, &config_body).map_err(|err| format!("写入迁移配置失败: {err}"))?;

    Ok((config, config_path))
}

fn parse_tool_output(stdout: &str, stderr: &str) -> Result<MigrateEnvResult, String> {
    let line = stdout
        .lines()
        .rev()
        .find(|l| l.trim_start().starts_with('{'))
        .ok_or_else(|| format!("迁移工具未返回 JSON: {stdout}"))?;

    let parsed: ToolRunResult =
        serde_json::from_str(line).map_err(|err| format!("解析迁移结果失败: {err}; raw={line}"))?;

    if parsed.errors.is_empty() && stderr.contains("[FATAL]") {
        return Err(stderr.trim().to_string());
    }

    Ok(MigrateEnvResult {
        documents_processed: parsed.documents_processed,
        media_uploaded: parsed.media_uploaded,
        skipped: parsed.skipped,
        documents_deleted: parsed.documents_deleted.unwrap_or(0),
        storage_objects_deleted: parsed.storage_objects_deleted.unwrap_or(0),
        errors: parsed.errors,
        duration_ms: parsed.duration_ms,
    })
}

fn run_node_script(node: &Path, script: &Path, config_path: &Path) -> Result<MigrateEnvResult, String> {
    let config_arg = config_path.to_string_lossy().to_string();
    let output = Command::new(node)
        .arg(script)
        .args(["--config-file", &config_arg, "--json-out"])
        .output()
        .map_err(|err| format!("启动迁移工具失败: {err}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    if !stderr.trim().is_empty() {
        tracing::info!(stderr = %stderr.trim(), "migrate");
    }

    if !output.status.success() && stdout.trim().is_empty() {
        return Err(format!(
            "迁移工具异常退出 (code {:?}): {}",
            output.status.code(),
            stderr.trim()
        ));
    }

    parse_tool_output(&stdout, &stderr)
}

/// debug 开发：直接调本机 node + dist/index.js
#[cfg(debug_assertions)]
fn run_migrate(app: &AppHandle, config_path: &Path) -> Result<MigrateEnvResult, String> {
    let _ = app;
    let root = project_root();
    let script = root
        .join("tools")
        .join("cloudbase-migrate")
        .join("dist")
        .join("index.js");
    if !script.is_file() {
        return Err(
            "迁移脚本未编译。请在项目根目录执行: pnpm migrate:build".to_string(),
        );
    }

    run_node_script(Path::new("node"), &script, config_path)
}

/// release 安装包：resources 内置本机构建时复制的 node + bundle.cjs
#[cfg(not(debug_assertions))]
fn run_migrate(app: &AppHandle, config_path: &Path) -> Result<MigrateEnvResult, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|err| format!("读取资源目录失败: {err}"))?;
    let migrate_dir = resource_dir.join("cloudbase-migrate");
    let node = migrate_dir.join(bundled_node_name());
    let script = migrate_dir.join("bundle.cjs");

    if !node.is_file() || !script.is_file() {
        return Err("未找到内置迁移工具，请重新构建安装包".to_string());
    }

    run_node_script(&node, &script, config_path)
}

pub async fn migrate_env_impl(
    app: &AppHandle,
    params: &MigrateEnvParams,
) -> Result<MigrateEnvResult, String> {
    let (_config, config_path) = write_config(params)?;

    let app = app.clone();
    let path = config_path.clone();
    let result = tauri::async_runtime::spawn_blocking(move || run_migrate(&app, &path))
        .await
        .map_err(|err| format!("环境迁移异常: {err}"))??;

    let _ = fs::remove_file(&config_path);
    Ok(result)
}

#[tauri::command]
pub async fn migrate_env(app: AppHandle, params: MigrateEnvParams) -> Result<MigrateEnvResult, String> {
    migrate_env_impl(&app, &params).await
}
