#!/usr/bin/env node
// 一键发布管理端桌面安装包：升版本号 → 提交 → 推送 github + gitee → 打 tag → 推 tag。
// 推送 tag 后触发三条 GitHub Actions（macOS ARM / macOS Intel / Windows x64）各自出包。
//
// 用法：
//   node scripts/release.mjs            # patch：0.1.2 → 0.1.3
//   node scripts/release.mjs minor      # 0.1.2 → 0.2.0
//   node scripts/release.mjs major      # 0.1.2 → 1.0.0
//   node scripts/release.mjs 0.3.0      # 指定版本
//   node scripts/release.mjs 0.3.0 --no-push   # 只本地提交+打 tag，不推送
//
// 版本号真相来源为 tauri.conf.json，Cargo.toml / Cargo.lock 必须与之一致（脚本会校验）。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REMOTES = ['github', 'origin'] // github=GitHub，origin=Gitee
const TAURI_CONF = join(ROOT, 'admin/src-tauri/tauri.conf.json')
const CARGO_TOML = join(ROOT, 'admin/src-tauri/Cargo.toml')
const CARGO_LOCK = join(ROOT, 'admin/src-tauri/Cargo.lock')
const RELEASES_DIR = join(ROOT, 'releases')
// Cargo.toml / Cargo.lock 中本 crate 的版本行（避免误伤依赖版本）
const CARGO_RE = /(name = "nanjia-beauty-admin"\r?\nversion = ")(\d+\.\d+\.\d+)(")/

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts })
}

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function currentVersion() {
  const v = JSON.parse(readFileSync(TAURI_CONF, 'utf8')).version
  if (!/^\d+\.\d+\.\d+$/.test(v || '')) fail(`tauri.conf.json version 非法: ${v}`)
  return v
}

function nextVersion(arg, cur) {
  const [maj, min, pat] = cur.split('.').map(Number)
  if (!arg || arg === 'patch') return `${maj}.${min}.${pat + 1}`
  if (arg === 'minor') return `${maj}.${min + 1}.0`
  if (arg === 'major') return `${maj + 1}.0.0`
  if (/^\d+\.\d+\.\d+$/.test(arg)) return arg
  return fail(`版本参数非法: ${arg}（用 patch|minor|major 或 X.Y.Z）`)
}

function bumpJson(cur, next) {
  const text = readFileSync(TAURI_CONF, 'utf8')
  const from = `"version": "${cur}"`
  if (!text.includes(from)) fail(`tauri.conf.json 未找到 ${from}`)
  writeFileSync(TAURI_CONF, text.replace(from, `"version": "${next}"`))
}

function bumpCargo(path, cur, next, label) {
  const text = readFileSync(path, 'utf8')
  const m = text.match(CARGO_RE)
  if (!m) fail(`${label} 未找到 nanjia-beauty-admin 版本行`)
  if (m[2] !== cur) fail(`${label} 版本(${m[2]}) 与 tauri.conf.json(${cur}) 不一致，请先手动对齐`)
  writeFileSync(path, text.replace(CARGO_RE, (_, p1, _v, p3) => `${p1}${next}${p3}`))
}

/** 自上一 tag 以来的 commit 简述，生成 releases/vX.Y.Z.md 供 GitHub Release 使用 */
function writeReleaseNotes(prevVersion, nextVersion) {
  const prevTag = `v${prevVersion}`
  let subjects = ''
  try {
    subjects = git(['log', `${prevTag}..HEAD`, '--pretty=format:%s']).trim()
  } catch {
    subjects = ''
  }
  const bullets =
    subjects.length > 0
      ? subjects
          .split('\n')
          .map((line) => `- ${line}`)
          .join('\n')
      : '- （见 git log）'

  const body = `## 管理端 v${nextVersion}

### 变更

${bullets}

### 安装包

| 平台 | 产物 |
|------|------|
| macOS Apple Silicon | \`.dmg\`、\`.app.tar.gz\` |
| macOS Intel | \`.dmg\`、\`.app.tar.gz\` |
| Windows x64 | NSIS \`.exe\`、\`.msi\` |

### 自动更新

- release 版启动后从 GitHub Release 检查更新（`latest.json`）
- 详见 \`admin/README.md\`
`
  mkdirSync(RELEASES_DIR, { recursive: true })
  const notesPath = join(RELEASES_DIR, `v${nextVersion}.md`)
  writeFileSync(notesPath, `${body}\n`)
  return notesPath
}

const args = process.argv.slice(2)
const noPush = args.includes('--no-push')

if (args.includes('--self-check')) {
  const eq = (a, b, m) => a === b || fail(`self-check: ${m} 期望 ${b} 实得 ${a}`)
  eq(nextVersion('patch', '0.1.2'), '0.1.3', 'patch')
  eq(nextVersion('minor', '0.1.2'), '0.2.0', 'minor')
  eq(nextVersion('major', '0.1.2'), '1.0.0', 'major')
  eq(nextVersion('3.4.5', '0.1.2'), '3.4.5', '显式版本')
  const sample = 'name = "nanjia-beauty-admin"\nversion = "0.1.2"\n'
  const swap = (t) => t.replace(CARGO_RE, (_, p1, _v, p3) => `${p1}9.9.9${p3}`)
  eq(swap(sample), 'name = "nanjia-beauty-admin"\nversion = "9.9.9"\n', 'cargo LF')
  eq('name = "nanjia-beauty-admin"\r\nversion = "0.1.2"\r\n'.match(CARGO_RE)?.[2], '0.1.2', 'cargo CRLF')
  console.log('✓ self-check 通过')
  process.exit(0)
}

const versionArg = args.find((a) => !a.startsWith('--'))

if (git(['status', '--porcelain']).trim()) {
  fail('工作树有未提交改动，请先提交或清理后再发布')
}

const cur = currentVersion()
const next = nextVersion(versionArg, cur)
if (next === cur) fail(`目标版本与当前一致: ${cur}`)
const tag = `v${next}`
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()

console.log(`发布 ${cur} → ${next}（分支 ${branch}，tag ${tag}）`)

bumpJson(cur, next)
bumpCargo(CARGO_TOML, cur, next, 'Cargo.toml')
bumpCargo(CARGO_LOCK, cur, next, 'Cargo.lock')

const notesPath = writeReleaseNotes(cur, next)

git(['add', 'admin/src-tauri/tauri.conf.json', 'admin/src-tauri/Cargo.toml', 'admin/src-tauri/Cargo.lock', notesPath])
git(['commit', '-m', `chore(admin): 版本号升至 ${next} 以发布桌面安装包`])
git(['tag', '-a', tag, '-F', notesPath])

if (noPush) {
  console.log(`已本地提交并打 tag ${tag}（--no-push）。手动推送：`)
  for (const r of REMOTES) console.log(`  git push ${r} ${branch} && git push ${r} ${tag}`)
  process.exit(0)
}

for (const r of REMOTES) {
  console.log(`推送 ${branch} → ${r}`)
  git(['push', r, branch], { stdio: 'inherit' })
}
for (const r of REMOTES) {
  console.log(`推送 ${tag} → ${r}`)
  git(['push', r, tag], { stdio: 'inherit' })
}

console.log(`\n✓ 完成。GitHub 将针对 ${tag} 运行三条桌面构建工作流并发布安装包。`)
