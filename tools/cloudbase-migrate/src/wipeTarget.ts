import type cloudbase from '@cloudbase/node-sdk'

import { FALLBACK_COLLECTIONS } from './collections.js'
import { createManager } from './manager.js'
import { Logger } from './logger.js'
import type { MigrateClients } from './types.js'
import { deleteDocument, listAllCollections } from './utils.js'

export interface WipeStats {
  documentsDeleted: number
  storageObjectsDeleted: number
  errors: string[]
}

interface QueryBatch {
  data?: Array<Record<string, unknown> & { _id?: string }>
}

async function fetchAllDocuments(
  app: ReturnType<typeof cloudbase.init>,
  collection: string,
  pageSize: number
): Promise<Array<Record<string, unknown> & { _id?: string }>> {
  const db = app.database()
  const all: Array<Record<string, unknown> & { _id?: string }> = []
  let skip = 0

  while (true) {
    const res = (await db.collection(collection).skip(skip).limit(pageSize).get()) as QueryBatch
    const batch = res.data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break
    skip += batch.length
  }

  return all
}

function docId(doc: Record<string, unknown>): string | null {
  const id = doc._id
  if (typeof id === 'string' && id) return id
  if (id && typeof id === 'object' && '$oid' in id) {
    const oid = (id as { $oid?: string }).$oid
    if (typeof oid === 'string' && oid) return oid
  }
  return null
}

/** 清空目标环境：全部集合文档 + 全部云存储对象 */
export async function wipeTarget(clients: MigrateClients, logger: Logger): Promise<WipeStats> {
  const stats: WipeStats = { documentsDeleted: 0, storageObjectsDeleted: 0, errors: [] }
  const cfg = clients.config
  const envId = cfg.newEnvId

  logger.info('清空目标环境数据库…', { envId })

  let collections: string[]
  try {
    collections = await listAllCollections(cfg, envId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(`列举目标集合失败，使用内置列表: ${message}`)
    collections = [...FALLBACK_COLLECTIONS]
  }
  if (collections.length === 0) collections = [...FALLBACK_COLLECTIONS]

  for (const collection of collections) {
    const documents = await fetchAllDocuments(clients.newApp, collection, cfg.pageSize)
    if (documents.length === 0) continue
    logger.info(`删除目标集合 ${collection} 的 ${documents.length} 条文档`)

    for (const doc of documents) {
      const id = docId(doc)
      if (!id) continue
      try {
        await deleteDocument(cfg, envId, collection, id)
        stats.documentsDeleted += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        stats.errors.push(`删除文档 ${collection}/${id}: ${message}`)
      }
    }
  }

  logger.info('清空目标环境云存储…', { envId })
  try {
    const mgr = createManager(cfg, envId)
    const objects = await mgr.storage.listDirectoryFiles('')
    const fileKeys = objects
      .map((item) => item.Key)
      .filter((key): key is string => typeof key === 'string' && key.length > 0 && !key.endsWith('/'))

    stats.storageObjectsDeleted = fileKeys.length
    await mgr.storage.deleteDirectory('')
    logger.info(`目标云存储已清空（${fileKeys.length} 个对象）`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    stats.errors.push(`清空云存储失败: ${message}`)
    logger.error('清空云存储失败', { error: message })
  }

  return stats
}
