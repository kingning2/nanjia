#!/usr/bin/env node
/**
 * 将 Tauri 更新包与 latest.json 发布到 CloudBase 云存储（COS CDN）。
 *
 * 用法（CI 或本地 release 后）：
 *   node scripts/publish-admin-update.mjs --env production --platform darwin-aarch64 --version 0.1.4
 *   node scripts/publish-admin-update.mjs --env production --platform windows-x86_64 --version 0.1.4 \
 *     --artifact admin/src-tauri/target/release/bundle/nsis/NANJIA BEAUTY_0.1.4_x64-setup.exe
 *
 * 环境变量（读 .env.production）：
 *   TARO_APP_CLOUD_ENV_ID / CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY
 *   ADMIN_UPDATE_CDN_BASE（可选，默认 https://{envId}.tcb.qcloud.la）
 */
import cloudbase from '@cloudbase/node-sdk'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const UPDATE_PREFIX = 'admin-updates'
const PLATFORMS = new Set(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64'])
// GitHub Actions → 国内 COS 跨境上传易触发 UserNetworkTooSlow，拉长超时并加重试
const SDK_TIMEOUT_MS = Number(process.env.ADMIN_UPDATE_UPLOAD_TIMEOUT_MS || 600_000)
const UPLOAD_RETRIES = Number(process.env.ADMIN_UPDATE_UPLOAD_RETRIES || 5)
const RETRY_BASE_MS = Number(process.env.ADMIN_UPDATE_UPLOAD_RETRY_MS || 20_000)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetriableUploadError(err) {
  const msg = `${err?.code || ''} ${err?.message || err || ''}`
  return /UserNetworkTooSlow|timeout|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET|ENOTFOUND|网络|too slow/i.test(
    msg
  )
}

async function withUploadRetry(label, fn) {
  let lastErr
  for (let attempt = 1; attempt <= UPLOAD_RETRIES; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetriableUploadError(err) || attempt === UPLOAD_RETRIES) throw err
      const wait = RETRY_BASE_MS * attempt
      console.warn(`! ${label} 第 ${attempt}/${UPLOAD_RETRIES} 次失败: ${err.message || err}`)
      console.warn(`  ${Math.round(wait / 1000)}s 后重试…`)
      await sleep(wait)
    }
  }
  throw lastErr
}

