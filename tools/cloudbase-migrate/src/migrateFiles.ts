import { downloadFile } from './downloadFile.js'
import { uploadFile } from './uploadFile.js'
import { Logger } from './logger.js'
import type { FileStats, MigrateClients } from './types.js'
import { runPool, sleep } from './utils.js'

/** 全局 fileID 映射缓存：oldFileID → newFileID */
export type FileIdCache = Map<string, string>

/**
 * 迁移单个 fileID（含重试与缓存）
 */
export async function migrateOneFileId(
  clients: MigrateClients,
  cache: FileIdCache,
  oldFileId: string,
  logger: Logger,
  stats: FileStats
): Promise<string> {
  const cached = cache.get(oldFileId)
  if (cached) {
    logger.file(oldFileId, 'cached')
    stats.cached += 1
    return cached
  }

  const maxAttempts = clients.config.fileRetryCount
  let lastError = '未知错误'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { buffer } = await downloadFile(clients, oldFileId, logger)
      const uploaded = await uploadFile(clients, oldFileId, buffer, logger)
      cache.set(oldFileId, uploaded.fileId)
      stats.success += 1
      return uploaded.fileId
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      logger.warn(`文件迁移失败 (${attempt}/${maxAttempts})`, { fileId: oldFileId, error: lastError })
      if (attempt < maxAttempts) await sleep(1000 * attempt)
    }
  }

  stats.failed += 1
  logger.file(oldFileId, 'failed')
  throw new Error(`文件迁移失败: ${oldFileId} — ${lastError}`)
}

/**
 * 批量迁移 fileID（并发上传，复用缓存）
 * 返回成功替换的映射；失败的 fileID 记入 errors 但不中断其它文件
 */
export async function migrateFileIds(
  clients: MigrateClients,
  cache: FileIdCache,
  fileIds: readonly string[],
  logger: Logger,
  stats: FileStats,
  errors: string[]
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>()
  const unique = [...new Set(fileIds)]

  await runPool(unique, clients.config.concurrency, async (oldFileId) => {
    try {
      const newFileId = await migrateOneFileId(clients, cache, oldFileId, logger, stats)
      mapping.set(oldFileId, newFileId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(message)
    }
  })

  return mapping
}
