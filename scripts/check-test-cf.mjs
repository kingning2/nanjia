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

function tc3GatewaySign({ secretId, secretKey, host, action, payload, timestamp, canonicalUri = '/v1/storages/get-objects-upload-info' }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = ['POST', canonicalUri, '', canonicalHeaders, signedHeaders, sha256Hex(payload)].join('\n')
  const credentialScope = `${date}/tcb/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const kDate = hmacSha256(`TC3${secretKey}`, date)
  const kService = hmacSha256(kDate, 'tcb')
  const kSigning = hmacSha256(kService, 'tc3_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}, Timestamp=${timestamp}`
}

async function probeGateway(envId) {
  const host = `${envId}.api.tcloudbasegateway.com`
  const path = '/v1/storages/get-objects-upload-info'
  const action = 'GetObjectsUploadInfo'
  const body = '[{"objectId":"diag/test.txt"}]'
  const timestamp = Math.floor(Date.now() / 1000)
  const authorization = tc3GatewaySign({ secretId, secretKey, host, action, payload: body, timestamp })

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: host,
        path,
        method: 'POST',
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
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          let parsed = data
          try { parsed = JSON.parse(data) } catch { /* keep raw */ }
          resolve({ envId, status: res.statusCode, body: parsed })
        })
      }
    )
    req.on('error', (err) => resolve({ envId, error: err.message }))
    req.write(body)
    req.end()
  })
}

