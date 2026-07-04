import type cloudbase from '@cloudbase/node-sdk'

/** 日志等级 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 单环境 CAM 密钥 */
export interface EnvCredentials {
  envId: string
  secretId: string
  secretKey: string
}

/** 迁移配置 */
export interface MigrateConfig {
  oldEnvId: string
  newEnvId: string
  /** 来源环境密钥 */
  oldSecretId: string
  oldSecretKey: string
  /** 目标环境密钥（可与来源相同） */
  newSecretId: string
  newSecretKey: string
  /** @deprecated CLI 单环境调试：等同 oldSecretId */
  secretId?: string
  /** @deprecated CLI 单环境调试：等同 oldSecretKey */
  secretKey?: string
  concurrency: number
  /** 迁移前清空目标环境（数据库 + 云存储），再完整复制来源 */
  wipeTargetFirst: boolean
  logLevel: LogLevel
  pageSize: number
  fileRetryCount: number
}

/** CloudBase 应用实例（旧 / 新环境各一份） */
export interface MigrateClients {
  oldApp: ReturnType<typeof cloudbase.init>
  newApp: ReturnType<typeof cloudbase.init>
  config: MigrateConfig
}

/** 单集合迁移统计 */
export interface CollectionStats {
  collection: string
  documentsSuccess: number
  documentsFailed: number
  documentsSkipped: number
}

/** 文件迁移统计 */
export interface FileStats {
  success: number
  failed: number
  cached: number
}

/** 迁移总报告 */
export interface MigrateReport {
  startedAt: string
  finishedAt: string
  durationMs: number
  collections: CollectionStats[]
  files: FileStats
  documentsSuccess: number
  documentsFailed: number
  documentsSkipped: number
  documentsDeleted?: number
  storageObjectsDeleted?: number
  errors: string[]
}

/** CLI / Tauri 调用结果（精简） */
export interface MigrateRunResult {
  documentsProcessed: number
  mediaUploaded: number
  skipped: number
  documentsDeleted?: number
  storageObjectsDeleted?: number
  errors: string[]
  durationMs: number
  report: MigrateReport
}

/** 云数据库文档（动态字段） */
export type CloudDocument = Record<string, unknown> & {
  _id?: string
}
