import { invoke, isTauri } from '@tauri-apps/api/core'
import gcoord from 'gcoord'

type CurrentPosition = {
  latitude: number
  longitude: number
}

function toGcj02(longitude: number, latitude: number): CurrentPosition {
  const [gcjLng, gcjLat] = gcoord.transform([longitude, latitude], gcoord.WGS84, gcoord.GCJ02)
  return {
    latitude: Number(gcjLat.toFixed(6)),
    longitude: Number(gcjLng.toFixed(6))
  }
}

function getBrowserPosition(): Promise<CurrentPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前环境不支持定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(
          toGcj02(position.coords.longitude, position.coords.latitude)
        )
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('定位权限被拒绝，请在系统设置中允许定位'))
          return
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(new Error('无法获取当前位置'))
          return
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error('定位超时，请重试'))
          return
        }
        reject(new Error('定位失败'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  })
}

/** macOS Tauri：WKWebView 的 geolocation 会直接 PERMISSION_DENIED，走原生 CoreLocation */
function isMacTauri(): boolean {
  return isTauri() && /Mac/i.test(navigator.userAgent)
}

export async function getCurrentPosition(): Promise<CurrentPosition> {
  if (isMacTauri()) {
    const pos = await invoke<{ latitude: number; longitude: number }>('get_current_position_native')
    return toGcj02(pos.longitude, pos.latitude)
  }

  return getBrowserPosition()
}
