use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};

const QUERY_ENCODE_SET: &AsciiSet = &CONTROLS.add(b' ').add(b'"').add(b'#').add(b'<').add(b'>');

pub struct CloudConfig {
    pub env_id: String,
    pub secret_id: String,
    pub secret_key: String,
    pub api_key: Option<String>,
    api_base: String,
    api_host: String,
    api_path_prefix: String,
}

/// 解析后的请求目标：完整 URL、TC3 CanonicalURI、TC3 CanonicalQueryString。
pub struct ResolvedRequest {
    pub url: String,
    pub canonical_path: String,
    pub canonical_query: String,
}

impl CloudConfig {
    pub fn from_env() -> Result<Self, String> {
        crate::cloud::load_dotenv();
        Self::from_credentials(
            std::env::var("CLOUDBASE_ENV_ID")
                .or_else(|_| std::env::var("TARO_APP_CLOUD_ENV_ID"))
                .map_err(|_| "缺少 CLOUDBASE_ENV_ID 或 TARO_APP_CLOUD_ENV_ID".to_string())?,
            std::env::var("CLOUDBASE_SECRET_ID").unwrap_or_default(),
            std::env::var("CLOUDBASE_SECRET_KEY").unwrap_or_default(),
            std::env::var("CLOUDBASE_API_BASE")
                .ok()
                .filter(|v| !v.is_empty()),
        )
    }

    pub fn from_credentials(
        env_id: String,
        secret_id: String,
        secret_key: String,
        api_base: Option<String>,
    ) -> Result<Self, String> {
        let api_key = std::env::var("CLOUDBASE_API_KEY")
            .ok()
            .filter(|v| !v.is_empty());

        if api_key.is_none() && (secret_id.is_empty() || secret_key.is_empty()) {
            return Err("请配置 CLOUDBASE_SECRET_ID + CLOUDBASE_SECRET_KEY（TC3 签名）".into());
        }

        let api_base =
            api_base.unwrap_or_else(|| format!("https://{env_id}.api.tcloudbasegateway.com"));
        let (api_base, api_host, api_path_prefix) = parse_api_base(&api_base)?;

        Ok(Self {
            env_id,
            secret_id,
            secret_key,
            api_key,
            api_base,
            api_host,
            api_path_prefix,
        })
    }

    pub fn api_base(&self) -> &str {
        &self.api_base
    }

    pub fn api_host(&self) -> &str {
        &self.api_host
    }

    pub fn resolve_request(&self, path_and_query: &str) -> ResolvedRequest {
        let path_and_query = normalize_path(path_and_query);
        let (pathname, raw_query) = split_path_query(&path_and_query);
        let full_url = format!("{}{path_and_query}", self.api_base.trim_end_matches('/'));
        let canonical_path = if self.api_path_prefix.is_empty() {
            pathname
        } else {
            format!("{}{pathname}", self.api_path_prefix)
        };
        let canonical_query = canonicalize_query_string(raw_query);
        ResolvedRequest {
            url: full_url,
            canonical_path,
            canonical_query,
        }
    }

    pub fn auth_mode(&self) -> &'static str {
        if !self.secret_id.is_empty() && !self.secret_key.is_empty() {
            "TC3"
        } else if self.api_key.is_some() {
            "API_KEY"
        } else {
            "NONE"
        }
    }
}

fn parse_api_base(raw: &str) -> Result<(String, String, String), String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("CLOUDBASE_API_BASE 不能为空".into());
    }

    let url =
        reqwest::Url::parse(trimmed).map_err(|err| format!("CLOUDBASE_API_BASE 无效: {err}"))?;
    if url.scheme() != "https" {
        return Err("CLOUDBASE_API_BASE 必须使用 https".into());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "CLOUDBASE_API_BASE 缺少 host".to_string())?
        .to_string();
    let prefix = url.path().trim_end_matches('/').to_string();

    Ok((trimmed.to_string(), host, prefix))
}

fn normalize_path(path: &str) -> String {
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    }
}

fn split_path_query(path_and_query: &str) -> (String, &str) {
    match path_and_query.split_once('?') {
        Some((pathname, query)) => (pathname.to_string(), query),
        None => (path_and_query.to_string(), ""),
    }
}

fn canonicalize_query_string(raw_query: &str) -> String {
    if raw_query.is_empty() {
        return String::new();
    }

    let mut pairs: Vec<(String, String)> = raw_query
        .split('&')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut split = part.splitn(2, '=');
            let key = split.next().unwrap_or_default().to_string();
            let value = split.next().unwrap_or_default().to_string();
            (key, value)
        })
        .collect();
    pairs.sort_by(|a, b| a.0.cmp(&b.0));

    pairs
        .into_iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&")
}

fn encode_query_component(value: &str) -> String {
    utf8_percent_encode(value, QUERY_ENCODE_SET).to_string()
}

/// 生成已排序且编码的 query string，供 URL 与 TC3 签名共用。
pub fn build_sorted_query(params: &[(&str, &str)]) -> String {
    let mut pairs: Vec<(&str, &str)> = params.to_vec();
    pairs.sort_by_key(|(key, _)| *key);
    pairs
        .into_iter()
        .map(|(key, value)| {
            format!(
                "{}={}",
                encode_query_component(key),
                encode_query_component(value)
            )
        })
        .collect::<Vec<_>>()
        .join("&")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> CloudConfig {
        CloudConfig {
            env_id: "cloud1-abc".into(),
            secret_id: String::new(),
            secret_key: String::new(),
            api_key: None,
            api_base: "https://cloud1-abc.api.tcloudbasegateway.com".into(),
            api_host: "cloud1-abc.api.tcloudbasegateway.com".into(),
            api_path_prefix: String::new(),
        }
    }

    #[test]
    fn resolve_splits_query_for_tc3() {
        let cfg = test_config();
        let resolved = cfg.resolve_request(
            "/v1/database/instances/(default)/databases/(default)/collections/media_files/documents?limit=50&offset=0&query=%7B%7D",
        );
        assert_eq!(
            resolved.url,
            "https://cloud1-abc.api.tcloudbasegateway.com/v1/database/instances/(default)/databases/(default)/collections/media_files/documents?limit=50&offset=0&query=%7B%7D"
        );
        assert_eq!(
            resolved.canonical_path,
            "/v1/database/instances/(default)/databases/(default)/collections/media_files/documents"
        );
        assert_eq!(resolved.canonical_query, "limit=50&offset=0&query=%7B%7D");
    }
}
