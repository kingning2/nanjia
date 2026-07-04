/** 按构建环境合并 project.config.{dev|test|prod}.json → project.config.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const overlayKey = {
  development: 'dev',
  test: 'test',
  production: 'prod',
}

const env = process.argv[2] || process.env.TARO_APP_BUILD_ENV || 'production'
const suffix = overlayKey[env]
if (!suffix) {
  console.error(`[sync-project-config] 未知环境: ${env}`)
  process.exit(1)
}

const base = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const overlay = JSON.parse(
  fs.readFileSync(path.join(root, `project.config.${suffix}.json`), 'utf8')
)
const merged = {
  ...base,
  ...overlay,
  setting: { ...base.setting, ...overlay.setting },
  packOptions: {
    ...base.packOptions,
    ...overlay.packOptions,
    ignore: overlay.packOptions?.ignore ?? base.packOptions?.ignore ?? [],
  },
}

fs.writeFileSync(path.join(root, 'project.config.json'), `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
console.log(`[sync-project-config] ${env} → project.config.json`)
