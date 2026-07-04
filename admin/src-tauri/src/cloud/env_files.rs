use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tracing::info;

use crate::config::CloudConfig;

use super::client::CloudClient;

#[derive(Debug, Clone)]
pub struct EnvFileProfile {
    pub slug: String,
    pub name: String,
    pub env_id: String,
    pub api_base: Option<String>,
    pub secret_id: String,
    pub secret_key: String,
}

pub(crate) struct EnvFileSpec {
    slug: &'static str,
    name: &'static str,
    filename: &'static str,
}

const ALL_ENV_FILE_SPECS: [EnvFileSpec; 3] = [
    EnvFileSpec {
        slug: "development",
        name: "开发",
        filename: ".env.development",
    },
    EnvFileSpec {
        slug: "test",
        name: "测试",
        filename: ".env.test",
    },
    EnvFileSpec {
        slug: "production",
        name: "正式",
        filename: ".env.production",
    },
];

static BUNDLE_ROOT: OnceLock<PathBuf> = OnceLock::new();

/// release 安装包仅含测试/正式；开发模式保留三环境。
pub(crate) fn env_file_specs() -> &'static [EnvFileSpec] {
    if cfg!(debug_assertions) {
        &ALL_ENV_FILE_SPECS
    } else {
        &ALL_ENV_FILE_SPECS[1..]
    }
}

pub fn default_slug() -> &'static str {
    if cfg!(debug_assertions) {
        "development"
    } else {
        "test"
    }
}

pub fn slug_options_hint() -> &'static str {
    if cfg!(debug_assertions) {
        "development / test / production"
    } else {
        "test / production"
    }
}

/// release 打包时由 Tauri setup 注入内置环境文件目录。
pub fn init_bundle_root(dir: PathBuf) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Ok(());
    }
    if !dir.is_dir() {
        return Err(format!("内置环境目录不存在: {}", dir.display()));
    }
    BUNDLE_ROOT
        .set(dir)
        .map_err(|_| "内置环境目录已初始化".to_string())
}

/// 从当前工作目录向上查找含环境文件的项目根目录（仅 debug 使用）。
pub fn find_project_root() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    for _ in 0..8 {
        if dir.join(".env.development").is_file() || dir.join(".env.test").is_file() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn env_root() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        return find_project_root().ok_or_else(|| {
            "未找到项目根目录（缺少 .env.development），请在仓库根目录配置环境文件".to_string()
        });
    }
    BUNDLE_ROOT
        .get()
        .cloned()
        .ok_or_else(|| "内置环境文件未初始化，请重新安装管理端".to_string())
}

pub fn env_filename_for_slug(slug: &str) -> Option<&'static str> {
    env_file_specs()
        .iter()
        .find(|spec| spec.slug == slug)
        .map(|spec| spec.filename)
}

pub fn env_file_path(slug: &str) -> Result<PathBuf, String> {
    let root = env_root()?;
    let filename = env_filename_for_slug(slug)
        .ok_or_else(|| format!("无效环境 slug「{slug}」，可选: {}", slug_options_hint()))?;
    Ok(root.join(filename))
}

/// 将指定环境的 `.env.*` 载入进程环境（覆盖已有同名变量）。
pub fn load_dotenv_for_slug(slug: &str) -> Result<(), String> {
    let path = env_file_path(slug)?;
    if !path.is_file() {
        return Err(format!("缺少环境文件: {}", path.display()));
    }
    dotenvy::from_path_override(&path)
        .map_err(|err| format!("读取 {} 失败: {err}", path.display()))?;
    info!(slug, path = %path.display(), "已加载环境文件");
    Ok(())
}

/// 启动或切换环境时加载 dotenv：优先 `ADMIN_BUILD_ENV`，否则当前激活环境。
pub fn load_admin_dotenv() {
    let slug = resolve_active_slug();
    if let Err(err) = load_dotenv_for_slug(&slug) {
        tracing::warn!(slug = %slug, error = %err, "加载环境文件失败");
    }
}

