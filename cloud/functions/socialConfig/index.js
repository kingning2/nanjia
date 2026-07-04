const { COLLECTIONS, db, mapDocs } = require('cf-shared/db')
const { fail, makeTraceId, success } = require('cf-shared/response')

function pickString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function loadSocialConfig() {
  const res = await db.collection(COLLECTIONS.homeSettings).limit(1).get()
  const doc = mapDocs(res.data)[0] || {}

  const xhsFileId = pickString(doc.xiaohongshuQr)
  const douyinFileId = pickString(doc.douyinQr)

  return {
    xiaohongshu: {
      qrUrl: xhsFileId.startsWith('cloud://') ? xhsFileId : '',
      hint: pickString(doc.xiaohongshuHint) || '长按识别二维码，关注我们的小红书'
    },
    douyin: {
      qrUrl: douyinFileId.startsWith('cloud://') ? douyinFileId : '',
      hint: pickString(doc.douyinHint) || '长按识别二维码，关注我们的抖音'
    }
  }
}

exports.main = async () => {
  const traceId = makeTraceId()
  try {
    const data = await loadSocialConfig()
    return success({ ...data, traceId }, traceId)
  } catch (err) {
    return fail(err && err.message ? err.message : 'socialConfig failed', traceId, {
      xiaohongshu: {
        qrUrl: '',
        hint: '长按识别二维码，关注我们的小红书'
      },
      douyin: {
        qrUrl: '',
        hint: '长按识别二维码，关注我们的抖音'
      },
      traceId
    })
  }
}
