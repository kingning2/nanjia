import Taro from '@tarojs/taro'
import { getBuildEnv, scopedStorageKey } from '../utils/env'

const DEFAULT_API_CACHE_TTL_MS = 30 * 60 * 1000

function resolveApiCacheTtlMs(): number {
  // ponytail: 非 production 默认 3s，生产 30min；勿运行时读未注入的 process.env
  return getBuildEnv() === 'production' ? DEFAULT_API_CACHE_TTL_MS : 3 * 1000
}

export const API_CACHE_TTL_MS = resolveApiCacheTtlMs()
const IS_DEV = getBuildEnv() === 'development'

type CacheEntry<T> = {
  data: T
  expiresAt: number
  /** 写入时的 TTL；旧条目无此字段，按 remaining 与当前 TTL 校验 */
  ttlMs?: number
}

type CacheDebugRecord = {
  at: number
  event: string
  key: string
  extra?: Record<string, number | string>
}

const memory = new Map<string, CacheEntry<unknown>>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const cacheDebugRecords: CacheDebugRecord[] = []
const cacheDebugListeners = new Set<() => void>()
const MAX_CACHE_DEBUG_RECORDS = 30

function pushCacheDebugRecord(record: CacheDebugRecord) {
  cacheDebugRecords.push(record)
  if (cacheDebugRecords.length > MAX_CACHE_DEBUG_RECORDS) {
    cacheDebugRecords.shift()
  }
  cacheDebugListeners.forEach((listener) => listener())
}

function logCache(event: string, key: string, extra?: Record<string, number | string>) {
  if (!IS_DEV) return
  pushCacheDebugRecord({ at: Date.now(), event, key, extra })
  if (extra) {
    console.info('[api-cache]', event, key, extra)
    return
  }
  console.info('[api-cache]', event, key)
}

/** dev 调试面板使用：读取最近缓存事件 */
export function getApiCacheDebugRecords() {
  return [...cacheDebugRecords]
}

/** dev 调试面板使用：订阅缓存事件变化 */
export function subscribeApiCacheDebug(listener: () => void) {
  cacheDebugListeners.add(listener)
  return () => cacheDebugListeners.delete(listener)
}

function storageKey(key: string) {
  return scopedStorageKey(`api-cache:${key}`)
}

function isEntryStale(entry: CacheEntry<unknown>): boolean {
  if (entry.ttlMs !== undefined && entry.ttlMs !== API_CACHE_TTL_MS) {
    return true
  }
  const remaining = entry.expiresAt - Date.now()
  // 旧版 30min 条目在 dev(3s) 下 remaining 会远大于当前 TTL
  return remaining > API_CACHE_TTL_MS + 500
}

function readEntry<T>(key: string): CacheEntry<T> | null {
  const fromMemory = memory.get(key) as CacheEntry<T> | undefined
  if (fromMemory) {
    if (isEntryStale(fromMemory)) {
      logCache('stale:memory', key, {
        entryTtlMs: fromMemory.ttlMs ?? 'legacy',
        currentTtlMs: API_CACHE_TTL_MS
      })
      clearApiCache(key)
      return null
    }
    logCache('hit:memory', key)
    return fromMemory
  }

  try {
    const stored = Taro.getStorageSync(storageKey(key)) as CacheEntry<T> | undefined
    if (stored && typeof stored.expiresAt === 'number') {
      if (isEntryStale(stored)) {
        logCache('stale:storage', key, {
          entryTtlMs: stored.ttlMs ?? 'legacy',
          currentTtlMs: API_CACHE_TTL_MS
        })
        clearApiCache(key)
        return null
      }
      memory.set(key, stored)
      logCache('hit:storage', key)
      return stored
    }
  } catch {
    // ignore
  }

  logCache('miss', key)
  return null
}

export function clearApiCache(key: string) {
  memory.delete(key)
  const timer = timers.get(key)
  if (timer) {
    clearTimeout(timer)
    timers.delete(key)
  }
  try {
    Taro.removeStorageSync(storageKey(key))
  } catch {
    // ignore
  }
}

function scheduleClear(key: string, ttlMs: number) {
  const existing = timers.get(key)
  if (existing) clearTimeout(existing)
  timers.set(
    key,
    setTimeout(() => clearApiCache(key), ttlMs)
  )
}

export function setApiCache<T>(key: string, data: T, ttlMs = API_CACHE_TTL_MS) {
  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
    ttlMs
  }
  memory.set(key, entry)
  try {
    Taro.setStorageSync(storageKey(key), entry)
  } catch {
    // ignore
  }
  scheduleClear(key, ttlMs)
  logCache('set', key, { ttlMs })
}

export function getApiCache<T>(key: string): T | null {
  const entry = readEntry<T>(key)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    logCache('expired', key)
    clearApiCache(key)
    return null
  }
  const remaining = entry.expiresAt - Date.now()
  logCache('valid', key, { remainingMs: remaining })
  scheduleClear(key, remaining)
  return entry.data
}

export async function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getApiCache<T>(key)
  if (cached !== null) return cached
  const data = await fetcher()
  setApiCache(key, data)
  return data
}