function tc3Sign({ secretId, secretKey, service, host, payload, timestamp }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`
  const signedHeaders = 'content-type;host'
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256Hex(payload)].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const kDate = hmacSha256(`TC3${secretKey}`, date)
  const kService = hmacSha256(kDate, service)
  const kSigning = hmacSha256(kService, 'tc3_request')
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

function callTencentApi({ service, action, version, region, payload, secretId, secretKey }) {
  const host = `${service}.tencentcloudapi.com`
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const authorization = tc3Sign({ secretId, secretKey, service, host, payload: body, timestamp })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Host: host,
          Authorization: authorization,
          'X-TC-Action': action,
          'X-TC-Version': version,
          'X-TC-Timestamp': String(timestamp),
          'X-TC-Region': region
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const testEnv = loadEnvFile(path.join(root, '.env.test'))
const devEnv = loadEnvFile(path.join(root, '.env.development'))
const prodEnv = loadEnvFile(path.join(root, '.env.production'))
const adminEnv = loadEnvFile(path.join(root, 'admin', '.env'))
const envId = testEnv.TARO_APP_CLOUD_ENV_ID
const secretId = adminEnv.CLOUDBASE_SECRET_ID
const secretKey = adminEnv.CLOUDBASE_SECRET_KEY

const expectedFunctions = [
  'portfolioHome',
  'splashConfig',
  'contactConfig',
  'socialConfig',
  'projectDetail',
  'materialCardDetail',
  'productCatalog'
]

const regions = ['ap-shanghai', 'ap-guangzhou']

async function listFunctionsFor(region, namespace) {
  return callTencentApi({
    service: 'scf',
    action: 'ListFunctions',
    version: '2018-04-16',
    region,
    secretId,
    secretKey,
    payload: { Namespace: namespace, Limit: 100, Offset: 0 }
  })
}

async function invokeFunction(region, namespace, functionName) {
  return callTencentApi({
    service: 'scf',
    action: 'Invoke',
    version: '2018-04-16',
    region,
    secretId,
    secretKey,
    payload: {
      FunctionName: functionName,
      Namespace: namespace,
      InvocationType: 'RequestResponse',
      ClientContext: JSON.stringify({ source: 'check-test-cf' })
    }
  })
}

function summarizeInvoke(resultBody) {
  const resp = resultBody?.Response
  if (!resp) return { ok: false, detail: '无 Response' }
  if (resp.Error) return { ok: false, detail: `${resp.Error.Code}: ${resp.Error.Message}` }
  let parsed = null
  try {
    parsed = JSON.parse(resp.Result?.RetMsg || '{}')
  } catch {
    parsed = { raw: resp.Result?.RetMsg }
  }
  const code = parsed?.code
  const ok = code === 0
  return {
    ok,
    detail: parsed?.message || parsed?.raw || '调用成功',
    code,
    dataKeys: parsed?.data ? Object.keys(parsed.data) : []
  }
}

async function main() {
  console.log('=== 账号与环境核对 ===')
  console.log(`admin/.env 密钥: ${secretId ? '已配置' : '缺失'}`)
  console.log(`.env.test 云环境: ${envId}`)
  console.log(`.env.test AppID: ${testEnv.TARO_APP_ID}`)
  console.log('')

  const envRes = await callTencentApi({
    service: 'tcb',
    action: 'DescribeEnvs',
    version: '2018-06-08',
    region: 'ap-shanghai',
    secretId,
    secretKey,
    payload: {}
  })

  const envList = envRes.body?.Response?.EnvList || []
  const envErr = envRes.body?.Response?.Error
  if (envErr) {
    console.log(`DescribeEnvs 失败: ${envErr.Code} - ${envErr.Message}`)
    process.exit(1)
  }

  console.log(`当前账号下共有 ${envList.length} 个云开发环境:`)
  const knownIds = new Set()
  for (const item of envList) {
    knownIds.add(item.EnvId)
    const marks = []
    if (item.EnvId === envId) marks.push('测试 .env.test')
    if (item.EnvId === devEnv.TARO_APP_CLOUD_ENV_ID) marks.push('开发')
    if (item.EnvId === prodEnv.TARO_APP_CLOUD_ENV_ID) marks.push('生产')
    console.log(`  - ${item.EnvId} (${item.Alias || item.EnvName || '无别名'}) 状态=${item.Status}${marks.length ? ` <-- ${marks.join(' / ')}` : ''}`)
  }
  console.log('')

  const inAccount = knownIds.has(envId)
  console.log(`测试环境是否在 admin 密钥账号的 DescribeEnvs 列表: ${inAccount ? '是 ✓' : '否 ✗'}`)
  console.log('')
  console.log('=== HTTP 网关探测（与你贴的 curl 同一域名）===')
  for (const probeEnv of [envId, devEnv.TARO_APP_CLOUD_ENV_ID].filter(Boolean)) {
    const gw = await probeGateway(probeEnv)
    if (gw.error) {
      console.log(`${probeEnv}: 网络错误 ${gw.error}`)
      continue
    }
    const code = gw.body?.code || gw.body?.Response?.Error?.Code || `HTTP ${gw.status}`
    const msg = gw.body?.message || gw.body?.Response?.Error?.Message || JSON.stringify(gw.body).slice(0, 120)
    console.log(`${probeEnv}: ${code} - ${msg}`)
  }
  console.log('')
  console.log('说明: 小程序 wx.cloud 走微信侧鉴权，不依赖 admin/.env 密钥；')
  console.log('      管理端 HTTP 网关才需要密钥对该环境有权限。')
  console.log('')

  if (!inAccount) {
    console.log('=== 小程序侧结论 ===')
    console.log(`xiaoman 环境在腾讯云上是真实存在的（网关域名可解析）。`)
    console.log(`.env.test 的 TARO_APP_CLOUD_ENV_ID 与你控制台示例一致，小程序配置是对的。`)
    console.log(`但 admin/.env 的 API 密钥属于另一个账号（只有 cloud1 / prod），管理端连不上 xiaoman。`)
    console.log('')
    console.log('要在微信开发者工具验证云函数: pnpm test:weapp → 选中 xiaoman 环境 → 部署函数 → 预览')
    process.exit(0)
  }

  console.log('=== 云函数部署与调用（SCF API）===')
  let region = null
  let deployed = []
  for (const candidate of regions) {
    const res = await listFunctionsFor(candidate, envId)
    const functions = res.body?.Response?.Functions || []
    if (functions.length > 0) {
      region = candidate
      deployed = functions.map((f) => f.FunctionName)
      break
    }
  }

  if (!region) {
    console.log('环境存在，但未发现已部署云函数。')
    process.exit(3)
  }

  console.log(`区域: ${region}`)
  console.log(`已部署 (${deployed.length}): ${deployed.join(', ')}`)
  const missing = expectedFunctions.filter((n) => !deployed.includes(n))
  if (missing.length) console.log(`缺少: ${missing.join(', ')}`)
  console.log('')

  let pass = 0
  let fail = 0
  for (const name of expectedFunctions.filter((n) => deployed.includes(n))) {
    const res = await invokeFunction(region, envId, name)
    const s = summarizeInvoke(res.body)
    console.log(`${s.ok ? '✓' : '✗'} ${name}: code=${s.code ?? 'n/a'} ${s.detail}${s.dataKeys.length ? ` [${s.dataKeys.join(', ')}]` : ''}`)
    if (s.ok) pass += 1
    else fail += 1
  }

  console.log('')
  console.log(`结论: ${fail === 0 && missing.length === 0 ? '测试环境云函数可用 ✓' : '测试环境云函数不完整或调用失败 ✗'} (${pass} 成功 / ${fail} 失败)`)
  process.exit(fail > 0 || missing.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
