/**
 * 诊断 portfolioHome 是否返回 primaryCta，以及 home_settings 是否含 primaryCategoryId
 * 用法: node scripts/diag-portfolio-home.mjs
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

async function invokePortfolioHome(region) {
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
  if (!retMsg) {
    return { error: res?.Response?.Error || res }
  }
  return JSON.parse(retMsg)
}

async function main() {
  console.log(`env: ${envId}`)
  for (const region of ['ap-shanghai', 'ap-guangzhou']) {
    try {
      const parsed = await invokePortfolioHome(region)
      if (parsed.error) {
        console.log(`[${region}] invoke error:`, JSON.stringify(parsed.error))
        continue
      }
      const data = parsed.data || {}
      console.log(`[${region}] portfolioHome code=${parsed.code}`)
      console.log(`  data keys: ${Object.keys(data).join(', ')}`)
      console.log(`  primaryCta: ${JSON.stringify(data.primaryCta ?? '(field missing)')}`)
      console.log(`  videoCount=${(data.carouselVideos || []).length} imageCount=${(data.homeImages || []).length}`)
      return
    } catch (err) {
      console.log(`[${region}] ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
