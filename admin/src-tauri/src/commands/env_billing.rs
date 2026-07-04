use crate::cloud::billing::{describe_billing_info, EnvBillingView};
use crate::local::env_profile::active_profile;

#[tauri::command]
pub async fn get_env_billing_info() -> Result<EnvBillingView, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let profile = active_profile()?.ok_or_else(|| "未选择云环境".to_string())?;
        describe_billing_info(&profile.env_id, &profile.secret_id, &profile.secret_key)
    })
    .await
    .map_err(|err| format!("查询套餐信息异常: {err}"))?
}
