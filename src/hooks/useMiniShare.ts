import Taro, { useLoad, useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'

export const MINI_SHARE_TITLE = '南嘉婚礼策划工作室'

export type MiniSharePayload = {
  title?: string
  path?: string
  query?: string
  imageUrl?: string
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function buildQuery(params: Record<string, string | undefined>) {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

function buildPath(path: string, query: string) {
  const base = normalizePath(path)
  return query ? `${base}?${query}` : base
}

/** 微信转发好友 + 分享到朋友圈；须在页面组件顶层调用，各页 config 须 enableShareAppMessage / enableShareTimeline */
export function useMiniShare(getPayload?: () => MiniSharePayload) {
  const router = useRouter()

  useLoad(() => {
    void Taro.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    } as Parameters<typeof Taro.showShareMenu>[0])
  })

  useShareAppMessage(() => {
    const extra = getPayload?.() ?? {}
    const query = extra.query ?? buildQuery(router.params)
    const path = extra.path
      ? buildPath(extra.path, query)
      : buildPath(router.path, query)
    return {
      title: extra.title || MINI_SHARE_TITLE,
      path,
      imageUrl: extra.imageUrl,
    }
  })

  useShareTimeline(() => {
    const extra = getPayload?.() ?? {}
    return {
      title: extra.title || MINI_SHARE_TITLE,
      query: extra.query ?? buildQuery(router.params),
      imageUrl: extra.imageUrl,
    }
  })
}
