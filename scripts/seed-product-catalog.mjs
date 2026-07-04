/**
 * 向云开发文档库写入产品页 L1 分类 + L2 项目（开发环境默认）
 * 用法: node scripts/seed-product-catalog.mjs
 *       node scripts/seed-product-catalog.mjs --env test
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const DB_BASE = '/v1/database/instances/(default)/databases/(default)'

/** 封面占位：空字符串，小程序端展示默认占位图 */
const PLACEHOLDER_COVER = ''

const LEGACY_IDS = {
  categories: ['cat-sample-1', 'cat-party'],
  projects: [
    'proj-sample-1',
    'proj-opening-06',
    'proj-party-01',
    'proj-party-02',
    'proj-party-03',
    'proj-party-04',
    'proj-party-05',
    'proj-party-06',
    'proj-party-07',
    'proj-party-08',
    'proj-party-09'
  ]
}

/** L1 分类 + L2 项目（含商用描述） */
const CATALOG = [
  {
    id: 'cat-wedding',
    name: '婚礼策划',
    titleEn: 'WEDDING PLANNING',
    titleZh: '婚礼策划',
    desc: '从求婚到婚礼仪式，一站式定制您的专属浪漫',
    sort: 0,
    isPrimary: true,
    projects: [
      {
        title: '婚礼场地布置',
        desc: '殿堂、户外、酒店宴会厅全流程场景搭建与花艺软装，打造梦想婚礼现场'
      },
      {
        title: '婚车布置',
        desc: '主婚车与车队统一花材装饰，彰显迎亲仪式感与整体格调'
      },
      {
        title: '手捧花定制',
        desc: '新娘手捧花、胸花、腕花成套定制，花材配色与婚纱造型呼应'
      },
      {
        title: '婚礼摄影摄像',
        desc: '专业团队全程跟拍记录，交付精修相册与高清影像成片'
      },
      {
        title: '婚礼化妆跟妆',
        desc: '资深跟妆师全天驻场服务，打造上镜持久、自然精致的婚礼妆容'
      },
      {
        title: '婚礼主持人',
        desc: '经验丰富的主持人把控流程节奏，营造温馨热烈的仪式氛围'
      },
      {
        title: '婚房布置',
        desc: '新房卧室与客厅惊喜布置，用花艺气球开启甜蜜新婚第一夜'
      },
      {
        title: '婚礼管家',
        desc: '婚礼当天全程统筹协调各方，让您与亲友安心享受重要时刻'
      }
    ]
  },
  {
    id: 'cat-opening',
    name: '开业庆典',
    titleEn: 'GRAND OPENING',
    titleZh: '开业庆典',
    desc: '开业剪彩、氛围布置与活动执行，助力品牌闪亮登场',
    sort: 1,
    projects: [
      {
        title: '开业/庆典活动布置',
        desc: '门头花艺、舞台背景与氛围道具一体化设计施工，快速引爆开业热度'
      },
      {
        title: '开业庆典主持',
        desc: '专业主持人串场控场，提升开业仪式感染力与品牌格调'
      },
      {
        title: '开业花篮',
        desc: '大气花篮与祝贺花礼定制，彰显隆重祝福与品牌气场'
      },
      {
        title: '舞龙舞狮',
        desc: '传统瑞兽表演团队驻场，点燃开业现场喜气与活力'
      },
      {
        title: '礼仪小姐',
        desc: '专业礼仪人员迎宾引导，提升活动档次与服务形象'
      }
    ]
  },
  {
    id: 'cat-floral',
    name: '花艺软装',
    titleEn: 'FLORAL STYLING',
    titleZh: '花艺软装',
    desc: '商业空间与居家场景花艺软装，提升格调与品牌美感',
    sort: 2,
    projects: [
      {
        title: '橱窗花艺软装',
        desc: '门店橱窗花艺陈列设计，吸引客流、强化品牌视觉识别'
      },
      {
        title: '鲜花瀑布软装',
        desc: '大型鲜花瀑布装置定制，打造惊艳打卡场景与空间焦点'
      },
      {
        title: '私人定制软装',
        desc: '按空间需求一对一方案设计与落地，呈现专属花艺美学'
      }
    ]
  },
  {
    id: 'cat-birthday',
    name: '生日宴会',
    titleEn: 'BIRTHDAY BANQUET',
    titleZh: '生日宴会',
    desc: '宝宝宴、周岁宴到寿宴，为每一个重要纪念日营造仪式感',
    sort: 3,
    projects: [
      {
        title: '宝宝宴会布置',
        desc: '温馨童趣主题布置，记录宝宝降临的珍贵喜悦时刻'
      },
      {
        title: '周岁宴会布置',
        desc: '抓周、背景与甜品台整体策划，定格成长里程碑'
      },
      {
        title: '生日宴会布置',
        desc: '主题气球与花艺布场，专属定制寿星高光庆祝现场'
      },
      {
        title: '寿宴布置',
        desc: '庄重雅致中式寿宴布置，表达晚辈敬意与全家福氛围'
      }
    ]
  },
  {
    id: 'cat-surprise',
    name: '惊喜布置策划',
    titleEn: 'SURPRISE PLANNING',
    titleZh: '惊喜布置策划',
    desc: '提车、求婚与纪念日惊喜策划，让重要瞬间更值得铭记',
    sort: 4,
    projects: [
      {
        title: '提车仪式',
        desc: '鲜花蝴蝶结与地爆气球布置，为喜提新车增添满满仪式感'
      },
      {
        title: '求婚惊喜布置',
        desc: '浪漫场景与氛围道具定制，助力完美告白与难忘瞬间'
      },
      {
        title: '后备箱惊喜',
        desc: '后备箱鲜花礼盒惊喜布置，制造浪漫记忆点与感动时刻'
      }
    ]
  },
  {
    id: 'cat-dessert',
    name: '甜品台茶歇',
    titleEn: 'DESSERT & TEA BREAK',
    titleZh: '甜品台茶歇',
    desc: '婚礼甜品台、活动茶歇与花艺沙龙，精致呈现与品味兼顾',
    sort: 5,
    projects: [
      {
        title: '婚礼甜品茶歇',
        desc: '婚礼现场甜品台陈列与花艺点缀，甜蜜与颜值兼备'
      },
      {
        title: '活动茶歇',
        desc: '会务、开业与沙龙活动茶歇布置，提升活动专业品质感'
      },
      {
        title: '花艺沙龙',
        desc: '花艺体验沙龙现场布置与花材准备，打造治愈型品牌活动'
      }
    ]
  },
  {
    id: 'cat-photo',
    name: '摄影拍摄服务',
    titleEn: 'PHOTOGRAPHY',
    titleZh: '摄影拍摄服务',
    desc: '订婚宴、领证与毕业季专业跟拍，留住人生高光影像',
    sort: 6,
    projects: [
      {
        title: '订婚宴拍摄',
        desc: '订婚仪式与亲友合影跟拍，呈现幸福启程的每个细节'
      },
      {
        title: '领证跟拍',
        desc: '民政局领证全程跟拍记录，留下合法相守的珍贵影像'
      },
      {
        title: '毕业季拍摄',
        desc: '单人、宿舍与班级毕业照拍摄，定格青春最闪光的篇章'
      }
    ]
  }
]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
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

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function tc3Sign({ secretId, secretKey, method, canonicalUri, host, action, body, timestamp }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, sha256Hex(body)].join('\n')
  const credentialScope = `${date}/tcb/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const kDate = hmacSha256(`TC3${secretKey}`, date)
  const kService = hmacSha256(kDate, 'tcb')
  const kSigning = hmacSha256(kService, 'tc3_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}, Timestamp=${timestamp}`
}

