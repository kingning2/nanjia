import type { LogLevel, MigrateConfig } from './types.js'

/**
 * 迁移配置（可按需修改，或通过 CLI / stdin JSON 覆盖）
 *
 * 跨环境迁移时 old/new 各用各的 CAM 密钥（与 `.env.*` 中一致）。
 */
export const config: MigrateConfig = {
  oldEnvId: 'your-old-env-id',
  newEnvId: 'your-new-env-id',
  oldSecretId: 'your-secret-id',
  oldSecretKey: 'your-secret-key',
  newSecretId: 'your-secret-id',
  newSecretKey: 'your-secret-key',
  concurrency: 5,
  wipeTargetFirst: true,
  logLevel: 'info',
  pageSize: 100,
  fileRetryCount: 3
}

function trimSecret(value: string | undefined): string {
  return value?.trim() ?? ''
}

/** 合并外部传入的配置（CLI / 环境变量） */
export function resolveConfig(overrides?: Partial<MigrateConfig>): MigrateConfig {
  const fromEnv: Partial<MigrateConfig> = {}

  const oldEnvId = process.env.MIGRATE_OLD_ENV_ID
  const newEnvId = process.env.MIGRATE_NEW_ENV_ID
  const secretId = process.env.CLOUDBASE_SECRET_ID ?? process.env.MIGRATE_SECRET_ID
  const secretKey = process.env.CLOUDBASE_SECRET_KEY ?? process.env.MIGRATE_SECRET_KEY

  if (oldEnvId) fromEnv.oldEnvId = oldEnvId.trim()
  if (newEnvId) fromEnv.newEnvId = newEnvId.trim()
  if (secretId) {
    const id = trimSecret(secretId)
    fromEnv.oldSecretId = id
    fromEnv.newSecretId = id
    fromEnv.secretId = id
  }
  if (secretKey) {
    const key = trimSecret(secretKey)
    fromEnv.oldSecretKey = key
    fromEnv.newSecretKey = key
    fromEnv.secretKey = key
  }

  const merged = { ...config, ...fromEnv, ...overrides }
  const oldSecretId = trimSecret(merged.oldSecretId ?? merged.secretId)
  const oldSecretKey = trimSecret(merged.oldSecretKey ?? merged.secretKey)
  const newSecretId = trimSecret(merged.newSecretId ?? merged.secretId ?? oldSecretId)
  const newSecretKey = trimSecret(merged.newSecretKey ?? merged.secretKey ?? oldSecretKey)

  // ponytail: 旧字段 overwriteExisting 仅作兼容，一律先清空目标
  const wipeTargetFirst = merged.wipeTargetFirst ?? true

  return {
    ...merged,
    oldEnvId: merged.oldEnvId.trim(),
    newEnvId: merged.newEnvId.trim(),
    oldSecretId,
    oldSecretKey,
    newSecretId,
    newSecretKey,
    wipeTargetFirst
  }
}

/** 校验配置完整性 */
export function assertConfig(cfg: MigrateConfig): void {
  const missing: string[] = []
  if (!cfg.oldEnvId || cfg.oldEnvId.includes('your-')) missing.push('oldEnvId')
  if (!cfg.newEnvId || cfg.newEnvId.includes('your-')) missing.push('newEnvId')
  if (!cfg.oldSecretId || cfg.oldSecretId.includes('your-')) missing.push('oldSecretId')
  if (!cfg.oldSecretKey || cfg.oldSecretKey.includes('your-')) missing.push('oldSecretKey')
  if (!cfg.newSecretId || cfg.newSecretId.includes('your-')) missing.push('newSecretId')
  if (!cfg.newSecretKey || cfg.newSecretKey.includes('your-')) missing.push('newSecretKey')
  if (cfg.oldEnvId === cfg.newEnvId) missing.push('oldEnvId/newEnvId 不能相同')
  if (missing.length) {
    throw new Error(`迁移配置不完整: ${missing.join(', ')}`)
  }
}

/** 按 envId 取对应环境的 CAM 密钥 */
export function credentialsForEnv(
  cfg: MigrateConfig,
  envId: string
): { secretId: string; secretKey: string } {
  if (envId === cfg.newEnvId) {
    return { secretId: cfg.newSecretId, secretKey: cfg.newSecretKey }
  }
  return { secretId: cfg.oldSecretId, secretKey: cfg.oldSecretKey }
}
