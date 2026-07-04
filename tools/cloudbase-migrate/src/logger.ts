import type { LogLevel } from './types.js'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

/** 结构化日志输出 */
export class Logger {
  private readonly minLevel: number
  private readonly startMs = Date.now()

  constructor(level: LogLevel = 'info') {
    this.minLevel = LEVEL_ORDER[level]
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= this.minLevel
  }

  private format(level: LogLevel, message: string, extra?: Record<string, unknown>): string {
    const ts = new Date().toISOString()
    const elapsed = ((Date.now() - this.startMs) / 1000).toFixed(1)
    const suffix = extra ? ` ${JSON.stringify(extra)}` : ''
    return `[${ts}] [${level.toUpperCase()}] [+${elapsed}s] ${message}${suffix}`
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) console.debug(this.format('debug', message, extra))
  }

  info(message: string, extra?: Record<string, unknown>): void {
    if (this.shouldLog('info')) console.info(this.format('info', message, extra))
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message, extra))
  }

  error(message: string, extra?: Record<string, unknown>): void {
    if (this.shouldLog('error')) console.error(this.format('error', message, extra))
  }

  collection(name: string): void {
    this.info(`开始迁移集合: ${name}`, { collection: name })
  }

  document(collection: string, docId: string, index: number, total: number): void {
    this.debug(`处理文档 ${index + 1}/${total}`, { collection, documentId: docId })
  }

  file(oldFileId: string, status: 'start' | 'cached' | 'success' | 'failed'): void {
    const labels = { start: '迁移文件', cached: '复用缓存', success: '文件成功', failed: '文件失败' }
    const level: LogLevel = status === 'failed' ? 'error' : 'debug'
    const msg = `${labels[status]}: ${oldFileId}`
    if (level === 'error') this.error(msg)
    else this.debug(msg)
  }
}
