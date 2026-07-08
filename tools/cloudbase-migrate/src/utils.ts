import crypto from 'node:crypto'
import https from 'node:https'

import type { MigrateConfig } from './types.js'
import { credentialsForEnv } from './config.js'

const DB_BASE = '/v1/database/instances/(default)/databases/(default)'

/** 判断是否为云存储 fileID */
export function isCloudFileId(value: string): boolean {
  return value.trim().startsWith('cloud://')
}

/**
 * 从 fileID 解析 cloudPath
 * cloud://env-id.xxx/images/a.webp → images/a.webp
 */
export function cloudPathFromFileId(fileId: string): string | null {
  const trimmed = fileId.trim()
  if (!trimmed.startsWith('cloud://')) return null
  const rest = trimmed.slice('cloud://'.length)
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  const path = rest.slice(slash + 1)
  return path || null
}

/** 深拷贝 JSON 兼容对象 */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 延迟（重试用） */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 有限并发执行 */
export async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  let cursor = 0
  const size = Math.max(1, Math.min(concurrency, items.length))

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: size }, () => runWorker()))
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function tc3Sign(params: {
  secretId: string
  secretKey: string
  method: string
  canonicalUri: string
  canonicalQuery: string
  host: string
  action: string
  body: string
  timestamp: number
}): string {
  const { secretId, secretKey, method, canonicalUri, canonicalQuery, host, action, body, timestamp } =
    params
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    sha256Hex(body)
  ].join('\n')
  const credentialScope = `${date}/tcb/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join(
    '\n'
  )
  const kDate = hmacSha256(`TC3${secretKey}`, date)
  const kService = hmacSha256(kDate, 'tcb')
  const kSigning = hmacSha256(kService, 'tc3_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}, Timestamp=${timestamp}`
}

function buildSortedQuery(params: [string, string][]): string {
  return params
    .slice()
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

interface GatewayResponse {
  list?: unknown[]
  data?: { list?: unknown[]; collections?: Array<{ name?: string; collectionName?: string }> }
  collections?: Array<{ name?: string; collectionName?: string }>
}

function splitPathQuery(pathAndQuery: string): [string, string] {
  const idx = pathAndQuery.indexOf('?')
  if (idx === -1) return [pathAndQuery, '']
  return [pathAndQuery.slice(0, idx), pathAndQuery.slice(idx + 1)]
}

/** 与 Rust `canonicalize_query_string` 一致：按 key 排序，不二次编码 */
function canonicalizeQuery(rawQuery: string): string {
  if (!rawQuery) return ''
  const pairs = rawQuery
    .split('&')
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      if (eq === -1) return [part, ''] as const
      return [part.slice(0, eq), part.slice(eq + 1)] as const
    })
  pairs.sort(([a], [b]) => a.localeCompare(b))
  return pairs.map(([key, value]) => `${key}=${value}`).join('&')
}

/** CloudBase Gateway HTTP 请求（用于 listCollections / 保留 _id 写入） */
export async function gatewayRequest(
  cfg: MigrateConfig,
  envId: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  pathAndQuery: string,
  action: string,
  body = ''
): Promise<unknown> {
  const host = `${envId}.api.tcloudbasegateway.com`
  const [pathname, rawQuery] = splitPathQuery(pathAndQuery)
  const canonicalQuery = canonicalizeQuery(rawQuery)
  const { secretId, secretKey } = credentialsForEnv(cfg, envId)
  const timestamp = Math.floor(Date.now() / 1000)
  const authorization = tc3Sign({
    secretId,
    secretKey,
    method,
    canonicalUri: pathname,
    canonicalQuery,
    host,
    action,
    body,
    timestamp
  })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: pathAndQuery,
        method,
        headers: {
          'Content-Type': 'application/json',
          Host: host,
          Authorization: authorization,
          'X-TC-Action': action,
          'X-TC-Timestamp': String(timestamp),
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: string) => {
          data += chunk
        })
        res.on('end', () => {
          let parsed: unknown = data
          try {
            parsed = JSON.parse(data) as unknown
          } catch {
            /* keep raw */
          }
          const status = res.statusCode ?? 0
          if (status >= 200 && status < 300) {
            resolve(parsed)
            return
          }
          const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
          reject(new Error(`${action} HTTP ${status}: ${detail}`))
        })
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

