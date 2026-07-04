const { COLLECTIONS, db, mapDocs } = require('cf-shared/db')
const { fail, makeTraceId, success } = require('cf-shared/response')

function pickString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function pickNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

async function loadContactConfig() {
  const res = await db.collection(COLLECTIONS.homeSettings).limit(1).get()
  const doc = mapDocs(res.data)[0] || {}

  const wechatQrFileId = pickString(doc.contactWechatQr)

  return {
    storeName: pickString(doc.contactStoreName) || '南嘉婚礼策划工作室',
    slogan: pickString(doc.contactSlogan) || '用心记录每一场独一无二的婚礼',
    address: pickString(doc.contactAddress),
    phone: pickString(doc.contactPhone),
    latitude: pickNumber(doc.contactLatitude),
    longitude: pickNumber(doc.contactLongitude),
    hours: pickString(doc.contactHours) || '周一至周日 10:00 - 20:00',
    wechatQrUrl: wechatQrFileId.startsWith('cloud://') ? wechatQrFileId : ''
  }
}

exports.main = async () => {
  const traceId = makeTraceId()
  try {
    const data = await loadContactConfig()
    return success({ ...data, traceId }, traceId)
  } catch (err) {
    return fail(err && err.message ? err.message : 'contactConfig failed', traceId, {
      storeName: '南嘉婚礼策划工作室',
      slogan: '用心记录每一场独一无二的婚礼',
      address: '',
      phone: '',
      latitude: 0,
      longitude: 0,
      hours: '周一至周日 10:00 - 20:00',
      wechatQrUrl: '',
      traceId
    })
  }
}
