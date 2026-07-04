/** 开发 / 测试构建为 true，生产构建为 false（见各 .env.* 中 TARO_APP_DEBUG_PANEL） */
export function isDebugPanelEnabled(): boolean {
  return process.env.TARO_APP_DEBUG_PANEL === 'true'
}

/** 与 taro build --env 一致：development | test | production */
export function getBuildEnv(): string {
  return process.env.TARO_APP_BUILD_ENV || 'production'
}

/** 本地持久化 key 按构建环境隔离，避免 dev/test/prod 串数据 */
export function scopedStorageKey(key: string): string {
  return `nj:${getBuildEnv()}:${key}`
}
