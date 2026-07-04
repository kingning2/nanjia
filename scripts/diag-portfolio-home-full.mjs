/**
 * 完整诊断 portfolioHome 返回 + home_settings 原始文档
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

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

function callTencentApi({ service, action, version, region, secretId, secretKey, payload }) {
  const host = `${service}.tencentcloudapi.com`
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`
  const signedHeaders = 'content-type;host'
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256Hex(body)].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const kDate = hmacSha256(`TC3${secretKey}`, date)
  const kService = hmacSha256(kDate, service)
  const kSigning = hmacSha256(kService, 'tc3_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Host: host,
          Authorization: authorization,
          'X-TC-Action': action,
          'X-TC-Version': version,
          'X-TC-Region': region,
          'X-TC-Timestamp': String(timestamp),
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve({ raw: data })
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const env = loadEnvFile(path.join(root, '.env.development'))
const envId = env.TARO_APP_CLOUD_ENV_ID
const secretId = env.CLOUDBASE_SECRET_ID
const secretKey = env.CLOUDBASE_SECRET_KEY
const region = 'ap-shanghai'

async function invokePortfolioHome() {
  const res = await callTencentApi({
    service: 'scf',
    action: 'Invoke',
    version: '2018-04-16',
    region,
    secretId,
    secretKey,
    payload: {
      FunctionName: 'portfolioHome',
      Namespace: envId,
      InvocationType: 'RequestResponse',
      ClientContext: '{}'
    }
  })
  const retMsg = res?.Response?.Result?.RetMsg
  return retMsg ? JSON.parse(retMsg) : { error: res?.Response?.Error || res }
}

async function queryHomeSettings() {
  const host = `${envId}.api.tcloudbasegateway.com`
  const DB_BASE = '/v1/database/instances/(default)/databases/(default)'
  const pathAndQuery = `${DB_BASE}/collections/home_settings/documents?limit=20&offset=0&query=${encodeURIComponent('{}')}`
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const action = 'QueryDocuments'
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = ['GET', '/v1/database/instances/(default)/databases/(default)/collections/home_settings/documents', '', canonicalHeaders, signedHeaders, sha256Hex('')].join('\n')
  const credentialScope = `${date}/tcb/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const kDate = hmacSha256(`TC3${secretKey}`, date)
  const kService = hmacSha256(kDate, 'tcb')
  const kSigning = hmacSha256(kService, 'tc3_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}, Timestamp=${timestamp}`

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: pathAndQuery,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Host: host,
          Authorization: authorization,
          'X-TC-Action': action,
          'X-TC-Timestamp': String(timestamp)
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            resolve(parsed?.list || parsed?.data?.list || [])
          } catch {
            resolve([])
          }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  console.log(`env: ${envId}\n`)

  console.log('=== portfolioHome 云端返回 ===')
  const parsed = await invokePortfolioHome()
  console.log(JSON.stringify(parsed, null, 2))

  console.log('\n=== home_settings 原始文档 ===')
  const docs = await queryHomeSettings()
  console.log(`文档数: ${docs.length}`)
  for (const doc of docs) {
    const id = doc._id || doc.id
    const heroMediaType = doc.heroMediaType
    const videos = doc.videos || doc.banners || []
    const heroImages = doc.heroImages || []
    const images = doc.images || []
    console.log(`\n--- ${id} ---`)
    console.log(`  heroMediaType: ${heroMediaType ?? '(无)'}`)
    console.log(`  videos: ${videos.length}, heroImages: ${heroImages.length}, images: ${images.length}`)
    if (heroImages.length) console.log(`  heroImages[0]: ${JSON.stringify(heroImages[0])}`)
    if (images.length) console.log(`  images[0]: ${JSON.stringify(images[0])}`)
    if (videos.length) console.log(`  videos[0]: ${JSON.stringify(videos[0])}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
