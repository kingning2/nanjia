import type { MediaFileDTO } from '@share/types/media'
import {
  UPLOAD_IMAGE_MIME_ALLOW,
  UPLOAD_VIDEO_SOURCE_MIME_ALLOW,
  type ImageCompressPreviewDTO,
  type UploadVideoOptions,
  type VideoCompressPresetDTO
} from '@share/types/upload'
import { notifyError } from '../../utils/feedback'
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

/** 选图后试压缩，返回预览信息与 WebP 字节（确认上传时直传，避免重复编码） */
export async function previewImageCompress(file: File): Promise<{
  preview: ImageCompressPreviewDTO
  webpBytes: Uint8Array
}> {
  const error = validateImageFile(file)
  if (error) {
    notifyError(error)
    throw new Error(error)
  }

  let body: Uint8Array
  try {
    body = new Uint8Array(await file.arrayBuffer())
  } catch {
    const msg = '读取图片失败，请换一张或缩小体积后重试'
    notifyError(msg)
    throw new Error(msg)
  }

  const preview = await invokeApi<ImageCompressPreviewDTO>(
    'preview_image_compress',
    body,
    '图片压缩预览失败'
  )

  return {
    preview,
    webpBytes: decodeBase64ToBytes(preview.webpBase64)
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
