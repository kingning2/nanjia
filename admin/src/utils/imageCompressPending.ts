import type { ImageCompressPreviewDTO } from '@share/types/upload'
import { previewImageCompress } from '../services/cloud/upload'

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

export async function compressImageFile(file: File): Promise<PendingImageCompress> {
  const originalPreviewUrl = URL.createObjectURL(file)
  try {
    const { preview, webpBytes } = await previewImageCompress(file)
    return {
      file,
      originalPreviewUrl,
      compressedPreviewUrl: bytesToObjectUrl(webpBytes),
      preview,
      webpBytes
    }
  } catch (error) {
    URL.revokeObjectURL(originalPreviewUrl)
    throw error
  }
}
