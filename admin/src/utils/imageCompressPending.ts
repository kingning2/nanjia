import type { ImageCompressPreviewDTO } from '@share/types/upload'
import { batchPreviewImageCompress } from '../services/cloud/upload'

export interface PendingImageCompress {
  file: File
  originalPreviewUrl: string
  compressedPreviewUrl: string
  preview: ImageCompressPreviewDTO
  webpBytes: Uint8Array
}

export function bytesToObjectUrl(bytes: Uint8Array, mime = 'image/webp'): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }))
}

export function revokePendingImage(item: PendingImageCompress | null) {
  if (!item) return
  URL.revokeObjectURL(item.originalPreviewUrl)
  URL.revokeObjectURL(item.compressedPreviewUrl)
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function toPendingItem(file: File, preview: ImageCompressPreviewDTO, webpBytes: Uint8Array): PendingImageCompress {
  const originalPreviewUrl = URL.createObjectURL(file)
  return {
    file,
    originalPreviewUrl,
    compressedPreviewUrl: bytesToObjectUrl(webpBytes),
    preview,
    webpBytes
  }
}

export async function compressImageFile(file: File): Promise<PendingImageCompress> {
  const items = await compressImageFiles([file])
  const item = items[0]
  if (!item) {
    throw new Error('图片压缩失败')
  }
  return item
}

/** 多图批量压缩（Rust 端并行，支持进度回调） */
export async function compressImageFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<PendingImageCompress[]> {
  if (files.length === 0) return []

  const fileByName = new Map(files.map((file) => [file.name, file]))
  const result = await batchPreviewImageCompress(files, (progress) => {
    onProgress?.(progress.completed, progress.total)
  })

  const pending: PendingImageCompress[] = []
  for (const item of result.items) {
    const file = fileByName.get(item.label)
    if (!file) continue
    const webpBytes = decodeBase64ToBytes(item.webpBase64)
    const { label: _label, ...preview } = item
    pending.push(toPendingItem(file, preview, webpBytes))
  }
  return pending
}
