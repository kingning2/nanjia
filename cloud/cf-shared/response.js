/** 云函数通用响应与 traceId */

function makeTraceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function success(data, traceId) {
  return {
    code: 0,
    message: 'ok',
    traceId,
    data
  }
}

function fail(message, traceId, data = null) {
  return {
    code: 1,
    message: message || '操作失败',
    traceId,
    data
  }
}

function emptyWithTrace(traceId, body) {
  return { ...body, traceId }
}

module.exports = {
  makeTraceId,
  success,
  fail,
  emptyWithTrace
}
