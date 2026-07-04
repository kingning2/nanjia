use chrono::{DateTime, NaiveDateTime, Utc};
use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::warn;

use super::tc3;

const TCB_API_HOST: &str = "tcb.tencentcloudapi.com";
const TCB_API_VERSION: &str = "2018-06-08";
const TCB_API_REGION: &str = "ap-shanghai";
const TCB_CONTENT_TYPE: &str = "application/json; charset=utf-8";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvBillingView {
    pub env_id: String,
    pub package_id: String,
    pub status: String,
    pub pay_mode: String,
    pub expire_time: Option<String>,
    pub days_remaining: Option<i64>,
    pub is_auto_renew: bool,
    pub is_always_free: bool,
}

/// 查询当前云开发环境套餐到期信息（DescribeBillingInfo）。
pub fn describe_billing_info(
    env_id: &str,
    secret_id: &str,
    secret_key: &str,
) -> Result<EnvBillingView, String> {
    let body = serde_json::json!({ "EnvIds": [env_id] }).to_string();
    let response = post_tcb_api("DescribeBillingInfo", &body, secret_id, secret_key)?;

    if let Some(err) = response.pointer("/Response/Error") {
        let code = err
            .get("Code")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");
        let message = err
            .get("Message")
            .and_then(|v| v.as_str())
            .unwrap_or("查询计费失败");
        return Err(format!("{code}: {message}"));
    }

    let item = response
        .pointer("/Response/EnvBillingInfoList/0")
        .ok_or_else(|| format_billing_miss(&response, env_id))?;

    let expire_raw = item
        .get("ExpireTime")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let expire_time = normalize_expire_time(expire_raw);
    let days_remaining = expire_time
        .as_deref()
        .and_then(days_until);

    Ok(EnvBillingView {
        env_id: item
            .get("EnvId")
            .and_then(|v| v.as_str())
            .unwrap_or(env_id)
            .to_string(),
        package_id: item
            .get("PackageId")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        status: item
            .get("Status")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        pay_mode: item
            .get("PayMode")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        expire_time,
        days_remaining,
        is_auto_renew: item
            .get("IsAutoRenew")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        is_always_free: item
            .get("IsAlwaysFree")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    })
}

fn format_billing_miss(response: &serde_json::Value, env_id: &str) -> String {
    let total = response
        .pointer("/Response/Total")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    if total == 0 {
        return format!(
            "环境 {env_id} 未返回计费信息，请确认密钥账号拥有该环境的 tcb 读权限"
        );
    }
    "未返回计费信息，请稍后重试".to_string()
}

fn post_tcb_api(
    action: &str,
    body: &str,
    secret_id: &str,
    secret_key: &str,
) -> Result<serde_json::Value, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_secs() as i64;

    let auth = tc3::tencent_cloud_authorization(
        secret_id,
        secret_key,
        "tcb",
        TCB_API_HOST,
        body,
        timestamp,
    )?;

    let client = Client::new();
    let response = client
        .post(format!("https://{TCB_API_HOST}/"))
        .header(CONTENT_TYPE, TCB_CONTENT_TYPE)
        .header(AUTHORIZATION, auth)
        .header("X-TC-Action", action)
        .header("X-TC-Version", TCB_API_VERSION)
        .header("X-TC-Region", TCB_API_REGION)
        .header("X-TC-Timestamp", timestamp.to_string())
        .body(body.to_string())
        .send()
        .map_err(|err| format!("查询套餐信息失败: {err}"))?;

    let status = response.status();
    let text = response.text().unwrap_or_default();
    if !status.is_success() {
        warn!(status = %status, body = %text, "DescribeBillingInfo 非 2xx");
        return Err("查询套餐信息失败，请稍后重试".to_string());
    }

    serde_json::from_str(&text).map_err(|err| format!("解析套餐信息失败: {err}"))
}

fn normalize_expire_time(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.starts_with("0000-00-00") {
        return None;
    }
    Some(trimmed.to_string())
}

fn days_until(expire_time: &str) -> Option<i64> {
    let parsed = NaiveDateTime::parse_from_str(expire_time, "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
        .or_else(|| {
            DateTime::parse_from_rfc3339(expire_time)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        });

    let expire = parsed?;
    let now = Utc::now();
    let secs = expire.signed_duration_since(now).num_seconds();
    Some((secs + 86_399) / 86_400)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud::env_files::load_dotenv_for_slug;

    #[test]
    #[ignore = "需要网络与根目录 .env.*"]
    fn probe_describe_billing_info() {
        load_dotenv_for_slug("development").expect("load env");
        let env_id = std::env::var("TARO_APP_CLOUD_ENV_ID").expect("env id");
        let secret_id = std::env::var("CLOUDBASE_SECRET_ID").expect("secret id");
        let secret_key = std::env::var("CLOUDBASE_SECRET_KEY").expect("secret key");
        let info = describe_billing_info(&env_id, &secret_id, &secret_key).expect("billing");
        assert!(!info.package_id.is_empty());
        println!("{info:?}");
    }
}