/** 分页列出所有集合名 */
export async function listAllCollections(cfg: MigrateConfig, envId: string): Promise<string[]> {
  const names = new Set<string>()
  let offset = 0
  const limit = 100

  while (true) {
    const query = buildSortedQuery([
      ['limit', String(limit)],
      ['offset', String(offset)]
    ])
    const path = `${DB_BASE}/collections?${query}`
    const res = (await gatewayRequest(cfg, envId, 'GET', path, 'ListCollections')) as GatewayResponse

    const batch =
      res.collections ??
      res.data?.collections ??
      (Array.isArray(res.list) ? (res.list as Array<{ name?: string; collectionName?: string }>) : [])

    for (const item of batch) {
      const name = item.name ?? item.collectionName
      if (name) names.add(name)
    }

    if (batch.length < limit) break
    offset += limit
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}

export function collectionDocumentsPath(collection: string): string {
  return `${DB_BASE}/collections/${collection}/documents`
}

export function documentPath(collection: string, id: string): string {
  return `${collectionDocumentsPath(collection)}/${encodeURIComponent(id)}`
}

/** 检查目标环境文档是否已存在 */
export async function documentExists(
  cfg: MigrateConfig,
  envId: string,
  collection: string,
  id: string
): Promise<boolean> {
  try {
    await gatewayRequest(cfg, envId, 'GET', documentPath(collection, id), 'GetDocument')
    return true
  } catch {
    return false
  }
}

function parseGatewayDocument(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== 'object') return null
  const root = res as Record<string, unknown>
  const data = root.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return root
}

/** 读取目标环境单条文档 */
export async function getDocument(
  cfg: MigrateConfig,
  envId: string,
  collection: string,
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await gatewayRequest(cfg, envId, 'GET', documentPath(collection, id), 'GetDocument')
    return parseGatewayDocument(res)
  } catch {
    return null
  }
}

/** 删除单条文档 */
export async function deleteDocument(
  cfg: MigrateConfig,
  envId: string,
  collection: string,
  id: string
): Promise<void> {
  await gatewayRequest(cfg, envId, 'DELETE', documentPath(collection, id), 'DeleteDocument')
}

/** 将 SDK 返回的 _id（含 { $oid }）规范为字符串 */
export function normalizeDocumentId<T extends Record<string, unknown>>(doc: T): T {
  const id = doc._id
  if (typeof id === 'string' && id) {
    return doc
  }
  if (id && typeof id === 'object' && '$oid' in id) {
    const oid = (id as { $oid?: string }).$oid
    if (typeof oid === 'string' && oid) {
      return { ...doc, _id: oid }
    }
  }
  return doc
}

/** 写入文档（保留 _id 与系统字段；Gateway Insert / Update） */
export async function upsertDocument(
  cfg: MigrateConfig,
  envId: string,
  collection: string,
  doc: Record<string, unknown>
): Promise<'inserted' | 'updated'> {
  const normalized = normalizeDocumentId(doc)
  const id = normalized._id
  if (typeof id !== 'string' || !id) {
    throw new Error('文档缺少 _id，无法写入')
  }

  const { _id, ...rest } = normalized
  const patchBody = JSON.stringify({ data: { $set: rest } })

  try {
    await gatewayRequest(
      cfg,
      envId,
      'PATCH',
      documentPath(collection, id),
      'UpdateDocument',
      patchBody
    )
    return 'updated'
  } catch {
    const insertBody = JSON.stringify({ data: [normalized] })
    await gatewayRequest(
      cfg,
      envId,
      'POST',
      collectionDocumentsPath(collection),
      'InsertDocument',
      insertBody
    )
    return 'inserted'
  }
}
