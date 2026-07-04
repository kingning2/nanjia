/**
 * 对比各环境 portfolioHome 返回
 * 用法: node scripts/diag-portfolio-home-envs.mjs
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null
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

function callTencentApi({ region, secretId, secretKey, payload }) {
  const service = 'scf'
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
          'X-TC-Action': 'Invoke',
          'X-TC-Version': '2018-04-16',
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

async function invokePortfolioHome(envId, secretId, secretKey) {
  const res = await callTencentApi({
    region: 'ap-shanghai',
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
  if (!retMsg) return { error: res?.Response?.Error || res }
  return JSON.parse(retMsg)
}

async function main() {
  for (const name of ['development', 'test', 'production']) {
    const file = path.join(root, `.env.${name}`)
    const env = loadEnvFile(file)
    if (!env?.TARO_APP_CLOUD_ENV_ID) {
      console.log(`\n[${name}] 跳过（无 .env.${name}）`)
      continue
    }
    const envId = env.TARO_APP_CLOUD_ENV_ID
    const secretId = env.CLOUDBASE_SECRET_ID
    const secretKey = env.CLOUDBASE_SECRET_KEY
    console.log(`\n[${name}] env=${envId}`)
    try {
      const parsed = await invokePortfolioHome(envId, secretId, secretKey)
      if (parsed.error) {
        console.log('  invoke error:', JSON.stringify(parsed.error))
        continue
      }
      const data = parsed.data || {}
      const keys = Object.keys(data)
      console.log(`  code=${parsed.code} keys=[${keys.join(', ')}]`)
      console.log(
        `  heroMediaType=${data.heroMediaType ?? '(缺失)'} videos=${(data.carouselVideos || []).length} heroImages=${(data.heroImages || []).length} homeImages=${(data.homeImages || []).length}`
      )
      if ((data.carouselVideos || []).length) {
        console.log(`  videos[0]: ${data.carouselVideos[0].videoUrl?.slice(0, 80)}...`)
      }
      if ((data.heroImages || []).length) {
        console.log(`  heroImages[0]: ${data.heroImages[0].imageUrl?.slice(0, 80)}...`)
      }
      if ((data.homeImages || []).length) {
        console.log(`  homeImages[0]: ${data.homeImages[0].imageUrl?.slice(0, 80)}...`)
      }
    } catch (err) {
      console.log(`  ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
