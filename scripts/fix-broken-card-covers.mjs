/**
 * 将测试环境 material_cards 中无法下载的封面 fileID 改为空字符串
 */
import fs from 'node:fs'
import cloudbase from '@cloudbase/node-sdk'

const BROKEN_SUFFIX = 'material_cards/covers/image-6e55f29f5b5a4bb28dd5e70de423749c.webp'

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

let skip = 0
const cards = []
while (true) {
  const r = await db.collection('material_cards').skip(skip).limit(100).get()
  const batch = r.data ?? []
  cards.push(...batch)
  if (batch.length < 100) break
  skip += batch.length
}

const targets = cards.filter((c) => String(c.cover || '').includes(BROKEN_SUFFIX))
console.log(`待更新: ${targets.length} 条`)

let ok = 0
let fail = 0
for (const card of targets) {
  try {
    await db.collection('material_cards').doc(card._id).update({ cover: '' })
    console.log(`  ✓ ${card.title}`)
    ok += 1
  } catch (e) {
    console.log(`  ✗ ${card.title}: ${e instanceof Error ? e.message : String(e)}`)
    fail += 1
  }
}

console.log(`\n完成: 成功 ${ok}，失败 ${fail}`)
