import cloudbase from '@cloudbase/node-sdk'

import { FALLBACK_COLLECTIONS } from './collections.js'
import type { MigrateConfig, MigrateClients, MigrateReport } from './types.js'
import { migrateCollection } from './migrateCollection.js'
import type { FileIdCache } from './migrateFiles.js'
import { Logger } from './logger.js'
import { listAllCollections } from './utils.js'

/** 初始化旧 / 新环境 SDK 实例（各用各的 CAM 密钥） */
export function createClients(cfg: MigrateConfig): MigrateClients {
  const oldApp = cloudbase.init({
    env: cfg.oldEnvId,
    secretId: cfg.oldSecretId,
    secretKey: cfg.oldSecretKey
  })
  const newApp = cloudbase.init({
    env: cfg.newEnvId,
    secretId: cfg.newSecretId,
    secretKey: cfg.newSecretKey
  })
  return { oldApp, newApp, config: cfg }
}

/** 自动发现集合名（来源环境），并与内置列表合并，避免漏掉 home_settings 等 */
async function resolveCollections(clients: MigrateClients, logger: Logger): Promise<string[]> {
  const names = new Set<string>(FALLBACK_COLLECTIONS)
  try {
    const discovered = await listAllCollections(clients.config, clients.config.oldEnvId)
    for (const name of discovered) {
      names.add(name)
    }
    if (discovered.length > 0) {
      logger.info(`自动发现 ${discovered.length} 个集合`, { collections: [...names] })
    } else {
      logger.warn('ListCollections 返回空列表，使用内置集合列表')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(`ListCollections 失败，使用内置集合列表: ${message}`)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** 迁移全部数据库集合 */
export async function migrateDatabase(
  clients: MigrateClients,
  logger: Logger,
  cache: FileIdCache
): Promise<MigrateReport> {
  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const errors: string[] = []
  const fileStats = { success: 0, failed: 0, cached: 0 }

  const collections = await resolveCollections(clients, logger)
  const collectionStats = []

  for (const collection of collections) {
    const stat = await migrateCollection(clients, collection, cache, fileStats, errors, logger)
    collectionStats.push(stat)
  }

  const documentsSuccess = collectionStats.reduce((sum, item) => sum + item.documentsSuccess, 0)
  const documentsFailed = collectionStats.reduce((sum, item) => sum + item.documentsFailed, 0)
  const documentsSkipped = collectionStats.reduce((sum, item) => sum + item.documentsSkipped, 0)
  const finishedAt = new Date().toISOString()

  return {
    startedAt,
    finishedAt,
    durationMs: Date.now() - startMs,
    collections: collectionStats,
    files: fileStats,
    documentsSuccess,
    documentsFailed,
    documentsSkipped,
    errors
  }
}
