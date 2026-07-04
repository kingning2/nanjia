import gcoord from 'gcoord'

type CurrentPosition = {
  latitude: number
  longitude: number
}

export function getCurrentPosition(): Promise<CurrentPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前环境不支持定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const [longitude, latitude] = gcoord.transform(
          [position.coords.longitude, position.coords.latitude],
          gcoord.WGS84,
          gcoord.GCJ02
        )
        resolve({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6))
        })
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
