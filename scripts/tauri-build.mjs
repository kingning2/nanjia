#!/usr/bin/env node
/**
 * 跨平台 Tauri release 构建入口。
 * macOS：仅打 .app（跳过 bundle_dmg.sh / AppleScript），再由 bundle-ffmpeg-macos 产出 dmg 与 tar.gz。
 * 其它平台：完整 tauri build。
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADMIN = join(ROOT, 'admin')

function run(cmd, args, cwd = ROOT) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

if (process.platform === 'darwin') {
  run('pnpm', ['exec', 'tauri', 'build', '--bundles', 'app'], ADMIN)
  run('node', [join(ROOT, 'scripts/bundle-ffmpeg-macos.mjs')])
} else {
  run('pnpm', ['exec', 'tauri', 'build'], ADMIN)
}
