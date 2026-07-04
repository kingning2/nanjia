import type { MigrateClients } from './types.js'
import { cloudPathFromFileId } from './utils.js'
import { Logger } from './logger.js'

interface UploadResult {
  fileId: string
  cloudPath: string
}

/**
 * 上传到新环境，保持 cloudPath 不变
 */
export async function uploadFile(
  clients: MigrateClients,
  oldFileId: string,
  buffer: Buffer,
  logger: Logger
): Promise<UploadResult> {
  const cloudPath = cloudPathFromFileId(oldFileId)
  if (!cloudPath) {
    throw new Error(`无法从 fileID 解析 cloudPath: ${oldFileId}`)
  }

  const result = await clients.newApp.uploadFile({
    cloudPath,
    fileContent: buffer
  })

  const fileId = result.fileID
  if (!fileId) {
    throw new Error('上传成功但未返回 fileID')
  }

  logger.file(oldFileId, 'success')
  return { fileId, cloudPath }
}
