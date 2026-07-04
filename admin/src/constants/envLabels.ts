import { BRAND } from './theme'

/** 三端环境展示名（面向管理员，非 slug） */
export const ENV_LABELS: Record<string, string> = {
  development: '开发',
  test: '测试',
  production: '正式'
}

export const ENV_SLUGS = ['development', 'test', 'production'] as const

export type EnvSlug = (typeof ENV_SLUGS)[number]

export const ENV_SEGMENTS = [
  { label: '开发', value: 'development' },
  { label: '测试', value: 'test' },
  { label: '正式', value: 'production' }
] as const

/** 正式打包的管理端不含开发环境 */
export const VISIBLE_ENV_SEGMENTS = import.meta.env.PROD
  ? ENV_SEGMENTS.filter((item) => item.value !== 'development')
  : ENV_SEGMENTS

export const VISIBLE_ENV_SLUGS = VISIBLE_ENV_SEGMENTS.map((item) => item.value)

/** 环境标签色：与小程序品牌色板一致 */
export const ENV_TAG_COLORS: Record<string, string> = {
  development: BRAND.textSecondary,
  test: BRAND.warning,
  production: BRAND.primary
}

export function envLabel(slug: string, fallback?: string) {
  return ENV_LABELS[slug] ?? fallback ?? slug
}