function loadEnvFile(name) {
  const path = join(ROOT, name)
  if (!existsSync(path)) throw new Error(`缺少环境文件: ${name}`)
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function parseArgs(argv) {
  const out = { env: 'production', notes: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--env') out.env = next()
    else if (arg.startsWith('--env=')) out.env = arg.slice('--env='.length)
    else if (arg === '--platform') out.platform = next()
    else if (arg.startsWith('--platform=')) out.platform = arg.slice('--platform='.length)
    else if (arg === '--version') out.version = next()
    else if (arg.startsWith('--version=')) out.version = arg.slice('--version='.length)
    else if (arg === '--artifact') out.artifact = next()
    else if (arg.startsWith('--artifact=')) out.artifact = arg.slice('--artifact='.length)
    else if (arg === '--signature') out.signature = next()
    else if (arg.startsWith('--signature=')) out.signature = arg.slice('--signature='.length)
    else if (arg === '--notes') out.notes = next()
    else if (arg.startsWith('--notes=')) out.notes = arg.slice('--notes='.length)
    else if (arg === '--self-check') out.selfCheck = true
    else if (arg === '--help' || arg === '-h') out.help = true
    else throw new Error(`未知参数: ${arg}`)
  }
  return out
}

function usage() {
  console.log(`用法: node scripts/publish-admin-update.mjs --platform <darwin-aarch64|darwin-x86_64|windows-x86_64> --version X.Y.Z [--env production] [--artifact path] [--signature path]`)
}

function cdnBase(envId, envFile) {
  return envFile.ADMIN_UPDATE_CDN_BASE || `https://${envId}.tcb.qcloud.la`
}

function publicUrl(base, cloudPath) {
  return `${base.replace(/\/$/, '')}/${cloudPath.split('/').map(encodeURIComponent).join('/')}`
}

async function findArtifactAsync(platform) {
  const bundle = join(ROOT, 'admin/src-tauri/target/release/bundle')
  if (platform.startsWith('darwin-')) {
    const macDir = join(bundle, 'macos')
    if (!existsSync(macDir)) return null
    const name = JSON.parse(readFileSync(join(ROOT, 'admin/src-tauri/tauri.conf.json'), 'utf8'))
      .productName
    const file = join(macDir, `${name}.app.tar.gz`)
    return existsSync(file) ? file : null
  }
  if (platform === 'windows-x86_64') {
    const nsisDir = join(bundle, 'nsis')
    if (!existsSync(nsisDir)) return null
    const hit = readdirSync(nsisDir).find((f) => f.endsWith('-setup.exe'))
    return hit ? join(nsisDir, hit) : null
  }
  return null
}

function readSignature(artifactPath, signaturePath) {
  const sigPath = signaturePath || `${artifactPath}.sig`
  if (!existsSync(sigPath)) throw new Error(`找不到签名文件: ${sigPath}`)
  return readFileSync(sigPath, 'utf8').trim()
}

async function fetchLatestManifest(cdn) {
  const url = `${cdn}/${UPDATE_PREFIX}/latest.json?t=${Date.now()}`
  const res = await fetch(url, { redirect: 'follow' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`读取 latest.json 失败: HTTP ${res.status}`)
  return res.json()
}

function initCloudApp(envId, secretId, secretKey) {
  return cloudbase.init({ env: envId, secretId, secretKey, timeout: SDK_TIMEOUT_MS })
}

async function uploadFile(app, cloudPath, localPath) {
  const sizeMb = (statSync(localPath).size / 1024 / 1024).toFixed(1)
  console.log(`  文件大小 ${sizeMb} MB，超时 ${SDK_TIMEOUT_MS / 1000}s`)
  return withUploadRetry(cloudPath, async () => {
    const res = await app.uploadFile({
      cloudPath,
      // Buffer 比 stream 在跨境慢网上更稳
      fileContent: readFileSync(localPath),
    })
    if (res.code) {
      const err = new Error(`上传 ${cloudPath} 失败: ${res.code} ${res.message || ''}`)
      err.code = res.code
      throw err
    }
    return res
  })
}

async function uploadBuffer(app, cloudPath, buffer) {
  return withUploadRetry(cloudPath, async () => {
    const res = await app.uploadFile({
      cloudPath,
      fileContent: buffer,
    })
    if (res.code) {
      const err = new Error(`上传 ${cloudPath} 失败: ${res.code} ${res.message || ''}`)
      err.code = res.code
      throw err
    }
    return res
  })
}

async function mergeAndPublish({
  envFile,
  platform,
  version,
  artifactPath,
  signaturePath,
  notes,
}) {
  if (!PLATFORMS.has(platform)) throw new Error(`platform 非法: ${platform}`)
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error(`version 非法: ${version}`)

  const envId = envFile.TARO_APP_CLOUD_ENV_ID
  const secretId = envFile.CLOUDBASE_SECRET_ID
  const secretKey = envFile.CLOUDBASE_SECRET_KEY
  if (!envId || !secretId || !secretKey) {
    throw new Error('缺少 TARO_APP_CLOUD_ENV_ID / CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY')
  }

  const resolvedArtifact = artifactPath || (await findArtifactAsync(platform))
  if (!resolvedArtifact || !existsSync(resolvedArtifact)) {
    throw new Error(`找不到更新包，请指定 --artifact（platform=${platform}）`)
  }

  const signature = readSignature(resolvedArtifact, signaturePath)
  const fileName = basename(resolvedArtifact)
  const objectKey = `${UPDATE_PREFIX}/v${version}/${platform}/${fileName}`
  const cdn = cdnBase(envId, envFile)

  const app = initCloudApp(envId, secretId, secretKey)

  console.log(`↑ 上传 ${resolvedArtifact} → ${objectKey}`)
  await uploadFile(app, objectKey, resolvedArtifact)

  const downloadUrl = publicUrl(cdn, objectKey)

  let manifest = (await fetchLatestManifest(cdn)) || {
    version,
    notes: notes || '',
    pub_date: new Date().toISOString(),
    platforms: {},
  }

  // 新版本号应不低于已有；合并时保留其它平台条目
  manifest.version = version
  if (notes) manifest.notes = notes
  manifest.pub_date = new Date().toISOString()
  manifest.platforms[platform] = { signature, url: downloadUrl }

  const manifestPath = `${UPDATE_PREFIX}/latest.json`
  console.log(`↑ 更新清单 → ${manifestPath}`)
  await uploadBuffer(app, manifestPath, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'))

  console.log(`✓ 已发布 ${platform} v${version}`)
  console.log(`  清单: ${publicUrl(cdn, manifestPath)}`)
  console.log(`  安装包: ${downloadUrl}`)
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  usage()
  process.exit(0)
}

if (args.selfCheck) {
  if (!existsSync(join(ROOT, 'scripts/publish-admin-update.mjs'))) throw new Error('脚本缺失')
  const sample = cdnBase('cloud1-demo', {})
  if (sample !== 'https://cloud1-demo.tcb.qcloud.la') throw new Error('cdnBase 异常')
  console.log('✓ publish-admin-update self-check 通过')
  process.exit(0)
}

if (!args.platform || !args.version) {
  usage()
  process.exit(1)
}

const envName = args.env === 'production' ? '.env.production' : `.env.${args.env}`
const envFile = loadEnvFile(envName)

mergeAndPublish({
  envFile,
  platform: args.platform,
  version: args.version.replace(/^v/, ''),
  artifactPath: args.artifact,
  signaturePath: args.signature,
  notes: args.notes,
}).catch((err) => {
  console.error(`✗ ${err.message || err}`)
  process.exit(1)
})
