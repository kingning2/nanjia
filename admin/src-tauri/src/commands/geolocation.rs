use serde::Serialize;

#[cfg(target_os = "macos")]
use std::sync::mpsc;
#[cfg(target_os = "macos")]
use std::thread;
#[cfg(target_os = "macos")]
use std::time::{Duration, Instant};

#[derive(Serialize)]
pub struct CurrentPositionDto {
    pub latitude: f64,
    pub longitude: f64,
}

#[cfg(target_os = "macos")]
fn get_current_position_macos() -> Result<CurrentPositionDto, String> {
    use corelocation::authorization::AuthorizationStatus;
    use corelocation::manager::{LocationManager, LocationManagerCallbacks};
    use corelocation::prelude::*;

    if !LocationManager::location_services_enabled() {
        return Err("系统定位服务未开启，请在系统设置中打开定位服务".into());
    }

    let (loc_tx, loc_rx) = mpsc::channel();
    let (err_tx, err_rx) = mpsc::channel();
    let (auth_tx, auth_rx) = mpsc::channel();

    let callbacks = LocationManagerCallbacks::new()
        .on_locations(move |locations| {
            if let Some(loc) = locations.last() {
                let _ = loc_tx.send((loc.coordinate.latitude, loc.coordinate.longitude));
            }
        })
        .on_error(move |err| {
            let _ = err_tx.send(format!("定位失败: {err:?}"));
        })
        .on_authorization_change(move |status| {
            let _ = auth_tx.send(status);
        });

    let manager =
        LocationManager::with_callbacks(callbacks).map_err(|err| format!("初始化定位失败: {err}"))?;

    let status = manager.authorization_status();
    match status {
        AuthorizationStatus::Denied | AuthorizationStatus::Restricted => {
            return Err(
                "定位权限被拒绝，请在系统设置 → 隐私与安全性 → 定位服务中允许 NANJIA BEAUTY"
                    .into(),
            );
        }
        AuthorizationStatus::NotDetermined => {
            manager.request_when_in_use_authorization();
            wait_authorization(&auth_rx, Duration::from_secs(60))?;
        }
        _ => {}
    }

    manager.request_location();

    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        if Instant::now() >= deadline {
            return Err("定位超时，请重试".into());
        }

        if let Ok((latitude, longitude)) = loc_rx.try_recv() {
            return Ok(CurrentPositionDto {
                latitude: (latitude * 1_000_000.0).round() / 1_000_000.0,
                longitude: (longitude * 1_000_000.0).round() / 1_000_000.0,
            });
        }

        if let Ok(message) = err_rx.try_recv() {
            return Err(message);
        }

        thread::sleep(Duration::from_millis(50));
    }
}

#[cfg(target_os = "macos")]
fn wait_authorization(
    auth_rx: &mpsc::Receiver<corelocation::authorization::AuthorizationStatus>,
    timeout: Duration,
) -> Result<(), String> {
    use corelocation::authorization::AuthorizationStatus;

    let deadline = Instant::now() + timeout;
    loop {
        if Instant::now() >= deadline {
            return Err("等待定位授权超时，请重试并在系统弹窗中选择允许".into());
        }

        match auth_rx.try_recv() {
            Ok(AuthorizationStatus::AuthorizedAlways | AuthorizationStatus::AuthorizedWhenInUse) => {
                return Ok(());
            }
            Ok(AuthorizationStatus::Denied | AuthorizationStatus::Restricted) => {
                return Err(
                    "定位权限被拒绝，请在系统设置 → 隐私与安全性 → 定位服务中允许 NANJIA BEAUTY"
                        .into(),
                );
            }
            Ok(_) | Err(mpsc::TryRecvError::Empty) => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(mpsc::TryRecvError::Disconnected) => {
                return Err("定位授权流程异常中断".into());
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn get_current_position_macos() -> Result<CurrentPositionDto, String> {
    Err("当前平台请使用浏览器定位".into())
}

#[tauri::command]
pub async fn get_current_position_native() -> Result<CurrentPositionDto, String> {
    tauri::async_runtime::spawn_blocking(get_current_position_macos)
        .await
        .map_err(|err| format!("定位任务异常: {err}"))?
}
