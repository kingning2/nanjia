import { cloneJson, isCloudFileId } from './utils.js'

/**
 * 递归收集文档内所有 cloud:// fileID
 */
export function collectCloudFileIds(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (isCloudFileId(trimmed)) out.add(trimmed)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectCloudFileIds(item, out)
    return
  }

  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectCloudFileIds(nested, out)
    }
  }
}

/** 文档内是否仍含指向旧环境的 cloud:// fileID */
export function containsOldEnvFileId(value: unknown, oldEnvId: string): boolean {
  if (!oldEnvId) return false

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return isCloudFileId(trimmed) && trimmed.includes(oldEnvId)
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsOldEnvFileId(item, oldEnvId))
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((nested) =>
      containsOldEnvFileId(nested, oldEnvId)
    )
  }

  return false
}

/**
 * 递归替换文档内 cloud:// fileID
 * 返回新对象，不修改原引用
 */
export function replaceCloudFileIds(value: unknown, mapping: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (isCloudFileId(trimmed)) {
      return mapping.get(trimmed) ?? trimmed
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceCloudFileIds(item, mapping))
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const next: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(source)) {
      next[key] = replaceCloudFileIds(nested, mapping)
    }
    return next
  }

  return value
}

/** 深拷贝并替换 fileID */
export function transformDocument<T extends Record<string, unknown>>(
  doc: T,
  mapping: ReadonlyMap<string, string>
): T {
  return replaceCloudFileIds(cloneJson(doc), mapping) as T
}
