import { assertConfig, resolveConfig } from './config.js'
import { createClients, migrateDatabase } from './migrateDatabase.js'
import { Logger } from './logger.js'
import type { FileIdCache } from './migrateFiles.js'
import type { MigrateConfig, MigrateReport, MigrateRunResult } from './types.js'
import { wipeTarget } from './wipeTarget.js'

/** 执行完整环境迁移 */
export async function runMigration(overrides?: Partial<MigrateConfig>): Promise<MigrateRunResult> {
  const cfg = resolveConfig(overrides)
  assertConfig(cfg)

  const logger = new Logger(cfg.logLevel)
  logger.info('开始 CloudBase 环境迁移', {
    from: cfg.oldEnvId,
    to: cfg.newEnvId,
    concurrency: cfg.concurrency,
    wipeTargetFirst: cfg.wipeTargetFirst
  })

  const clients = createClients(cfg)
  const cache: FileIdCache = new Map()

  let documentsDeleted = 0
  let storageObjectsDeleted = 0
  const wipeErrors: string[] = []

  if (cfg.wipeTargetFirst) {
    const wiped = await wipeTarget(clients, logger)
    documentsDeleted = wiped.documentsDeleted
    storageObjectsDeleted = wiped.storageObjectsDeleted
    wipeErrors.push(...wiped.errors)
  }

  const report = await migrateDatabase(clients, logger, cache)
  report.documentsDeleted = documentsDeleted
  report.storageObjectsDeleted = storageObjectsDeleted
  report.errors = [...wipeErrors, ...report.errors]

  printReport(report, logger)

  return {
    documentsProcessed: report.documentsSuccess,
    mediaUploaded: report.files.success,
    skipped: report.documentsSkipped + report.files.cached,
    documentsDeleted,
    storageObjectsDeleted,
    errors: report.errors,
    durationMs: report.durationMs,
    report
  }
}

/** 输出统计报告 */
function printReport(report: MigrateReport, logger: Logger): void {
  logger.info('========== 迁移完成 ==========')
  logger.info(`耗时: ${(report.durationMs / 1000).toFixed(1)}s`)
  if (report.documentsDeleted != null && report.documentsDeleted > 0) {
    logger.info(`目标已清空: ${report.documentsDeleted} 条文档，${report.storageObjectsDeleted ?? 0} 个云存储对象`)
  }
  logger.info(
    `文档: 成功 ${report.documentsSuccess}，失败 ${report.documentsFailed}，跳过 ${report.documentsSkipped}`
  )
  logger.info(
    `文件: 上传 ${report.files.success}，缓存复用 ${report.files.cached}，失败 ${report.files.failed}`
  )

  for (const item of report.collections) {
    if (item.documentsSuccess + item.documentsFailed + item.documentsSkipped === 0) continue
    logger.info(`集合 ${item.collection}`, {
      success: item.documentsSuccess,
      failed: item.documentsFailed,
      skipped: item.documentsSkipped
    })
  }

  if (report.errors.length > 0) {
    logger.warn(`共 ${report.errors.length} 项错误（前 10 条）`)
    for (const err of report.errors.slice(0, 10)) {
      logger.error(err)
    }
  }
}

/** 从 stdin 或 --config-file 读取 JSON 配置 */
async function readRuntimeConfig(): Promise<Partial<MigrateConfig> | undefined> {
  const configFileIdx = process.argv.indexOf('--config-file')
  if (configFileIdx >= 0) {
    const filePath = process.argv[configFileIdx + 1]
    if (!filePath) throw new Error('--config-file 需要文件路径')
    const { readFile } = await import('node:fs/promises')
    const text = await readFile(filePath, 'utf8')
    return JSON.parse(text) as Partial<MigrateConfig>
  }

  if (process.argv.includes('--json')) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk))
    }
    const text = Buffer.concat(chunks).toString('utf8').trim()
    if (!text) return undefined
    return JSON.parse(text) as Partial<MigrateConfig>
  }

  return undefined
}

async function main(): Promise<void> {
  const runtimeConfig = await readRuntimeConfig()
  const result = await runMigration(runtimeConfig)

  if (process.argv.includes('--json-out')) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }

  if (result.errors.length > 0) {
    process.exitCode = 1
  }
}

// sidecar / CLI 入口（esbuild 打包为 CJS 后直接执行）
main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[FATAL] ${message}`)
  process.exit(1)
})
