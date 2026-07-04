use serde_json::Value;
use std::collections::BTreeSet;

const MEDIA_FIELDS: &[&str] = &[
    "cover",
    "splashVideo",
    "contactWechatQr",
    "xiaohongshuQr",
    "douyinQr",
];

pub fn collect_media_refs(doc: &Value) -> Vec<String> {
    let mut refs = BTreeSet::new();
    for field in MEDIA_FIELDS {
        push_ref(&mut refs, doc.get(field));
    }
    for field in ["fileID", "fileId"] {
        push_ref(&mut refs, doc.get(field));
    }
    for field in ["images", "heroImages"] {
        if let Some(images) = doc.get(field).and_then(|v| v.as_array()) {
            for item in images {
                push_ref(&mut refs, item.get("image"));
            }
        }
    }
    if let Some(videos) = doc.get("videos").and_then(|v| v.as_array()) {
        for item in videos {
            push_ref(&mut refs, item.get("video").or_else(|| item.get("image")));
        }
    }
    refs.into_iter().collect()
}

fn push_ref(target: &mut BTreeSet<String>, value: Option<&Value>) {
    let Some(text) = value.and_then(|v| v.as_str()) else {
        return;
    };
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }
    if trimmed.starts_with("cloud://")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.contains('/')
    {
        target.insert(trimmed.to_string());
    }
}
