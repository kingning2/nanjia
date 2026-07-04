/**
 * 跨平台小程序单次构建：--env production 消除体积提示，--mode 决定加载 .env.*
 * 用法: node scripts/taro-build-weapp.mjs development|test|production
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildEnv = process.argv[2]

if (!buildEnv) {
  console.error('用法: node scripts/taro-build-weapp.mjs <development|test|production>')
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['taro', 'build', '--type', 'weapp', '--env', 'production', '--mode', buildEnv],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true
  }
)

process.exit(result.status ?? 1)
