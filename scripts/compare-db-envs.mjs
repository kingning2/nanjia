/**
 * 对比 development 与 test 云数据库各集合文档数量与内容指纹
 * 用法: node scripts/compare-db-envs.mjs
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cloudbase from '@cloudbase/node-sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const COLLECTIONS = [
  'categories',
  'projects',
  'material_cards',
  'material_details',
  'home_settings',
  'media_files'
]

function loadEnvFile(filePath) {
  const out = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function initApp(vars) {
  return cloudbase.init({
    env: vars.TARO_APP_CLOUD_ENV_ID,
    secretId: vars.CLOUDBASE_SECRET_ID,
    secretKey: vars.CLOUDBASE_SECRET_KEY
  })
}

async function fetchAll(db, collection) {
  const all = []
  const pageSize = 100
  let skip = 0
  while (true) {
    const res = await db.collection(collection).skip(skip).limit(pageSize).get()
    const batch = res.data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break
    skip += batch.length
  }
  return all
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

/** 归一化 cloud://fileID，去掉环境前缀便于跨环境对比 */
function normalizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(/cloud:\/\/[^/]+\//g, 'cloud://ENV/')
  }
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = normalizeValue(v)
    return out
  }
  return value
}

/** 内容指纹：忽略 _id / 时间戳 / downloadUrl / 环境相关 fileID */
function docFingerprint(doc) {
  const { _id, updatedAt, createdAt, downloadUrl, ...rest } = doc
  return crypto.createHash('sha256').update(stableStringify(normalizeValue(rest))).digest('hex').slice(0, 16)
}

function summarize(docs) {
  const byId = new Map()
  for (const doc of docs) {
    byId.set(String(doc._id), docFingerprint(doc))
  }
  return byId
}

const dev = loadEnvFile(path.join(root, '.env.development'))
const test = loadEnvFile(path.join(root, '.env.test'))

console.log(`[compare-db] dev  env: ${dev.TARO_APP_CLOUD_ENV_ID}`)
console.log(`[compare-db] test env: ${test.TARO_APP_CLOUD_ENV_ID}`)
console.log('')

const devApp = initApp(dev)
const testApp = initApp(test)
const devDb = devApp.database()
const testDb = testApp.database()

let allSame = true

for (const collection of COLLECTIONS) {
  const [devDocs, testDocs] = await Promise.all([fetchAll(devDb, collection), fetchAll(testDb, collection)])
  const devMap = summarize(devDocs)
  const testMap = summarize(testDocs)

  const devIds = [...devMap.keys()].sort()
  const testIds = [...testMap.keys()].sort()
  const onlyDev = devIds.filter((id) => !testMap.has(id))
  const onlyTest = testIds.filter((id) => !devMap.has(id))
  const common = devIds.filter((id) => testMap.has(id))
  const contentDiff = common.filter((id) => devMap.get(id) !== testMap.get(id))

  const same =
    devDocs.length === testDocs.length &&
    onlyDev.length === 0 &&
    onlyTest.length === 0 &&
    contentDiff.length === 0

  if (!same) allSame = false

  const status = same ? '✓ 一致' : '✗ 不一致'
  console.log(`## ${collection} — ${status}`)
  console.log(`   dev: ${devDocs.length} 条 | test: ${testDocs.length} 条`)
  if (onlyDev.length) console.log(`   仅 dev 有: ${onlyDev.slice(0, 5).join(', ')}${onlyDev.length > 5 ? ` …共${onlyDev.length}条` : ''}`)
  if (onlyTest.length) console.log(`   仅 test 有: ${onlyTest.slice(0, 5).join(', ')}${onlyTest.length > 5 ? ` …共${onlyTest.length}条` : ''}`)
  if (contentDiff.length) console.log(`   同 ID 内容不同: ${contentDiff.slice(0, 5).join(', ')}${contentDiff.length > 5 ? ` …共${contentDiff.length}条` : ''}`)
  console.log('')
}

console.log(allSame ? '结论: 两个环境数据库内容一致' : '结论: 两个环境数据库内容不一致')
