#!/usr/bin/env node
/**
 * 将 Tauri 更新包写入 GitHub Release 的 latest.json（替代 CloudBase COS）。
 *
 * CI（打 tag 后，安装包已上传 Release）：
 *   node scripts/publish-admin-update.mjs --platform darwin-aarch64 --version 0.1.4
 *
 * 本地（需 gh CLI 已登录，且对应 tag 的 Release 已存在）：
 *   GITHUB_REPOSITORY=owner/repo node scripts/publish-admin-update.mjs --platform darwin-aarch64 --version 0.1.4
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const PLATFORMS = new Set(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64'])
const DEFAULT_REPO = 'kingning2/nanjia'
const MERGE_RETRIES = 5
const MERGE_RETRY_MS = 4_000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(argv) {
  const out = { notes: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => argv[++i]
    if (arg === '--platform') out.platform = next()
    else if (arg.startsWith('--platform=')) out.platform = arg.slice('--platform='.length)
    else if (arg === '--version') out.version = next()
    else if (arg.startsWith('--version=')) out.version = arg.slice('--version='.length)
    else if (arg === '--tag') out.tag = next()
    else if (arg.startsWith('--tag=')) out.tag = arg.slice('--tag='.length)
    else if (arg === '--repo') out.repo = next()
    else if (arg.startsWith('--repo=')) out.repo = arg.slice('--repo='.length)
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
  console.log(
    '用法: node scripts/publish-admin-update.mjs --platform <darwin-aarch64|darwin-x86_64|windows-x86_64> --version X.Y.Z [--tag vX.Y.Z] [--repo owner/repo] [--artifact path]'
  )
}

function releaseAssetUrl(repo, tag, fileName) {
  const encoded = fileName.split('/').map(encodeURIComponent).join('/')
  return `https://github.com/${repo}/releases/download/${tag}/${encoded}`
}

function findArtifact(platform) {
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

async function fetchManifest(repo, tag) {
  const url = releaseAssetUrl(repo, tag, 'latest.json')
  const res = await fetch(url, { redirect: 'follow' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`读取 latest.json 失败: HTTP ${res.status}`)
  return res.json()
}

function ghReleaseUpload(tag, filePath) {
  execFileSync('gh', ['release', 'upload', tag, filePath, '--clobber'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
}

async function mergeAndPublish({ repo, tag, platform, version, artifactPath, signaturePath, notes }) {
  if (!PLATFORMS.has(platform)) throw new Error(`platform 非法: ${platform}`)
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error(`version 非法: ${version}`)

  const resolvedArtifact = artifactPath || findArtifact(platform)
  if (!resolvedArtifact || !existsSync(resolvedArtifact)) {
    throw new Error(`找不到更新包，请指定 --artifact（platform=${platform}）`)
  }

  const signature = readSignature(resolvedArtifact, signaturePath)
  const fileName = basename(resolvedArtifact)
  const downloadUrl = releaseAssetUrl(repo, tag, fileName)

  const manifestPath = join(ROOT, 'latest.json')
  let lastErr

  for (let attempt = 1; attempt <= MERGE_RETRIES; attempt += 1) {
    try {
      const existing = await fetchManifest(repo, tag)
      const manifest = existing || {
        version,
        notes: notes || '',
        pub_date: new Date().toISOString(),
        platforms: {},
      }

      manifest.version = version
      if (notes) manifest.notes = notes
      manifest.pub_date = new Date().toISOString()
      manifest.platforms[platform] = { signature, url: downloadUrl }

      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      console.log(`↑ 上传 latest.json → GitHub Release ${tag}（${platform}）`)
      ghReleaseUpload(tag, manifestPath)
      unlinkSync(manifestPath)

      console.log(`✓ 已发布 ${platform} v${version}`)
      console.log(`  清单: https://github.com/${repo}/releases/latest/download/latest.json`)
      console.log(`  更新包: ${downloadUrl}`)
      return
    } catch (err) {
      lastErr = err
      if (attempt === MERGE_RETRIES) break
      console.warn(`! 合并 latest.json 第 ${attempt}/${MERGE_RETRIES} 次失败: ${err.message || err}`)
      await sleep(MERGE_RETRY_MS * attempt)
    } finally {
      if (existsSync(manifestPath)) unlinkSync(manifestPath)
    }
  }

  throw lastErr
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  usage()
  process.exit(0)
}

if (args.selfCheck) {
  const url = releaseAssetUrl(DEFAULT_REPO, 'v0.0.0', 'NANJIA BEAUTY.app.tar.gz')
  if (!url.includes('NANJIA%20BEAUTY.app.tar.gz')) throw new Error('releaseAssetUrl 异常')
  console.log('✓ publish-admin-update self-check 通过')
  process.exit(0)
}

if (!args.platform || !args.version) {
  usage()
  process.exit(1)
}

const repo = args.repo || process.env.GITHUB_REPOSITORY || DEFAULT_REPO
const version = args.version.replace(/^v/, '')
const tag = args.tag || process.env.GITHUB_REF_NAME || `v${version}`

mergeAndPublish({
  repo,
  tag,
  platform: args.platform,
  version,
  artifactPath: args.artifact,
  signaturePath: args.signature,
  notes: args.notes,
}).catch((err) => {
  console.error(`✗ ${err.message || err}`)
  process.exit(1)
})
