import { invoke } from '@tauri-apps/api/core'

const urlCache = new Map<string, string>()

/** 将 cloud:// fileID 或历史临时 HTTPS 链接换成当前可访问的 URL（失败不弹 toast，由展示组件处理） */
export function resolveStorageUrl(reference: string): Promise<string> {
  const cached = urlCache.get(reference)
  if (cached) {
    return Promise.resolve(cached)
  }
  return invoke<string>('resolve_storage_url', { reference }).then((url) => {
    urlCache.set(reference, url)
    return url
  })
}

export function deleteStorageFile(reference: string): Promise<void> {
  return invoke<void>('delete_storage_file', { reference }).then(() => {
    clearStorageUrlCache(reference)
  })
}

export function clearStorageUrlCache(reference?: string) {
  if (reference) {
    urlCache.delete(reference)
    return
  }
  urlCache.clear()
}
