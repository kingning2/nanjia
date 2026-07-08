use serde_json::Value;
use std::collections::BTreeSet;

pub fn collect_media_refs(doc: &Value) -> Vec<String> {
    let mut refs = BTreeSet::new();
    walk_value(doc, &mut refs);
    refs.into_iter().collect()
}

fn walk_value(value: &Value, target: &mut BTreeSet<String>) {
    match value {
        Value::String(text) => push_ref_str(target, text),
        Value::Array(items) => items.iter().for_each(|item| walk_value(item, target)),
        Value::Object(map) => map.values().for_each(|item| walk_value(item, target)),
        _ => {}
    }
}

fn push_ref_str(target: &mut BTreeSet<String>, text: &str) {
    let trimmed = text.trim();
    if trimmed.is_empty() || !looks_like_media_reference(trimmed) {
        return;
    }
    target.insert(trimmed.to_string());
}

fn looks_like_media_reference(text: &str) -> bool {
    if text.starts_with("cloud://") {
        return true;
    }
    if text.starts_with("http://") || text.starts_with("https://") {
        return true;
    }
    if is_mime_type(text) {
        return false;
    }
    text.contains('/')
}

fn is_mime_type(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.starts_with("image/")
        || lower.starts_with("video/")
        || lower.starts_with("audio/")
        || lower.starts_with("application/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn collects_nested_media_src() {
        let doc = json!({
            "media": [{ "type": "image", "src": "cloud://env-id/media/a.webp", "sort": 0 }]
        });
        let refs = collect_media_refs(&doc);
        assert!(refs.iter().any(|r| r.contains("a.webp")));
    }

    #[test]
    fn ignores_mime_type() {
        let doc = json!({ "mimeType": "image/webp" });
        assert!(collect_media_refs(&doc).is_empty());
    }

    #[test]
    fn collects_cos_path() {
        let doc = json!({ "cover": "projects/uploads/foo-uuid.webp" });
        let refs = collect_media_refs(&doc);
        assert_eq!(refs, vec!["projects/uploads/foo-uuid.webp"]);
    }

    #[test]
    fn collects_material_details_path_without_extension() {
        let doc = json!({
            "src": "material-details/images/vx724114791-scale-1_50x-f975ce51"
        });
        assert!(!collect_media_refs(&doc).is_empty());
    }
}
