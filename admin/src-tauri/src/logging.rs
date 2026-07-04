use std::path::PathBuf;

use tracing::info;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// 持有 file appender 的 guard，进程退出前不可丢弃。
pub struct LogGuard {
    _file_guard: tracing_appender::non_blocking::WorkerGuard,
}

pub fn init() -> LogGuard {
    let log_dir = resolve_log_dir();
    std::fs::create_dir_all(&log_dir).ok();

    let file_appender = RollingFileAppender::new(Rotation::DAILY, &log_dir, "admin.log");
    let (file_writer, file_guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("tauri_app_lib=debug,info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_writer(file_writer)
                .with_ansi(false)
                .with_target(true)
                .with_thread_ids(true),
        )
        .with(
            fmt::layer()
                .with_writer(std::io::stderr)
                .with_ansi(true)
                .with_target(true),
        )
        .init();

    info!(log_dir = %log_dir.display(), "日志系统已初始化");

    LogGuard {
        _file_guard: file_guard,
    }
}

fn resolve_log_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("ADMIN_LOG_DIR") {
        return PathBuf::from(dir);
    }

    // `pnpm tauri dev` 时 cwd 通常为 admin/src-tauri
    if std::path::Path::new("../.env").exists() {
        return PathBuf::from("../logs");
    }

    PathBuf::from("logs")
}
