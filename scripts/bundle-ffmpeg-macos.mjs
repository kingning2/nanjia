#!/usr/bin/env node
/**
 * macOS release 打包后嵌入 ffmpeg dylib（调用 bundle-ffmpeg-macos.sh）。
 * 由 admin/package.json 的 tauri:build 在 tauri build 之后自动执行。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SH = join(ROOT, 'scripts/bundle-ffmpeg-macos.sh')

const args = process.argv.slice(2)
if (args.includes('--self-check')) {
  if (!existsSync(SH)) throw new Error(`缺少脚本: ${SH}`)
  console.log('✓ bundle-ffmpeg-macos self-check 通过')
  process.exit(0)
}

if (process.platform !== 'darwin') {
  console.log('bundle-ffmpeg-macos: 非 macOS，跳过')
  process.exit(0)
}

execFileSync('bash', [SH, ...args], { cwd: ROOT, stdio: 'inherit' })
