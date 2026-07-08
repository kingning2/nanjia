/** 管理端多环境同步契约 */

export interface EnvProfileDTO {
  id: string
  name: string
  slug: string
  envId: string
  apiBase?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EnvBillingDTO {
  envId: string
  packageId: string
  status: string
  payMode: string
  expireTime?: string | null
  daysRemaining?: number | null
  isAutoRenew: boolean
  isAlwaysFree: boolean
}

export interface MediaCleanupResultDTO {
  deletedCount: number
  failedCount: number
  errors: string[]
}

export interface MediaRedundancyItemDTO {
  fileId: string
  originalName: string
  cloudPath: string
  mimeType: string
  kind: 'image' | 'video' | string
  /** 二次全文检索后仍无命中，可较放心删除 */
  safeToDelete: boolean
  /** 数据库里命中疑似片段（需人工确认） */
  referenceHits: string[]
}

export interface MediaRedundancyReportDTO {
  profileId: string
  envName: string
  referencedCount: number
  libraryCount: number
  unusedCount: number
  unusedImageCount: number
  unusedVideoCount: number
  staleReferenceCount: number
  /** 二次检索后确认可安全删除的数量 */
  safeUnusedCount: number
  /** 仍有疑似命中、需人工确认的数量 */
  suspectUnusedCount: number
  unusedItems: MediaRedundancyItemDTO[]
}

export interface MigrateEnvParams {
  sourceProfileId: string
  targetProfileId: string
}

export interface MigrateEnvResultDTO {
  documentsProcessed: number
  mediaUploaded: number
  skipped: number
  documentsDeleted?: number
  storageObjectsDeleted?: number
  errors: string[]
  durationMs: number
}