function buildSortedQuery(params) {
  return params
    .slice()
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

async function gatewayRequest({ envId, secretId, secretKey, method, pathAndQuery, action, body = '' }) {
  const host = `${envId}.api.tcloudbasegateway.com`
  const canonicalUri = pathAndQuery.split('?')[0] || pathAndQuery
  const timestamp = Math.floor(Date.now() / 1000)
  const authorization = tc3Sign({
    secretId,
    secretKey,
    method,
    canonicalUri,
    host,
    action,
    body,
    timestamp
  })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: pathAndQuery,
        method,
        headers: {
          'Content-Type': 'application/json',
          Host: host,
          Authorization: authorization,
          'X-TC-Action': action,
          'X-TC-Timestamp': String(timestamp),
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          let parsed = data
          try {
            parsed = JSON.parse(data)
          } catch {
            /* keep raw */
          }
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            reject(new Error(`${action} HTTP ${res.statusCode}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`))
          }
        })
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function docsPath(collection) {
  return `${DB_BASE}/collections/${collection}/documents`
}

function docPath(collection, id) {
  return `${docsPath(collection)}/${id}`
}

async function queryAll(client, collection) {
  const items = []
  let offset = 0
  const limit = 200
  while (true) {
    const order = JSON.stringify([{ field: 'sort', direction: 'asc' }])
    const query = buildSortedQuery([
      ['limit', String(limit)],
      ['offset', String(offset)],
      ['order', order],
      ['query', '{}']
    ])
    const path = `${docsPath(collection)}?${query}`
    const res = await gatewayRequest({ ...client, method: 'GET', pathAndQuery: path, action: 'QueryDocuments' })
    const batch = res?.list || res?.data?.list || []
    items.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }
  return items
}