fn resolve_active_slug() -> String {
    if let Ok(slug) = std::env::var("ADMIN_BUILD_ENV") {
        let slug = slug.trim().to_ascii_lowercase();
        if env_file_specs().iter().any(|spec| spec.slug == slug) {
            return slug;
        }
    }
    if let Ok(Some(profile)) = crate::local::env_profile::active_profile() {
        return profile.slug;
    }
    default_slug().to_string()
}

pub fn load_profiles_from_env_files() -> Result<Vec<EnvFileProfile>, String> {
    let root = env_root()?;
    let specs = env_file_specs();

    let mut profiles = Vec::with_capacity(specs.len());
    for spec in specs {
        let path = root.join(spec.filename);
        if !path.is_file() {
            return Err(format!("缺少环境文件: {}", path.display()));
        }
        let vars = parse_env_file(&path)?;
        let env_id = cloud_env_id(&vars).ok_or_else(|| {
            format!(
                "{} 需配置 TARO_APP_CLOUD_ENV_ID 或 CLOUDBASE_ENV_ID",
                spec.filename
            )
        })?;
        let secret_id = non_empty(vars.get("CLOUDBASE_SECRET_ID")).ok_or_else(|| {
            format!(
                "{} 缺少 CLOUDBASE_SECRET_ID（管理端密钥，与该环境云开发账号一致）",
                spec.filename
            )
        })?;
        let secret_key = non_empty(vars.get("CLOUDBASE_SECRET_KEY")).ok_or_else(|| {
            format!(
                "{} 缺少 CLOUDBASE_SECRET_KEY（管理端密钥，与该环境云开发账号一致）",
                spec.filename
            )
        })?;
        profiles.push(EnvFileProfile {
            slug: spec.slug.to_string(),
            name: spec.name.to_string(),
            env_id,
            api_base: non_empty(vars.get("CLOUDBASE_API_BASE")),
            secret_id,
            secret_key,
        });
        info!(file = spec.filename, slug = spec.slug, "已解析环境文件");
    }
    Ok(profiles)
}

/// 从项目根 `.env.*` 按 slug 构造 CloudClient（不依赖 SQLite profile）。
pub fn client_for_slug(slug: &str) -> Result<CloudClient, String> {
    let profile = load_profiles_from_env_files()?
        .into_iter()
        .find(|item| item.slug == slug)
        .ok_or_else(|| {
            format!(
                "未找到环境「{slug}」，slug 可选: {}",
                slug_options_hint()
            )
        })?;
    CloudClient::from_config(CloudConfig::from_credentials(
        profile.env_id,
        profile.secret_id,
        profile.secret_key,
        profile.api_base,
    )?)
}

fn parse_env_file(path: &Path) -> Result<HashMap<String, String>, String> {
    let iter = dotenvy::from_path_iter(path)
        .map_err(|err| format!("读取 {} 失败: {err}", path.display()))?;
    let mut vars = HashMap::new();
    for item in iter {
        let (key, value) = item.map_err(|err| format!("解析 {} 失败: {err}", path.display()))?;
        vars.insert(key, trim_quotes(value));
    }
    Ok(vars)
}

fn cloud_env_id(vars: &HashMap<String, String>) -> Option<String> {
    non_empty(vars.get("TARO_APP_CLOUD_ENV_ID")).or_else(|| non_empty(vars.get("CLOUDBASE_ENV_ID")))
}

fn non_empty(value: Option<&String>) -> Option<String> {
    value
        .map(|text| trim_quotes(text.clone()))
        .filter(|text| !text.is_empty())
}

fn trim_quotes(value: String) -> String {
    value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_env_id_prefers_taro_var() {
        let mut vars = HashMap::new();
        vars.insert("TARO_APP_CLOUD_ENV_ID".into(), "\"cloud1-dev\"".into());
        vars.insert("CLOUDBASE_ENV_ID".into(), "cloud1-other".into());
        assert_eq!(cloud_env_id(&vars).as_deref(), Some("cloud1-dev"));
    }

    #[test]
    fn release_specs_exclude_development() {
        if cfg!(debug_assertions) {
            assert_eq!(env_file_specs().len(), 3);
        } else {
            assert_eq!(env_file_specs().len(), 2);
            assert!(!env_file_specs().iter().any(|s| s.slug == "development"));
        }
    }
}
