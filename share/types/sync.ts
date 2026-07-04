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