async function upsertDocument(client, collection, doc) {
  const id = doc._id
  const path = docPath(collection, id)
  const patchBody = JSON.stringify({ data: { $set: withoutId(doc) } })
  try {
    await gatewayRequest({
      ...client,
      method: 'PATCH',
      pathAndQuery: path,
      action: 'UpdateDocument',
      body: patchBody
    })
    return 'updated'
  } catch {
    const insertBody = JSON.stringify({ data: [doc] })
    await gatewayRequest({
      ...client,
      method: 'POST',
      pathAndQuery: docsPath(collection),
      action: 'InsertDocument',
      body: insertBody
    })
    return 'inserted'
  }
}

async function deleteDocument(client, collection, id) {
  try {
    await gatewayRequest({
      ...client,
      method: 'DELETE',
      pathAndQuery: docPath(collection, id),
      action: 'DeleteDocument'
    })
    return true
  } catch {
    return false
  }
}

function withoutId(doc) {
  const { _id, ...rest } = doc
  return rest
}

function projectId(categoryId, index) {
  return `proj-${categoryId.replace(/^cat-/, '')}-${String(index + 1).padStart(2, '0')}`
}

function nowIso() {
  return new Date().toISOString()
}

function expectedProjectIds() {
  const ids = new Set()
  for (const category of CATALOG) {
    for (let i = 0; i < category.projects.length; i += 1) {
      ids.add(projectId(category.id, i))
    }
  }
  return ids
}

function expectedCategoryIds() {
  return new Set(CATALOG.map((item) => item.id))
}

async function cleanupStale(client) {
  const keepCategories = expectedCategoryIds()
  const keepProjects = expectedProjectIds()

  const categories = await queryAll(client, 'categories')
  for (const doc of categories) {
    const id = doc._id || doc.id
    if (id && !keepCategories.has(id)) {
      const ok = await deleteDocument(client, 'categories', id)
      console.log(`${ok ? '✓' : '·'} 清理旧分类 ${id}`)
    }
  }

  const projects = await queryAll(client, 'projects')
  for (const doc of projects) {
    const id = doc._id || doc.id
    if (id && !keepProjects.has(id)) {
      const ok = await deleteDocument(client, 'projects', id)
      console.log(`${ok ? '✓' : '·'} 清理旧项目 ${id}`)
    }
  }
}

