use std::path::{Path, PathBuf};

fn main() {
    copy_bundled_env_for_release();
    tauri_build::build();
}

/// release 打包时把测试/正式环境文件写入 bundled-env（打进安装包）。
/// 优先复制项目根 `.env.test` / `.env.production`（本地）；
/// 若不存在则从进程环境变量生成（CI 注入 GitHub Secrets，见 scripts/write-env-from-secrets.mjs）。
fn copy_bundled_env_for_release() {
    use std::fs;

    let profile = std::env::var("PROFILE").unwrap_or_default();
    if profile != "release" {
        return;
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir.join("..").join("..");
    let out_dir = manifest_dir.join("bundled-env");

    println!("cargo:rerun-if-changed=../../.env.test");
    println!("cargo:rerun-if-changed=../../.env.production");

    fs::create_dir_all(&out_dir).expect("创建 bundled-env 目录失败");

    for spec in BUNDLE_SPECS {
        materialize_env_file(&project_root, &out_dir, &spec);
    }
}

struct BundleSpec {
    filename: &'static str,
    build_env: &'static str,
    debug_panel: &'static str,
    env_suffix: &'static str,
}

const BUNDLE_SPECS: [BundleSpec; 2] = [
    BundleSpec {
        filename: ".env.test",
        build_env: "test",
        debug_panel: "true",
        env_suffix: "_TEST",
    },
    BundleSpec {
        filename: ".env.production",
        build_env: "production",
        debug_panel: "false",
        env_suffix: "_PRODUCTION",
    },
];

fn materialize_env_file(project_root: &Path, out_dir: &Path, spec: &BundleSpec) {
    use std::fs;

    let src = project_root.join(spec.filename);
    let dest = out_dir.join(spec.filename);

    if src.is_file() {
        fs::copy(&src, &dest).unwrap_or_else(|err| {
            panic!("复制 {} 到 bundled-env 失败: {err}", spec.filename);
        });
        println!("cargo:warning= bundled-env: 已从 {} 复制", spec.filename);
        return;
    }

    let content = render_from_env(spec).unwrap_or_else(|| {
        panic!(
            "release 打包缺少 {}：请在项目根创建该文件，或在 CI 配置 GitHub Secrets（见 README / scripts/write-env-from-secrets.mjs）",
            spec.filename
        )
    });

    fs::write(&dest, content).unwrap_or_else(|err| {
        panic!("写入 bundled-env/{} 失败: {err}", spec.filename);
    });
    println!(
        "cargo:warning= bundled-env: 已从环境变量生成 {}",
        spec.filename
    );
}

fn render_from_env(spec: &BundleSpec) -> Option<String> {
    let env_id = pick_env(&[
        &format!("TARO_APP_CLOUD_ENV_ID{}", spec.env_suffix),
        "TARO_APP_CLOUD_ENV_ID",
    ])?;
    let secret_id = pick_env(&[
        &format!("CLOUDBASE_SECRET_ID{}", spec.env_suffix),
        "CLOUDBASE_SECRET_ID",
    ])?;
    let secret_key = pick_env(&[
        &format!("CLOUDBASE_SECRET_KEY{}", spec.env_suffix),
        "CLOUDBASE_SECRET_KEY",
    ])?;
    let app_id = pick_env(&["TARO_APP_ID"])?;

    let mut lines = vec![
        format!("TARO_APP_BUILD_ENV={}", spec.build_env),
        format!("TARO_APP_ID={app_id}"),
        format!("TARO_APP_CLOUD_ENV_ID={env_id}"),
        format!("TARO_APP_DEBUG_PANEL={}", spec.debug_panel),
        String::new(),
        "# 由 build.rs 从 CI 环境变量生成".into(),
        format!("CLOUDBASE_SECRET_ID={secret_id}"),
        format!("CLOUDBASE_SECRET_KEY={secret_key}"),
    ];

    lines.push(String::new());
    Some(lines.join("\n"))
}

fn pick_env(keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_test_env_shape() {
        std::env::set_var("TARO_APP_ID", "wx-demo");
        std::env::set_var("TARO_APP_CLOUD_ENV_ID", "cloud1-demo");
        std::env::set_var("CLOUDBASE_SECRET_ID", "sid");
        std::env::set_var("CLOUDBASE_SECRET_KEY", "skey");

        let text = render_from_env(&BUNDLE_SPECS[0]).expect("should render");
        assert!(text.contains("TARO_APP_BUILD_ENV=test"));
        assert!(text.contains("CLOUDBASE_SECRET_ID=sid"));

        std::env::remove_var("TARO_APP_ID");
        std::env::remove_var("TARO_APP_CLOUD_ENV_ID");
        std::env::remove_var("CLOUDBASE_SECRET_ID");
        std::env::remove_var("CLOUDBASE_SECRET_KEY");
    }
}
