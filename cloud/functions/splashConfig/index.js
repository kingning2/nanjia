const { COLLECTIONS, db, mapDocs } = require('cf-shared/db')
const { fail, makeTraceId, success } = require('cf-shared/response')

function clampSkipSeconds(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds)) return 5
  return Math.min(30, Math.max(1, Math.round(seconds)))
}

async function loadSplashConfig() {
  const res = await db.collection(COLLECTIONS.homeSettings).limit(1).get()
  const doc = mapDocs(res.data)[0]
  const fileId = typeof doc?.splashVideo === 'string' ? doc.splashVideo.trim() : ''
  const skipSeconds = clampSkipSeconds(doc?.splashSkipSeconds)

  return {
    videoUrl: fileId.startsWith('cloud://') ? fileId : '',
    skipSeconds
  }
}

exports.main = async () => {
  const traceId = makeTraceId()
  try {
    const data = await loadSplashConfig()
    return success({ ...data, traceId }, traceId)
  } catch (err) {
    return fail(err && err.message ? err.message : 'splashConfig failed', traceId, {
      videoUrl: '',
      skipSeconds: 5,
      traceId
    })
  }
}
