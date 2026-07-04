#!/usr/bin/env node
/**
 * 从环境变量生成根目录 .env.test / .env.production（CI 注入 GitHub Secrets）。
 *
 * 用法：
 *   node scripts/write-env-from-secrets.mjs --ci     # CI：缺变量则失败
 *   node scripts/write-env-from-secrets.mjs          # 本地：仅当文件不存在时生成
 */
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SPECS = [
  {
    slug: 'test',
    file: '.env.test',
    buildEnv: 'test',
    debugPanel: 'true',
    envIdKeys: ['TARO_APP_CLOUD_ENV_ID_TEST', 'TARO_APP_CLOUD_ENV_ID'],
    secretIdKeys: ['CLOUDBASE_SECRET_ID_TEST', 'CLOUDBASE_SECRET_ID'],
    secretKeyKeys: ['CLOUDBASE_SECRET_KEY_TEST', 'CLOUDBASE_SECRET_KEY'],
  },
  {
    slug: 'production',
    file: '.env.production',
    buildEnv: 'production',
    debugPanel: 'false',
    envIdKeys: ['TARO_APP_CLOUD_ENV_ID_PRODUCTION', 'TARO_APP_CLOUD_ENV_ID'],
    secretIdKeys: ['CLOUDBASE_SECRET_ID_PRODUCTION', 'CLOUDBASE_SECRET_ID'],
    secretKeyKeys: ['CLOUDBASE_SECRET_KEY_PRODUCTION', 'CLOUDBASE_SECRET_KEY'],
  },
]

function pick(keys) {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return v
  }
  return ''
}

function render(spec) {
  const envId = pick(spec.envIdKeys)
  const secretId = pick(spec.secretIdKeys)
  const secretKey = pick(spec.secretKeyKeys)
  const appId = pick(['TARO_APP_ID'])

  const missing = []
  if (!envId) missing.push(spec.envIdKeys.join(' / '))
  if (!secretId) missing.push(spec.secretIdKeys.join(' / '))
  if (!secretKey) missing.push(spec.secretKeyKeys.join(' / '))
  if (!appId) missing.push('TARO_APP_ID')

  if (missing.length) {
    throw new Error(`${spec.file} 缺少环境变量: ${missing.join(', ')}`)
  }

  const lines = [
    `TARO_APP_BUILD_ENV=${spec.buildEnv}`,
    `TARO_APP_ID=${appId}`,
    `TARO_APP_CLOUD_ENV_ID=${envId}`,
    `TARO_APP_DEBUG_PANEL=${spec.debugPanel}`,
    '',
    '# 由 scripts/write-env-from-secrets.mjs 生成，勿提交',
    `CLOUDBASE_SECRET_ID=${secretId}`,
    `CLOUDBASE_SECRET_KEY=${secretKey}`,
  ]
  return `${lines.join('\n')}\n`
}

const ci = process.argv.includes('--ci')

for (const spec of SPECS) {
  const path = join(ROOT, spec.file)
  if (!ci && existsSync(path)) {
    console.log(`skip ${spec.file}（已存在）`)
    continue
  }
  writeFileSync(path, render(spec))
  console.log(`wrote ${spec.file}`)
}
