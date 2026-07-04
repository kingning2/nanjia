/**
 * 按环境读取 .env.* 密钥 → tcb logout → tcb login → 部署云函数
 *
 * 用法:
 *   node scripts/deploy-cloud-functions.mjs --env development
 *   node scripts/deploy-cloud-functions.mjs --env test
 *   node scripts/deploy-cloud-functions.mjs --env production
 *   node scripts/deploy-cloud-functions.mjs --env test --fn portfolioHome
 *   node scripts/deploy-cloud-functions.mjs --env test --skip-install
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const ENV_FILES = {
  development: '.env.development',
  test: '.env.test',
  production: '.env.production'
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`[deploy-cf] 找不到环境文件: ${filePath}`)
    process.exit(1)
  }
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

function parseArgs(argv) {
  let env = ''
  let fn = ''
  let skipInstall = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--env' && argv[i + 1]) {
      env = argv[i + 1]
      i += 1
      continue
    }
    if (arg.startsWith('--env=')) {
      env = arg.slice('--env='.length)
      continue
    }
    if (arg === '--fn' && argv[i + 1]) {
      fn = argv[i + 1]
      i += 1
      continue
    }
    if (arg.startsWith('--fn=')) {
      fn = arg.slice('--fn='.length)
      continue
    }
    if (arg === '--skip-install') {
      skipInstall = true
    }
  }

  return { env, fn, skipInstall }
}

function maskSecret(value) {
  if (!value) return '(空)'
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1)
  }
  return result.status ?? 0
}

function runTcb(args, options) {
  return run('npx', ['tcb', ...args], options)
}

const { env, fn, skipInstall } = parseArgs(process.argv.slice(2))
const buildEnv = env || process.env.TARO_APP_BUILD_ENV || 'development'
const envFileName = ENV_FILES[buildEnv]

if (!envFileName) {
  console.error(`[deploy-cf] 未知环境: ${buildEnv}（可选: development | test | production）`)
  process.exit(1)
}

const envPath = path.join(root, envFileName)
const vars = loadEnvFile(envPath)
const envId = vars.TARO_APP_CLOUD_ENV_ID?.trim()
const secretId = vars.CLOUDBASE_SECRET_ID?.trim()
const secretKey = vars.CLOUDBASE_SECRET_KEY?.trim()

if (!envId || !secretId || !secretKey) {
  console.error(
    `[deploy-cf] ${envFileName} 须包含 TARO_APP_CLOUD_ENV_ID、CLOUDBASE_SECRET_ID、CLOUDBASE_SECRET_KEY`
  )
  process.exit(1)
}

console.log(`[deploy-cf] 环境: ${buildEnv}`)
console.log(`[deploy-cf] 配置文件: ${envFileName}`)
console.log(`[deploy-cf] 云环境 ID: ${envId}`)
console.log(`[deploy-cf] SecretId: ${maskSecret(secretId)}`)

if (!skipInstall) {
  console.log('\n[deploy-cf] 安装 / 同步 cf-shared …')
  run('pnpm', ['install:cf'])
}

console.log('\n[deploy-cf] 登出当前 tcb 会话 …')
runTcb(['logout'], { allowFail: true })

console.log('\n[deploy-cf] 使用密钥登录 …')
runTcb(['login', '--apiKeyId', secretId, '--apiKey', secretKey])

const deployArgs = fn
  ? ['fn', 'deploy', fn, '--force', '-e', envId]
  : ['fn', 'deploy', '--all', '--force', '-e', envId]

console.log(`\n[deploy-cf] 部署${fn ? `函数 ${fn}` : '全部云函数'} …`)
runTcb(deployArgs)

console.log('\n[deploy-cf] 验证已部署函数 …')
runTcb(['fn', 'list', '-e', envId])

console.log('\n[deploy-cf] 完成 ✓')
