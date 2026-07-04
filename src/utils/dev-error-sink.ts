export type DevErrorRecord = {
  source: string
  message: string
  at: number
}

export type DevResponseRecord = {
  source: string
  body: string
  at: number
}

const maxRecords = 30
const errors: DevErrorRecord[] = []
const responses: DevResponseRecord[] = []
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function formatDebugJson(value: unknown, maxLen = 2400): string {
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > maxLen ? `${text.slice(0, maxLen)}\n...(truncated)` : text
  } catch {
    return String(value)
  }
}

export function pushDevError(source: string, message: string) {
  const text = message.trim()
  if (!text) return
  errors.push({ source, message: text, at: Date.now() })
  if (errors.length > maxRecords) errors.shift()
  notify()
}

export function pushDevResponse(source: string, payload: unknown) {
  responses.push({ source, body: formatDebugJson(payload), at: Date.now() })
  if (responses.length > maxRecords) responses.shift()
  notify()
}

export function getDevErrors(): DevErrorRecord[] {
  return [...errors]
}

export function getDevResponses(): DevResponseRecord[] {
  return [...responses]
}

export function subscribeDevSink(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @deprecated use subscribeDevSink */
export function subscribeDevErrors(listener: () => void) {
  return subscribeDevSink(listener)
}
