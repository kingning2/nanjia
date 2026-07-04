import type { MessageInstance } from 'antd/es/message/interface'

let messageApi: MessageInstance | null = null

/** 在 AntdApp 内挂载后注入，供 service 层统一弹出错误 */
export function registerMessage(api: MessageInstance | null) {
  messageApi = api
}

/** 从 Tauri invoke / 未知异常中提取可展示的错误文案 */
export function formatErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (typeof error === 'string') {
    const text = error.trim()
    return text || fallback
  }
  if (error instanceof Error) {
    return error.message.trim() || fallback
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim()
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim()
    }
    if (typeof record.data === 'string' && record.data.trim()) {
      return record.data.trim()
    }
  }
  return fallback
}

/** 统一用 message 展示接口/任务失败原因 */
export function notifyError(error: unknown, fallback = '操作失败'): string {
  const text = formatErrorMessage(error, fallback)
  if (messageApi) {
    messageApi.error(text)
  } else {
    console.error('[notifyError]', text, error)
  }
  return text
}

/** 操作成功提示（与 notifyError 共用 App 内 message 实例） */
export function notifySuccess(content: string): void {
  if (messageApi) {
    messageApi.success(content)
  } else {
    console.log('[notifySuccess]', content)
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
