use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

fn sha256_hex(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &str) -> Result<Vec<u8>, String> {
    let mut mac = HmacSha256::new_from_slice(key).map_err(|_| "HMAC key length invalid".to_string())?;
    mac.update(data.as_bytes());
    Ok(mac.finalize().into_bytes().to_vec())
}

fn tc_date(timestamp: i64) -> Result<String, String> {
    chrono::DateTime::from_timestamp(timestamp, 0)
        .ok_or_else(|| format!("invalid timestamp: {timestamp}"))
        .map(|dt| dt.format("%Y-%m-%d").to_string())
}

/// CloudBase HTTP Gateway TC3 签名。
/// `canonical_uri` 不含 query；`canonical_query` 为排序后的 query（可为空）。
pub fn cloudbase_authorization(
    secret_id: &str,
    secret_key: &str,
    method: &str,
    canonical_uri: &str,
    canonical_query: &str,
    host: &str,
    action: &str,
    body: &str,
    timestamp: i64,
) -> Result<String, String> {
    let content_type = "application/json";
    let canonical_headers = format!(
        "content-type:{content_type}\nhost:{host}\nx-tc-action:{}\n",
        action.to_lowercase()
    );
    let signed_headers = "content-type;host;x-tc-action";
    let hashed_payload = sha256_hex(body);

    let canonical_request = format!(
        "{method}\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    );

    let date = tc_date(timestamp)?;
    let credential_scope = format!("{date}/tcb/tc3_request");
    let string_to_sign = format!(
        "TC3-HMAC-SHA256\n{timestamp}\n{credential_scope}\n{}",
        sha256_hex(&canonical_request)
    );

    let k_date = hmac_sha256(format!("TC3{secret_key}").as_bytes(), &date)?;
    let k_service = hmac_sha256(&k_date, "tcb")?;
    let k_signing = hmac_sha256(&k_service, "tc3_request")?;
    let signature = hex::encode(hmac_sha256(&k_signing, &string_to_sign)?);

    Ok(format!(
        "TC3-HMAC-SHA256 Credential={secret_id}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}, Timestamp={timestamp}"
    ))
}

/// 腾讯云 Open API（`*.tencentcloudapi.com`）TC3 签名，与 CloudBase HTTP 网关不同。
pub fn tencent_cloud_authorization(
    secret_id: &str,
    secret_key: &str,
    service: &str,
    host: &str,
    body: &str,
    timestamp: i64,
) -> Result<String, String> {
    let content_type = "application/json; charset=utf-8";
    let canonical_headers = format!("content-type:{content_type}\nhost:{host}\n");
    let signed_headers = "content-type;host";
    let hashed_payload = sha256_hex(body);

    let canonical_request = format!(
        "POST\n/\n\n{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    );

    let date = tc_date(timestamp)?;
    let credential_scope = format!("{date}/{service}/tc3_request");
    let string_to_sign = format!(
        "TC3-HMAC-SHA256\n{timestamp}\n{credential_scope}\n{}",
        sha256_hex(&canonical_request)
    );

    let k_date = hmac_sha256(format!("TC3{secret_key}").as_bytes(), &date)?;
    let k_service = hmac_sha256(&k_date, service)?;
    let k_signing = hmac_sha256(&k_service, "tc3_request")?;
    let signature = hex::encode(hmac_sha256(&k_signing, &string_to_sign)?);

    Ok(format!(
        "TC3-HMAC-SHA256 Credential={secret_id}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_request_includes_query_line() {
        let auth = cloudbase_authorization(
            "AKIDtest",
            "secret",
            "GET",
            "/v1/database/instances/(default)/databases/(default)/collections/media_files/documents",
            "limit=50&offset=0",
            "cloud1-abc.api.tcloudbasegateway.com",
            "QueryDocuments",
            "",
            1_700_000_000,
        )
        .expect("auth");
        assert!(auth.starts_with("TC3-HMAC-SHA256 Credential=AKIDtest/"));
    }
}