async function upsertPrimaryCategory(client, categoryId, stamp) {
  const primaryCategoryId = categoryId

  let existing = []
  try {
    existing = await queryAll(client, 'home_settings')
  } catch (err) {
    console.log(`（home_settings 查询跳过: ${err.message}）`)
  }

  if (existing.length > 0) {
    const doc = existing[0]
    const id = doc._id || doc.id
    const patchBody = JSON.stringify({
      data: {
        $set: {
          primaryCategoryId,
          updatedAt: stamp
        }
      }
    })
    await gatewayRequest({
      ...client,
      method: 'PATCH',
      pathAndQuery: docPath('home_settings', id),
      action: 'UpdateDocument',
      body: patchBody
    })
    console.log(`~ home_settings.primaryCategoryId → ${primaryCategoryId}`)
    return
  }

  const insertBody = JSON.stringify({
    data: [
      {
        _id: 'home-settings-default',
        videos: [],
        images: [],
        splashSkipSeconds: 5,
        videoCompressEnabled: true,
        defaultVideoCompressPreset: 'standard',
        primaryCategoryId,
        createdAt: stamp,
        updatedAt: stamp
      }
    ]
  })
  await gatewayRequest({
    ...client,
    method: 'POST',
    pathAndQuery: docsPath('home_settings'),
    action: 'InsertDocument',
    body: insertBody
  })
  console.log(`+ home_settings.primaryCategoryId → ${primaryCategoryId}`)
}

async function main() {
  const envFlag = process.argv.includes('--env')
    ? process.argv[process.argv.indexOf('--env') + 1]
    : 'development'
  const envFile = path.join(root, `.env.${envFlag}`)
  const envVars = loadEnvFile(envFile)
  const envId = envVars.TARO_APP_CLOUD_ENV_ID || envVars.CLOUDBASE_ENV_ID
  const secretId = envVars.CLOUDBASE_SECRET_ID
  const secretKey = envVars.CLOUDBASE_SECRET_KEY

  if (!envId || !secretId || !secretKey) {
    console.error(`缺少配置，请检查 ${envFile} 中的 TARO_APP_CLOUD_ENV_ID / CLOUDBASE_SECRET_*`)
    process.exit(1)
  }

  const client = { envId, secretId, secretKey }
  const stamp = nowIso()
  const primaryCategory = CATALOG.find((item) => item.isPrimary) || CATALOG[0]

  console.log(`=== 产品目录种子数据 → ${envFlag} (${envId}) ===`)

  for (const id of LEGACY_IDS.categories) {
    const ok = await deleteDocument(client, 'categories', id)
    console.log(`${ok ? '✓' : '·'} 删除旧分类 ${id}`)
  }
  for (const id of LEGACY_IDS.projects) {
    const ok = await deleteDocument(client, 'projects', id)
    console.log(`${ok ? '✓' : '·'} 删除旧项目 ${id}`)
  }

  await cleanupStale(client).catch((err) => {
    console.log(`（跳过库内扫描清理: ${err.message}）`)
  })

  let categoryCount = 0
  let projectCount = 0

  for (const category of CATALOG) {
    const categoryDoc = {
      _id: category.id,
      name: category.name,
      titleEn: category.titleEn,
      titleZh: category.titleZh,
      desc: category.desc,
      sort: category.sort,
      published: true,
      createdAt: stamp,
      updatedAt: stamp
    }
    const catResult = await upsertDocument(client, 'categories', categoryDoc)
    categoryCount += 1
    console.log(`${catResult === 'inserted' ? '+' : '~'} 分类 ${category.name} (${category.id})`)

    for (let i = 0; i < category.projects.length; i += 1) {
      const { title, desc } = category.projects[i]
      const id = projectId(category.id, i)
      const projectDoc = {
        _id: id,
        categoryId: category.id,
        title,
        cover: PLACEHOLDER_COVER,
        desc,
        price: 0,
        sort: i,
        published: true,
        createdAt: stamp,
        updatedAt: stamp
      }
      const projResult = await upsertDocument(client, 'projects', projectDoc)
      projectCount += 1
      console.log(`  ${projResult === 'inserted' ? '+' : '~'} ${title}`)
    }
  }

  await upsertPrimaryCategory(client, primaryCategory.id, stamp)

  console.log('')
  console.log(`完成: ${categoryCount} 个一级分类, ${projectCount} 个二级项目`)
  console.log(`主营分类: ${primaryCategory.name} (${primaryCategory.id})`)
  try {
    const categories = await queryAll(client, 'categories')
    const projects = await queryAll(client, 'projects')
    console.log(`库内现有: categories=${categories.length}, projects=${projects.length}`)
  } catch (err) {
    console.log(`（写入已完成；库内统计查询跳过: ${err.message}）`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
