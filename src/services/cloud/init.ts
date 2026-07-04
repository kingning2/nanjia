import Taro from '@tarojs/taro'

declare const wx: any

let initPromise: Promise<void> | null = null
let initialized = false

export function getCloudEnvId() {
  return process.env.TARO_APP_CLOUD_ENV_ID || ''
}

export function ensureCloudInit() {
  if (initialized) {
    return Promise.resolve()
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = new Promise<void>((resolve, reject) => {
    const cloud = Taro.cloud || (typeof wx !== 'undefined' ? wx.cloud : undefined)
    const env = getCloudEnvId()

    if (!cloud) {
      reject(new Error('当前环境不支持云开发'))
      return
    }

    if (!env) {
      reject(new Error('缺少云环境 ID，请在 .env 中配置 TARO_APP_CLOUD_ENV_ID'))
      return
    }

    try {
      cloud.init({
        env,
        traceUser: true
      })
      initialized = true
      console.log('cloud init ok =>', env)
      resolve()
    } catch (error) {
      reject(error)
    }
  })

  return initPromise
}
