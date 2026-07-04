use std::fs;
use std::sync::{Mutex, OnceLock};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::cloud::env_files::{self};

use super::paths;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvProfileView {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub env_id: String,
    pub api_base: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone)]
pub struct EnvProfile {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub env_id: String,
    pub secret_id: String,
    pub secret_key: String,
    pub api_base: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvProfileInput {
    pub id: Option<String>,
    pub name: String,
    pub slug: String,
    pub env_id: String,
    pub secret_id: String,
    pub secret_key: String,
    pub api_base: Option<String>,
}

impl EnvProfile {
    pub fn to_cloud_config(&self) -> Result<crate::config::CloudConfig, String> {
        crate::config::CloudConfig::from_credentials(
            self.env_id.clone(),
            self.secret_id.clone(),
            self.secret_key.clone(),
            self.api_base.clone(),
        )
    }
}

impl From<EnvProfile> for EnvProfileView {
    fn from(value: EnvProfile) -> Self {
        Self {
            id: value.id,
            name: value.name,
            slug: value.slug,
            env_id: value.env_id,
            api_base: value.api_base,
            is_active: value.is_active,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ActiveEnvFile {
    slug: String,
}

struct EnvStore {
    profiles: Vec<EnvProfile>,
}

static STORE: OnceLock<Mutex<EnvStore>> = OnceLock::new();

fn store() -> Result<&'static Mutex<EnvStore>, String> {
    if let Some(mutex) = STORE.get() {
        return Ok(mutex);
    }
    let profiles = build_profiles_from_env_files(load_active_slug())?;
    let _ = STORE.set(Mutex::new(EnvStore { profiles }));
    STORE.get().ok_or_else(|| "环境缓存初始化失败".to_string())
}

fn load_active_slug() -> String {
    let path = paths::active_env_path();
    if !path.is_file() {
        return crate::cloud::env_files::default_slug().to_string();
    }
    let text = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str::<ActiveEnvFile>(&text)
        .map(|file| file.slug)
        .unwrap_or_else(|_| crate::cloud::env_files::default_slug().to_string())
}

fn save_active_slug(slug: &str) -> Result<(), String> {
    paths::ensure_app_data_dir()?;
    let body = serde_json::to_string(&ActiveEnvFile {
        slug: slug.to_string(),
    })
    .map_err(|err| err.to_string())?;
    fs::write(paths::active_env_path(), body).map_err(|err| format!("写入 active-env.json 失败: {err}"))
}

fn build_profiles_from_env_files(active_slug: String) -> Result<Vec<EnvProfile>, String> {
    let parsed = env_files::load_profiles_from_env_files()?;
    let now = Utc::now().to_rfc3339();
    let mut profiles = Vec::with_capacity(parsed.len());
    let mut has_active = false;

    for item in parsed {
        let is_active = item.slug == active_slug;
        if is_active {
            has_active = true;
        }
        profiles.push(EnvProfile {
            id: item.slug.clone(),
            name: item.name,
            slug: item.slug,
            env_id: item.env_id,
            secret_id: item.secret_id,
            secret_key: item.secret_key,
            api_base: item.api_base,
            is_active,
            created_at: now.clone(),
            updated_at: now.clone(),
        });
    }

    if !has_active {
        let fallback = crate::cloud::env_files::default_slug();
        for profile in &mut profiles {
            if profile.slug == fallback {
                profile.is_active = true;
                save_active_slug(fallback)?;
                break;
            }
        }
    }

    Ok(profiles)
}

pub fn init() -> Result<(), String> {
    paths::ensure_app_data_dir()?;
    sync_profiles_from_env_files()?;
    Ok(())
}

pub fn list_profiles() -> Result<Vec<EnvProfileView>, String> {
    let guard = store()?.lock().map_err(|_| "环境缓存锁异常".to_string())?;
    Ok(guard.profiles.iter().cloned().map(EnvProfileView::from).collect())
}

pub fn get_profile(id: &str) -> Result<Option<EnvProfile>, String> {
    let guard = store()?.lock().map_err(|_| "环境缓存锁异常".to_string())?;
    Ok(guard
        .profiles
        .iter()
        .find(|profile| profile.id == id || profile.slug == id)
        .cloned())
}

pub fn active_profile() -> Result<Option<EnvProfile>, String> {
    let guard = store()?.lock().map_err(|_| "环境缓存锁异常".to_string())?;
    Ok(guard.profiles.iter().find(|profile| profile.is_active).cloned())
}

pub fn active_cloud_config() -> Result<crate::config::CloudConfig, String> {
    if let Some(profile) = active_profile()? {
        return profile.to_cloud_config();
    }
    sync_profiles_from_env_files()?;
    active_profile()?
        .ok_or_else(|| "未找到可用环境配置，请检查项目根目录 .env.development 等文件".to_string())?
        .to_cloud_config()
}

pub fn set_active_profile(id: &str) -> Result<EnvProfileView, String> {
    let slug = get_profile(id)?
        .map(|profile| profile.slug)
        .ok_or_else(|| "环境不存在".to_string())?;
    save_active_slug(&slug)?;

    let profiles = build_profiles_from_env_files(slug)?;
    let active = profiles
        .iter()
        .find(|profile| profile.is_active)
        .cloned()
        .ok_or_else(|| "激活环境后读取失败".to_string())?;

    if let Err(err) = env_files::load_dotenv_for_slug(&active.slug) {
        tracing::warn!(slug = %active.slug, error = %err, "切换后加载环境文件失败");
    }

    let mut guard = store()?.lock().map_err(|_| "环境缓存锁异常".to_string())?;
    guard.profiles = profiles;
    Ok(EnvProfileView::from(active))
}

pub fn sync_profiles_from_env_files() -> Result<Vec<EnvProfileView>, String> {
    let active_slug = load_active_slug();
    let profiles = build_profiles_from_env_files(active_slug)?;
    let views: Vec<EnvProfileView> = profiles.iter().cloned().map(EnvProfileView::from).collect();
    let mut guard = store()?.lock().map_err(|_| "环境缓存锁异常".to_string())?;
    guard.profiles = profiles;
    Ok(views)
}

pub fn import_from_env_files_if_empty() -> Result<Option<Vec<EnvProfileView>>, String> {
    let views = sync_profiles_from_env_files()?;
    if views.is_empty() {
        Ok(None)
    } else {
        Ok(Some(views))
    }
}
