import CloudBase from '@cloudbase/manager-node'

import { credentialsForEnv } from './config.js'
import type { MigrateConfig } from './types.js'

/** 目标环境 manager-node（列举 / 批量删除云存储） */
export function createManager(cfg: MigrateConfig, envId: string): CloudBase {
  const { secretId, secretKey } = credentialsForEnv(cfg, envId)
  return new CloudBase({ secretId, secretKey, envId })
}
