use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use tracing::{debug, info, warn};

/// release 启动后异步检查 CloudBase COS 上的更新清单。
pub fn spawn_startup_check(app: &AppHandle) {
    if cfg!(debug_assertions) {
        debug!("debug 模式跳过自动更新检查");
        return;
    }

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let updater = match handle.updater_builder().build() {
            Ok(u) => u,
            Err(err) => {
                warn!(error = %err, "初始化更新器失败");
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => {
                info!(version = %update.version, "发现新版本，开始下载");
                if let Err(err) = update
                    .download_and_install(
                        |chunk, total| {
                            debug!(chunk, ?total, "下载更新包");
                        },
                        || info!("更新包下载完成，准备安装"),
                    )
                    .await
                {
                    warn!(error = %err, "下载或安装更新失败");
                }
            }
            Ok(None) => debug!("已是最新版本"),
            Err(err) => warn!(error = %err, "检查更新失败"),
        }
    });
}
