/**
 * 迁移工具发布包：esbuild 单文件 + 复制本机 Node 可执行文件进 Tauri resources。
 * 不再使用 pkg（避免构建时下载/编译 Node 运行时）。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(__dirname, '..')
const srcDir = path.join(pkgRoot, 'src')
const resourceDir = path.resolve(pkgRoot, '../../admin/src-tauri/resources/cloudbase-migrate')
const bundlePath = path.join(pkgRoot, 'dist', 'bundle.cjs')
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node'
const nodeDest = path.join(resourceDir, nodeName)
const bundleDest = path.join(resourceDir, 'bundle.cjs')

const force = process.argv.includes('--force')

function listSourceFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listSourceFiles(full))
    else if (entry.name.endsWith('.ts')) files.push(full)
  }
  return files
}

function isUpToDate() {
  if (!fs.existsSync(bundleDest) || !fs.existsSync(nodeDest) || !fs.existsSync(bundlePath)) {
    return false
  }
  const builtAt = Math.min(
    fs.statSync(bundleDest).mtimeMs,
    fs.statSync(nodeDest).mtimeMs
  )
  const nodeSrc = process.execPath
  const inputs = [
    ...listSourceFiles(srcDir),
    path.join(pkgRoot, 'package.json'),
    path.join(pkgRoot, 'tsconfig.json'),
    path.join(pkgRoot, 'scripts/build-sidecar.mjs'),
    nodeSrc
  ]
  return inputs.every((file) => fs.statSync(file).mtimeMs <= builtAt)
}

if (!force && isUpToDate()) {
  console.log(`[cloudbase-migrate] 迁移资源已是最新，跳过: ${resourceDir}`)
  process.exit(0)
}

fs.mkdirSync(resourceDir, { recursive: true })

console.log('[cloudbase-migrate] TypeScript 编译…')
execSync('pnpm exec tsc', { cwd: pkgRoot, stdio: 'inherit' })

console.log('[cloudbase-migrate] esbuild 打包为单文件 CJS…')
execSync(
  `pnpm exec esbuild dist/index.js --bundle --platform=node --target=node18 --format=cjs --outfile=${JSON.stringify(bundlePath)}`,
  { cwd: pkgRoot, stdio: 'inherit' }
)

const nodeSrc = process.execPath
console.log(`[cloudbase-migrate] 复制本机 Node: ${nodeSrc}`)
fs.copyFileSync(nodeSrc, nodeDest)
if (process.platform !== 'win32') {
  fs.chmodSync(nodeDest, 0o755)
}
fs.copyFileSync(bundlePath, bundleDest)

console.log(`[cloudbase-migrate] 已写入 ${resourceDir}`)
