import type { MigrateClients } from './types.js'
import { Logger } from './logger.js'

interface DownloadResult {
  buffer: Buffer
}

/**
 * 从旧环境下载云存储文件
 */
export async function downloadFile(
  clients: MigrateClients,
  fileId: string,
  logger: Logger
): Promise<DownloadResult> {
  logger.file(fileId, 'start')

  const result = await clients.oldApp.downloadFile({ fileID: fileId })
  const content = result.fileContent
  if (!content || !Buffer.isBuffer(content)) {
    throw new Error('下载结果为空')
  }

  return { buffer: content }
}
