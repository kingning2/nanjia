import { invoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core'
import { notifyError } from '../utils/feedback'

/**
 * Tauri invoke 封装：失败时自动 message.error 展示 Rust/云端返回原因，再抛出供调用方中断流程。
 * 第三参可为 InvokeOptions，或省略 options 时直接传 fallback 文案。
 */
export async function invokeApi<T>(
  command: string,
  args?: InvokeArgs,
  optionsOrFallback?: InvokeOptions | string,
  maybeFallback = '操作失败'
): Promise<T> {
  const options = typeof optionsOrFallback === 'string' ? undefined : optionsOrFallback
  const fallback = typeof optionsOrFallback === 'string' ? optionsOrFallback : maybeFallback

  try {
    return await invoke<T>(command, args, options)
  } catch (error) {
    notifyError(error, fallback)
    throw error
  }
}
