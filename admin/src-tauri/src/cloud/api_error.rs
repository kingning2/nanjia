use serde_json::Value;

/// 将 CloudBase HTTP 错误转为面向用户的简短中文，原始响应仅写日志
pub fn format_user_error(action: &str, status: u16, body: &str) -> String {
    let code = parse_error_code(body);
    let api_message = parse_error_message(body);

    if let Some(text) = map_known_code(code.as_deref(), action, status) {
        return text;
    }

    if let Some(msg) = api_message {
        if is_user_readable(&msg) {
            return msg;
        }
    }

    default_message(action, status)
}

fn map_known_code(code: Option<&str>, action: &str, status: u16) -> Option<String> {
    match code {
        Some("INVALID_CREDENTIALS") => {
            Some("云开发鉴权失败，请检查当前环境对应的项目根 .env.* 密钥配置".into())
        }
        Some("DATABASE_PERMISSION_DENIED") => Some("没有数据库访问权限".into()),
        Some("DATABASE_COLLECTION_NOT_EXIST") => Some("数据集合不存在，请先初始化数据库".into()),
        Some("DOCUMENT_NOT_FOUND") => Some("记录不存在或已被删除".into()),
        Some("DATABASE_COLLECTION_ALREADY_EXIST") => None,
        Some("STORAGE_OBJECT_NOT_EXIST") | Some("OBJECT_NOT_FOUND") => {
            Some("图片不存在或已被删除".into())
        }
        Some("INVALID_PARAM") if is_storage_action(action) => Some("图片不存在或无法访问".into()),
        Some("EXCEED_REQUEST_LIMIT") => Some("云开发请求过于频繁，请稍后再试".into()),
        Some("EXCEED_CONCURRENT_REQUEST_LIMIT") => Some("云开发并发连接数已满，请稍后再试".into()),
        _ if is_storage_action(action) && (status == 404 || status == 400) => {
            Some("图片不存在或已被删除".into())
        }
        _ => None,
    }
}

fn is_storage_action(action: &str) -> bool {
    action.contains("Storage")
        || action.contains("storage")
        || action == "GetObjectsUploadInfo"
        || action == "DeleteObjects"
        || action.contains("上传")
        || action.contains("图片")
        || action.contains("临时访问链接")
}

fn default_message(action: &str, status: u16) -> String {
    if action.contains("查询") || action == "QueryDocuments" {
        return "查询数据失败，请稍后重试".into();
    }
    if action.contains("插入") || action == "InsertDocument" {
        return "写入数据失败，请稍后重试".into();
    }
    if action.contains("更新") || action == "UpdateDocument" {
        return "更新数据失败，请稍后重试".into();
    }
    if action.contains("删除") || action == "DeleteDocument" {
        return "删除数据失败，请稍后重试".into();
    }
    if is_storage_action(action) {
        return if status == 404 || status == 400 {
            "图片不存在或已被删除".into()
        } else {
            "图片操作失败，请稍后重试".into()
        };
    }
    if action.contains("上传") {
        return "图片上传失败，请稍后重试".into();
    }
    format!("{action}失败，请稍后重试")
}

fn parse_error_code(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    if let Some(code) = value.get("code").and_then(|v| v.as_str()) {
        return Some(code.to_string());
    }
    if let Some(code) = value.pointer("/Error/Code").and_then(|v| v.as_str()) {
        return Some(code.to_string());
    }
    if let Some(item) = value.as_array()?.first() {
        return item
            .get("code")
            .and_then(|v| v.as_str())
            .map(str::to_string);
    }
    None
}

fn parse_error_message(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    if let Some(msg) = value.get("message").and_then(|v| v.as_str()) {
        return Some(msg.to_string());
    }
    if let Some(msg) = value.get("Message").and_then(|v| v.as_str()) {
        return Some(msg.to_string());
    }
    if let Some(msg) = value.pointer("/Error/Message").and_then(|v| v.as_str()) {
        return Some(msg.to_string());
    }
    if let Some(item) = value.as_array()?.first() {
        return item
            .get("message")
            .and_then(|v| v.as_str())
            .map(str::to_string);
    }
    None
}

fn is_user_readable(message: &str) -> bool {
    let trimmed = message.trim();
    !trimmed.is_empty()
        && !trimmed.starts_with('{')
        && !trimmed.contains("http")
        && trimmed.len() <= 120
}

#[cfg(test)]
mod tests {
    use super::format_user_error;

    #[test]
    fn maps_deleted_storage_object() {
        let body = r#"{"code":"INVALID_PARAM","message":"Invalid request param..."}"#;
        let msg = format_user_error("GetObjectsUploadInfo", 400, body);
        assert_eq!(msg, "图片不存在或无法访问");
    }

    #[test]
    fn maps_document_not_found() {
        let body = r#"{"code":"DOCUMENT_NOT_FOUND","message":"..."}"#;
        let msg = format_user_error("GetDocument", 404, body);
        assert_eq!(msg, "记录不存在或已被删除");
    }

    #[test]
    fn does_not_leak_raw_json() {
        let body = r#"{"code":"UNKNOWN_X","message":"https://example.com/foo"}"#;
        let msg = format_user_error("QueryDocuments", 500, body);
        assert!(!msg.contains('{'));
        assert!(!msg.contains("https://"));
    }
}
