import { collectCloudFileIds, containsOldEnvFileId, clearOldEnvFileIds, transformDocument } from './fileScanner.js'
import { migrateFileIds, type FileIdCache } from './migrateFiles.js'
import { Logger } from './logger.js'
import type { CloudDocument, CollectionStats, FileStats, MigrateClients } from './types.js'
import { upsertDocument, normalizeDocumentId } from './utils.js'

interface QueryBatch {
  data?: CloudDocument[]
}

/**
 * 分页读取集合内全部文档（串行分页，避免限流）
 */
async function fetchAllDocuments(
  clients: MigrateClients,
  collection: string,
  logger: Logger
): Promise<CloudDocument[]> {
  const db = clients.oldApp.database()
  const pageSize = clients.config.pageSize
  const all: CloudDocument[] = []
  let skip = 0

  while (true) {
    const res = (await db.collection(collection).skip(skip).limit(pageSize).get()) as QueryBatch
    const batch = res.data ?? []
    all.push(...batch)
    logger.debug(`读取分页`, { collection, skip, count: batch.length })
    if (batch.length < pageSize) break
    skip += batch.length
  }

  return all
}

/**
 * 迁移单个集合：读源文档 → 迁文件 → 替换 fileID → 写入目标（目标应已清空）
 */
export async function migrateCollection(
  clients: MigrateClients,
  collection: string,
  cache: FileIdCache,
  fileStats: FileStats,
  errors: string[],
  logger: Logger
): Promise<CollectionStats> {
  const stats: CollectionStats = {
    collection,
    documentsSuccess: 0,
    documentsFailed: 0,
    documentsSkipped: 0
  }

  logger.collection(collection)
  const documents = await fetchAllDocuments(clients, collection, logger)
  logger.info(`集合 ${collection} 共 ${documents.length} 条文档`)

  for (let i = 0; i < documents.length; i += 1) {
    const doc = documents[i]!
    const docId = typeof doc._id === 'string' ? doc._id : `index-${i}`
    logger.document(collection, docId, i, documents.length)

    try {
      const fileIdSet = new Set<string>()
      collectCloudFileIds(doc, fileIdSet)
      const fileIds = [...fileIdSet]

      const mapping = await migrateFileIds(clients, cache, fileIds, logger, fileStats, errors)

      const unresolved = fileIds.filter((id) => !mapping.has(id))
      if (unresolved.length > 0) {
        errors.push(
          `${collection}/${docId}: ${unresolved.length} 个 fileID 未迁移成功，已清空对应媒体后继续写入`
        )
      }

      let transformed = transformDocument(doc, mapping) as CloudDocument
      transformed = clearOldEnvFileIds(
        transformed,
        clients.config.oldEnvId
      ) as CloudDocument
      if (containsOldEnvFileId(transformed, clients.config.oldEnvId)) {
        throw new Error('fileID 替换后仍含旧环境引用')
      }

      await upsertDocument(
        clients.config,
        clients.config.newEnvId,
        collection,
        normalizeDocumentId(transformed)
      )
      stats.documentsSuccess += 1
    } catch (err) {
      stats.documentsFailed += 1
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${collection}/${docId}: ${message}`)
      logger.error('文档迁移失败', { collection, documentId: docId, error: message })
    }
  }

  return stats
}
