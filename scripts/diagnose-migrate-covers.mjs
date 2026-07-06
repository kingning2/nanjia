import fs from 'node:fs'
import cloudbase from '@cloudbase/node-sdk'

function loadEnv(f) {
  const o = {}
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    o[t.slice(0, eq).trim()] = v
  }
  return o
}

const test = loadEnv('.env.test')
const app = cloudbase.init({
  env: test.TARO_APP_CLOUD_ENV_ID,
  secretId: test.CLOUDBASE_SECRET_ID,
  secretKey: test.CLOUDBASE_SECRET_KEY
})
const db = app.database()

const broken =
  'cloud://cloud1-d7gyfke5pcc4a88a5.636c-cloud1-d7gyfke5pcc4a88a5-1449099793/material_cards/covers/image-6e55f29f5b5a4bb28dd5e70de423749c.webp'
const ok =
  'cloud://cloud1-d7gyfke5pcc4a88a5.636c-cloud1-d7gyfke5pcc4a88a5-1449099793/material-cards/covers/_____20260703165955_1144_265-c5b0fbb5dbf64a70948e693489f35f11.webp'

for (const [label, fid] of [
  ['失效封面(27条卡片共用)', broken],
  ['有效封面(唯一成功那条)', ok]
]) {
  const count = await db.collection('media_files').where({ fileID: fid }).count()
  let dl = '未测'
  try {
    const r = await app.downloadFile({ fileID: fid })
    dl = Buffer.isBuffer(r.fileContent) ? `可下载 ${r.fileContent.length}B` : '下载为空'
  } catch (e) {
    dl = `下载失败: ${e instanceof Error ? e.message : String(e)}`
  }
  console.log(`${label}`)
  console.log(`  media_files 记录: ${count.total > 0 ? '有' : '无'}`)
  console.log(`  云存储: ${dl}`)
  console.log(`  路径: ...${fid.slice(-60)}`)
}
