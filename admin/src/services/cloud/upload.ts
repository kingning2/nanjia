import type { MediaFileDTO } from '@share/types/media'
import {
  UPLOAD_IMAGE_MIME_ALLOW,
  UPLOAD_VIDEO_SOURCE_MIME_ALLOW,
  type BatchImageCompressResultDTO,
  type BatchManifestEntryDTO,
  type ImageCompressPreviewDTO,
  IMAGE_COMPRESS_PROGRESS_EVENT,
  type ImageCompressProgressDTO,
  type UploadVideoOptions,
  type VideoCompressPresetDTO
} from '@share/types/upload'
import { listen } from '@tauri-apps/api/event'
import { notifyError } from '../../utils/feedback'
import { getWorkConcurrencyFor, runPool } from '../../utils/runPool'
import { invokeApi } from '../tauri'

const IMAGE_EXT_ALLOW = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] as const
const VIDEO_EXT_ALLOW = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'] as const

export function validateImageFile(file: File): string | null {
  const mimeOk =
    !file.type ||
    (UPLOAD_IMAGE_MIME_ALLOW as readonly string[]).includes(file.type) ||
    file.type === 'image/jpg'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const extOk = IMAGE_EXT_ALLOW.includes(ext as (typeof IMAGE_EXT_ALLOW)[number])

  if (!mimeOk && !extOk) {
    return '仅支持 png / jpg / jpeg / gif / webp / bmp'
  }
  return null
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

/** 多图批量压缩（Rust Rayon 引擎，进度经 Tauri 事件推送） */
export async function batchPreviewImageCompress(
  files: File[],
  onProgress?: (progress: ImageCompressProgressDTO) => void
): Promise<BatchImageCompressResultDTO> {
  if (files.length === 0) {
    return {
      items: [],
      total: 0,
      succeeded: 0,
      failed: 0,
      bytesIn: 0,
      bytesOut: 0,
      elapsedMs: 0,
      failures: []
    }
  }

  for (const file of files) {
    const error = validateImageFile(file)
    if (error) {
      notifyError(`${file.name}：${error}`)
      throw new Error(error)
    }
  }

  const sessionId = crypto.randomUUID()
  const total = files.length
  let readDone = 0

  const report = (compressDone: number) => {
    const readWeight = 0.25
    const compressWeight = 0.75
    const readPart = readDone >= total ? readWeight : (readDone / total) * readWeight
    const compressPart = total > 0 ? (compressDone / total) * compressWeight : 0
    const completed = Math.min(total, Math.round((readPart + compressPart) * total))
    onProgress?.({
      sessionId,
      total,
      completed,
      succeeded: compressDone,
      failed: 0,
      bytesIn: 0,
      bytesOut: 0,
      elapsedMs: 0,
      imagesPerSec: 0
    })
  }

  report(0)

  const manifest: BatchManifestEntryDTO[] = []
  const chunks: Uint8Array[] = []
  let offset = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      const msg = `读取图片失败：${file.name}`
      notifyError(msg)
      throw new Error(msg)
    }
    manifest.push({ name: file.name, offset, length: bytes.length })
    chunks.push(bytes)
    offset += bytes.length
    readDone = i + 1
    report(0)
  }

  const body = concatBytes(chunks)
  const unlisten = await listen<ImageCompressProgressDTO>(
    IMAGE_COMPRESS_PROGRESS_EVENT,
    (event) => {
      if (event.payload.sessionId !== sessionId) return
      report(event.payload.completed)
    }
  )

  try {
    return await invokeApi<BatchImageCompressResultDTO>(
      'batch_preview_image_compress',
      body,
      {
        headers: {
          'x-batch-manifest': encodeURIComponent(JSON.stringify(manifest)),
          'x-session-id': sessionId
        }
      },
      '批量图片压缩失败'
    )
  } finally {
    void unlisten()
  }
}

/** 选图后试压缩，返回预览信息与 WebP 字节（确认上传时直传，避免重复编码） */
export async function previewImageCompress(file: File): Promise<{
  preview: ImageCompressPreviewDTO
  webpBytes: Uint8Array
}> {
  const result = await batchPreviewImageCompress([file])
  const item = result.items[0]
  if (!item) {
    const reason = result.failures[0]?.reason ?? '图片压缩失败'
    throw new Error(reason)
  }

  return {
    preview: item,
    webpBytes: decodeBase64ToBytes(item.webpBase64)
  }
}

export async function uploadWebpBytes(
  webpBytes: Uint8Array,
  originalName: string,
  prefix = 'projects/uploads'
): Promise<MediaFileDTO> {
  if (webpBytes.length === 0) {
    const msg = 'WebP 数据为空'
    notifyError(msg)
    throw new Error(msg)
  }

  return invokeApi<MediaFileDTO>(
    'upload_webp_bytes',
    webpBytes,
    {
      headers: {
        'x-original-name': encodeURIComponent(originalName),
        'x-upload-prefix': prefix
      }
    },
    '上传失败'
  )
}

export async function uploadWebpBatch(
  items: Array<{ webpBytes: Uint8Array; originalName: string }>,
  prefix: string,
  onProgress?: (completed: number, total: number) => void
): Promise<MediaFileDTO[]> {
  if (items.length === 0) return []

  return runPool(
    items,
    (item) => uploadWebpBytes(item.webpBytes, item.originalName, prefix),
    {
      concurrency: getWorkConcurrencyFor(items.length),
      onProgress
    }
  )
}

export function validateVideoFile(file: File): string | null {
  const mimeOk =
    !file.type ||
    (UPLOAD_VIDEO_SOURCE_MIME_ALLOW as readonly string[]).includes(file.type)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const extOk = VIDEO_EXT_ALLOW.includes(ext as (typeof VIDEO_EXT_ALLOW)[number])

  if (!mimeOk && !extOk) {
    return '仅支持 mp4 / mov / avi / mkv / webm'
  }
  return null
}

export async function uploadVideoFile(
  file: File,
  options: UploadVideoOptions | string = {}
): Promise<MediaFileDTO> {
  const normalized: UploadVideoOptions =
    typeof options === 'string' ? { prefix: options } : options

  const prefix = normalized.prefix ?? 'categories/videos'
  const compress = normalized.compress ?? false
  const preset: VideoCompressPresetDTO = normalized.preset ?? 'standard'
  const error = validateVideoFile(file)
  if (error) {
    notifyError(error)
    throw new Error(error)
  }

  let body: Uint8Array
  try {
    body = new Uint8Array(await file.arrayBuffer())
  } catch {
    const msg = '读取视频失败，请换一个小文件后重试'
    notifyError(msg)
    throw new Error(msg)
  }

  if (body.length === 0) {
    const msg = '视频数据为空'
    notifyError(msg)
    throw new Error(msg)
  }

  return invokeApi<MediaFileDTO>(
    'upload_video_bytes',
    body,
    {
      headers: {
        'x-original-name': encodeURIComponent(file.name),
        'x-upload-prefix': prefix,
        'x-video-compress': compress ? '1' : '0',
        'x-video-compress-preset': preset
      }
    },
    '视频上传失败'
  )
}

export async function listUploadedMedia(
  limit = 50,
  skip = 0
): Promise<MediaFileDTO[]> {
  return invokeApi<MediaFileDTO[]>('list_uploaded_media', { limit, skip }, '加载媒体库失败')
}
