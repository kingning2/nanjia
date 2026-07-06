/** 与 taro build --env 一致：development | test | production */
export function getBuildEnv(): string {
  return process.env.TARO_APP_BUILD_ENV || 'production'
}

/** 本地持久化 key 按构建环境隔离，避免 dev/test/prod 串数据 */
export function scopedStorageKey(key: string): string {
  return `nj:${getBuildEnv()}:${key}`
}
