/** 云存储上传 — SDK 直传契约 */

export interface UploadImageParams {
  /** 云存储路径，如 projects/covers/xxx.jpg */
  cloudPath: string
  /** 本地文件 MIME，如 image/jpeg */
  mimeType?: string
}

export interface UploadImageResultDTO {
  /** 云文件 ID，可用于 cloud.getTempFileURL */
  fileID: string
  /** 云存储完整路径 */
  cloudPath: string
  /** 临时访问 URL（管理端上传后可返回） */
  downloadUrl?: string
  /** 原始文件名 */
  originalName?: string
}

export interface UploadImageBatchResultDTO {
  items: UploadImageResultDTO[]
  failed: Array<{ cloudPath: string; reason: string }>
}

/** 允许的图片类型 */
export const UPLOAD_IMAGE_MIME_ALLOW = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const

/** 转 WebP 后的单文件大小上限（字节）；仅 Rust 端校验，前端勿用于拦截 */
export const UPLOAD_WEBP_MAX_BYTES = 10 * 1024 * 1024

/** 允许上传的源视频类型 */
export const UPLOAD_VIDEO_SOURCE_MIME_ALLOW = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska'
] as const

/** 源视频大小上限（字节）；仅 Rust 端校验 */
export const UPLOAD_VIDEO_SOURCE_MAX_BYTES = 200 * 1024 * 1024

/** 压缩后视频大小上限（字节）；仅 Rust 端校验 */
export const UPLOAD_VIDEO_MAX_BYTES = 20 * 1024 * 1024

/** 视频压缩预设（与 Rust VideoCompressPreset 对应） */
export type VideoCompressPresetDTO = 'standard' | 'high' | 'fast'

/** 视频上传选项（由管理端在上传前由用户选择） */
export interface UploadVideoOptions {
  /** 云存储路径前缀 */
  prefix?: string
  /** 是否压缩；为 false 时原片上传 */
  compress?: boolean
  /** 压缩预设；仅 compress=true 时生效 */
  preset?: VideoCompressPresetDTO
}

/** 图片 WebP 压缩预览（选图后试编码） */
export interface ImageCompressPreviewDTO {
  originalWidth: number
  originalHeight: number
  originalSize: number
  outputWidth: number
  outputHeight: number
  outputSize: number
  webpBase64: string
}

/** 选图并确认压缩后的载荷（供多图列表延迟上传） */
export interface PickedImagePayload {
  file: File
  preview: ImageCompressPreviewDTO
  webpBytes: Uint8Array
}

/** 视频压缩预览（选视频后试编码，保存前不上传） */
export interface VideoCompressPreviewDTO {
  originalSize: number
  outputSize: number
  compressed: boolean
  videoBase64: string
}

/** 选视频并确认压缩后的载荷（供媒体列表延迟上传） */
export interface PickedVideoPayload {
  file: File
  preview: VideoCompressPreviewDTO
  videoBytes: Uint8Array
}

/** Tauri 图片压缩进度事件名（与 Rust `PROGRESS_EVENT` 一致） */
export const IMAGE_COMPRESS_PROGRESS_EVENT = 'image-compress-progress' as const

/** 批量/目录压缩实时进度（`image-compress-progress` 事件载荷） */
export interface ImageCompressProgressDTO {
  sessionId: string
  total: number
  completed: number
  succeeded: number
  failed: number
  bytesIn: number
  bytesOut: number
  elapsedMs: number
  imagesPerSec: number
  etaSecs?: number | null
  compressionRatio?: number | null
}

/** 批量请求体切片清单（`x-batch-manifest` 头） */
export interface BatchManifestEntryDTO {
  name: string
  offset: number
  length: number
}

/** 单张批量压缩结果（含文件名标签） */
export interface BatchImageCompressItemDTO extends ImageCompressPreviewDTO {
  label: string
}

/** Rust 端批量压缩返回 */
export interface BatchImageCompressResultDTO {
  items: BatchImageCompressItemDTO[]
  total: number
  succeeded: number
  failed: number
  bytesIn: number
  bytesOut: number
  elapsedMs: number
  failures: Array<{ path: string; reason: string }>
}
