import Taro from '@tarojs/taro'
import { ensureCloudInit } from '../services/cloud/init'

const cloudFileIdPattern = /^cloud:\/\//

function isPreviewableUrl(url: string) {
  if (!url) return false
  if (/^https?:\/\//i.test(url)) return true
  if (url.startsWith('wxfile://')) return true
  const userDataPath = Taro.env.USER_DATA_PATH
  return Boolean(userDataPath && url.startsWith(userDataPath))
}

async function resolveCloudTempUrls(fileIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(fileIds.filter((id) => cloudFileIdPattern.test(id)))]
  if (!ids.length) return {}

  try {
    await ensureCloudInit()
    const cloud = Taro.cloud as {
      getTempFileURL?: (opts: {
        fileList: string[]
      }) => Promise<{
        fileList?: Array<{ fileID: string; tempFileURL?: string; status: number }>
      }>
    }
    if (!cloud?.getTempFileURL) return {}

    const result = await cloud.getTempFileURL({ fileList: ids })
    const map: Record<string, string> = {}
    for (const item of result.fileList || []) {
      if (item.status === 0 && item.tempFileURL) {
        map[item.fileID] = item.tempFileURL
      }
    }
    return map
  } catch {
    return {}
  }
}

async function writeBase64ToLocalFile(dataUrl: string, prefix: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
  if (!match) return ''

  const mime = match[1]
  const base64 = match[2]
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/jpeg' || mime === 'image/jpg'
          ? 'jpg'
          : 'img'

  // @ts-expect-error - WeChat global
  const wxBase64ToArrayBuffer: ((b64: string) => ArrayBuffer) | undefined = wx?.base64ToArrayBuffer
  if (!wxBase64ToArrayBuffer) return ''

  const buffer = wxBase64ToArrayBuffer(base64)
  const filePath = `${Taro.env.USER_DATA_PATH}/${prefix}-${Date.now()}.${ext}`
  const fsm = Taro.getFileSystemManager()

  await new Promise<void>((resolve, reject) => {
    fsm.writeFile({
      filePath,
      data: buffer,
      success: () => resolve(),
      fail: () => reject(new Error('writeFile failed'))
    })
  })

  return filePath
}

export async function resolveImagePreviewSrc(
  src: string,
  prefix = 'preview',
  cloudUrlMap?: Record<string, string>
) {
  const trimmed = src.trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) return trimmed

  if (cloudFileIdPattern.test(trimmed)) {
    const cached = cloudUrlMap?.[trimmed]
    if (cached) return cached
    const map = await resolveCloudTempUrls([trimmed])
    if (map[trimmed]) return map[trimmed]
  }

  if (/^data:image\//i.test(trimmed)) {
    try {
      const localFile = await writeBase64ToLocalFile(trimmed, prefix)
      if (localFile) return localFile
    } catch {
      // continue fallback
    }
  }

  try {
    const info = await Taro.getImageInfo({ src: trimmed })
    return info.path || trimmed
  } catch {
    return trimmed
  }
}

export async function previewCloudImage(
  src: string,
  prefix = 'preview',
  options?: { showmenu?: boolean }
) {
  const cloudMap = await resolveCloudTempUrls([src])
  const resolved = await resolveImagePreviewSrc(src, prefix, cloudMap)
  if (!isPreviewableUrl(resolved)) {
    Taro.showToast({ title: '预览失败', icon: 'none' })
    return
  }
  return Taro.previewImage({
    current: resolved,
    urls: [resolved],
    showmenu: options?.showmenu ?? true
  })
}

/** 案例图预览：可左右滑动，隐藏长按菜单（不可保存/转发） */
export async function previewProtectedImages(
  urls: string[],
  currentIndex = 0,
  prefix = 'case-preview'
) {
  const list = urls.map((url) => url.trim()).filter(Boolean)
  if (!list.length) return

  const cloudMap = await resolveCloudTempUrls(list)
  const pairs = await Promise.all(
    list.map((url, index) =>
      resolveImagePreviewSrc(url, `${prefix}-${index}`, cloudMap).then((resolved) => ({
        resolved
      }))
    )
  )

  const resolved = pairs.map((item) => item.resolved).filter(isPreviewableUrl)
  if (!resolved.length) {
    Taro.showToast({ title: '预览失败', icon: 'none' })
    return
  }

  const safeIndex = Math.min(Math.max(currentIndex, 0), list.length - 1)
  const currentCandidate = pairs[safeIndex]?.resolved
  const current = isPreviewableUrl(currentCandidate) ? currentCandidate : resolved[0]

  return Taro.previewImage({
    current,
    urls: resolved,
    showmenu: false
  }).catch(() => {
    Taro.showToast({ title: '预览失败', icon: 'none' })
  })
}
