use reqwest::blocking::{Client, RequestBuilder};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};

use crate::config::CloudConfig;

use super::api_error::format_user_error;
use super::tc3;

pub struct CloudClient {
    config: CloudConfig,
    http: Client,
}

impl CloudClient {
    pub fn from_env() -> Result<Self, String> {
        Self::current()
    }

    pub fn current() -> Result<Self, String> {
        match crate::local::env_profile::active_cloud_config() {
            Ok(config) => Self::from_config(config),
            Err(err) => {
                warn!(error = %err, "读取 SQLite 激活环境失败，回退到进程环境变量");
                Self::from_config(CloudConfig::from_env()?)
            }
        }
    }

    pub fn from_profile(profile: &crate::local::env_profile::EnvProfile) -> Result<Self, String> {
        Self::from_config(profile.to_cloud_config()?)
    }

    pub fn from_config(config: CloudConfig) -> Result<Self, String> {
        info!(
            env_id = %config.env_id,
            api_base = %config.api_base(),
            api_host = %config.api_host(),
            auth = %config.auth_mode(),
            "CloudClient 初始化"
        );
        Ok(Self {
            config,
            http: Client::new(),
        })
    }

    pub fn config(&self) -> &CloudConfig {
        &self.config
    }

    pub fn gateway_url(&self, path: &str) -> String {
        self.config.resolve_request(path).url
    }

    pub fn post_json(
        &self,
        path: &str,
        action: &str,
        body: &str,
    ) -> Result<reqwest::blocking::Response, String> {
        let resolved = self.config.resolve_request(path);
        info!(
            method = "POST",
            url = %resolved.url,
            action,
            path,
            body_len = body.len(),
            ">>> 发送 CloudBase 请求"
        );
        debug!(body = %truncate_body(body), "请求体");

        let mut request = self
            .http
            .post(&resolved.url)
            .header(CONTENT_TYPE, "application/json")
            .body(body.to_string());
        request = self.apply_auth(request, &resolved, action, body, "POST")?;

        self.send(request, "POST", &resolved.url, action)
    }

    pub fn get(&self, path: &str, action: &str) -> Result<reqwest::blocking::Response, String> {
        let resolved = self.config.resolve_request(path);
        info!(
            method = "GET",
            url = %resolved.url,
            action,
            path,
            ">>> 发送 CloudBase 请求"
        );

        let mut request = self
            .http
            .get(&resolved.url)
            .header(CONTENT_TYPE, "application/json");
        request = self.apply_auth(request, &resolved, action, "", "GET")?;

        self.send(request, "GET", &resolved.url, action)
    }

    pub fn patch_json(
        &self,
        path: &str,
        action: &str,
        body: &str,
    ) -> Result<reqwest::blocking::Response, String> {
        let resolved = self.config.resolve_request(path);
        info!(
            method = "PATCH",
            url = %resolved.url,
            action,
            path,
            body_len = body.len(),
            ">>> 发送 CloudBase 请求"
        );

        let mut request = self
            .http
            .patch(&resolved.url)
            .header(CONTENT_TYPE, "application/json")
            .body(body.to_string());
        request = self.apply_auth(request, &resolved, action, body, "PATCH")?;

        self.send(request, "PATCH", &resolved.url, action)
    }

    pub fn delete(&self, path: &str, action: &str) -> Result<reqwest::blocking::Response, String> {
        let resolved = self.config.resolve_request(path);
        info!(
            method = "DELETE",
            url = %resolved.url,
            action,
            path,
            ">>> 发送 CloudBase 请求"
        );

        let mut request = self
            .http
            .delete(&resolved.url)
            .header(CONTENT_TYPE, "application/json");
        request = self.apply_auth(request, &resolved, action, "", "DELETE")?;

        self.send(request, "DELETE", &resolved.url, action)
    }

    fn send(
        &self,
        request: RequestBuilder,
        method: &str,
        url: &str,
        action: &str,
    ) -> Result<reqwest::blocking::Response, String> {
        match request.send() {
            Ok(response) => {
                let status = response.status();
                if status.is_success() {
                    info!(
                        method,
                        url = %url,
                        action,
                        status = %status,
                        "<<< CloudBase 响应成功"
                    );
                } else {
                    warn!(
                        method,
                        url = %url,
                        action,
                        status = %status,
                        "<<< CloudBase 响应非 2xx"
                    );
                }
                Ok(response)
            }
            Err(err) => {
                error!(
                    method,
                    url = %url,
                    action,
                    error = %err,
                    "CloudBase 网络请求失败"
                );
                Err("连接云开发失败，请检查网络或环境配置".to_string())
            }
        }
    }

    fn apply_auth(
        &self,
        request: RequestBuilder,
        resolved: &crate::config::ResolvedRequest,
        action: &str,
        body: &str,
        method: &str,
    ) -> Result<RequestBuilder, String> {
        let has_tc3 = !self.config.secret_id.is_empty() && !self.config.secret_key.is_empty();

        if has_tc3 {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|err| err.to_string())?
                .as_secs() as i64;

            let host = self.config.api_host();
            let auth = tc3::cloudbase_authorization(
                &self.config.secret_id,
                &self.config.secret_key,
                method,
                &resolved.canonical_path,
                &resolved.canonical_query,
                host,
                action,
                body,
                timestamp,
            )?;

            debug!(
                action,
                auth = "TC3",
                timestamp,
                host,
                canonical_path = %resolved.canonical_path,
                canonical_query = %resolved.canonical_query,
                "已附加鉴权头"
            );
            return Ok(request
                .header(AUTHORIZATION, auth)
                .header("X-TC-Action", action)
                .header("X-TC-Timestamp", timestamp.to_string()));
        }

        if let Some(api_key) = &self.config.api_key {
            debug!(action, auth = "API_KEY", "已附加鉴权头");
            return Ok(request.header(AUTHORIZATION, format!("Bearer {api_key}")));
        }

        error!("缺少 CLOUDBASE_SECRET_ID + CLOUDBASE_SECRET_KEY");
        Err("缺少 CLOUDBASE_SECRET_ID + CLOUDBASE_SECRET_KEY".into())
    }
}

pub fn ensure_success(
    response: reqwest::blocking::Response,
    action: &str,
    url: &str,
) -> Result<serde_json::Value, String> {
    let status = response.status();
    let text = response.text().unwrap_or_default();
    if !status.is_success() {
        error!(
            action,
            url = %url,
            status = %status,
            response = %truncate_body(&text),
            "CloudBase API 错误"
        );
        return Err(format_user_error(action, status.as_u16(), &text));
    }
    if text.trim().is_empty() {
        debug!(action, url = %url, "响应体为空");
        return Ok(serde_json::json!({}));
    }
    debug!(
        action,
        url = %url,
        response = %truncate_body(&text),
        "CloudBase API 响应体"
    );
    serde_json::from_str(&text).map_err(|err| {
        error!(
            action,
            url = %url,
            error = %err,
            response = %truncate_body(&text),
            "解析响应 JSON 失败"
        );
        format!("{action}响应异常，请稍后重试")
    })
}

fn truncate_body(body: &str) -> String {
    const MAX: usize = 2000;
    if body.len() <= MAX {
        body.to_string()
    } else {
        let mut end = MAX;
        while end > 0 && !body.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}...(truncated, total {} bytes)", &body[..end], body.len())
    }
}
