/**
 * 四级内容结构契约
 *
 * L1 categories      分类
 * L2 projects        项目（图片 + 描述）
 * L3 material_cards  素材卡片（标题 + 图片）
 * L4 material_details 素材详情（表单：标题 + 正文 + 多图）
 *
 * 排序：L1～L4 均使用 sort，越小越靠前；查询默认 orderBy sort asc
 */

import type { VideoCompressPresetDTO } from './upload'

/** 图片引用：media_files.fileID 或 HTTPS URL */
export type ImageRef = string

/** 详情内可排序配图 */
export interface MaterialDetailImageDTO {
  image: ImageRef
  /** 越小越靠前，与同级图片唯一确定展示顺序 */
  sort: number
}

/** L1 分类 */
export interface CategoryDTO {
  id: string
  name: string
  /** 首页 CTA 英文标题 */
  titleEn?: string
  /** 首页 CTA 中文标题，留空时回退 name */
  titleZh?: string
  desc?: string
  sort: number
  published?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CategorySaveParams {
  id?: string
  name: string
  titleEn?: string
  titleZh?: string
  desc?: string
  sort: number
  published?: boolean
}

/** 首页视频轮播（系统设置） */
export interface HomeCarouselVideoDTO {
  /** 云存储 fileID，由云函数解析为临时播放地址 */
  video: string
  sort: number
}

/** 首页顶部轮播模式：视频轮播 / 图片轮播 */
export type HomeHeroMediaType = 'video' | 'image'

/** 首页图片轮播默认自动切换间隔（秒） */
export const DEFAULT_HERO_CAROUSEL_INTERVAL = 4

/** 首页系统设置（集合内通常仅一条文档） */
export interface HomeSettingsDTO {
  id: string
  /** 首页顶部轮播模式：'video' 多视频轮播 / 'image' 多图轮播，默认 'video' */
  heroMediaType?: HomeHeroMediaType
  videos: HomeCarouselVideoDTO[]
  /** 首页顶部图片轮播（heroMediaType='image' 时使用，按 sort 排序） */
  heroImages?: MaterialDetailImageDTO[]
  /** 图片轮播自动切换间隔（秒），仅图片模式生效；视频模式忽略 */
  heroCarouselInterval?: number
  /** 首页展示配图（无数量上限，按 sort 排序） */
  images: MaterialDetailImageDTO[]
  /** 启动页全屏视频（云存储 fileID） */
  splashVideo?: string
  /** 启动页跳过倒计时（秒），默认 5 */
  splashSkipSeconds?: number
  /** 是否允许上传时选择视频压缩（关闭则仅原片上传） */
  videoCompressEnabled?: boolean
  /** 上传时默认选中的压缩预设 */
  defaultVideoCompressPreset?: VideoCompressPresetDTO
  /** 联系页 — 门店名称 */
  contactStoreName?: string
  /** 联系页 — 简介 */
  contactSlogan?: string
  /** 联系页 — 地址 */
  contactAddress?: string
  /** 联系页 — 电话 */
  contactPhone?: string
  /** 联系页 — 纬度（导航） */
  contactLatitude?: number
  /** 联系页 — 经度（导航） */
  contactLongitude?: number
  /** 联系页 — 营业时间 */
  contactHours?: string
  /** 联系页 — 微信二维码（云存储 fileID） */
  contactWechatQr?: string
  /** 小红书页 — 二维码 */
  xiaohongshuQr?: string
  /** 小红书页 — 提示文案 */
  xiaohongshuHint?: string
  /** 抖音页 — 二维码 */
  douyinQr?: string
  /** 抖音页 — 提示文案 */
  douyinHint?: string
  /** 首页主营一级分类 ID */
  primaryCategoryId?: string
  updatedAt?: string
}

export interface HomeSettingsSaveParams {
  id?: string
  heroMediaType?: HomeHeroMediaType
  videos: HomeCarouselVideoDTO[]
  heroImages?: MaterialDetailImageDTO[]
  heroCarouselInterval?: number
  images: MaterialDetailImageDTO[]
  splashVideo?: string
  splashSkipSeconds?: number
  videoCompressEnabled?: boolean
  defaultVideoCompressPreset?: VideoCompressPresetDTO
  contactStoreName?: string
  contactSlogan?: string
  contactAddress?: string
  contactPhone?: string
  contactLatitude?: number
  contactLongitude?: number
  contactHours?: string
  contactWechatQr?: string
  xiaohongshuQr?: string
  xiaohongshuHint?: string
  douyinQr?: string
  douyinHint?: string
  primaryCategoryId?: string
}

/** L2 项目 */
export interface ProjectDTO {
  id: string
  categoryId: string
  title: string
  cover: ImageRef
  /** 详情页顶部广告轮播，按 sort 排序；留空时小程序回退展示 cover */
  images?: MaterialDetailImageDTO[]
  desc?: string
  /** 展示价（元），小程序产品页外卖式列表用 */
  price?: number
  sort: number
  published?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProjectSaveParams {
  id?: string
  categoryId: string
  title: string
  cover: ImageRef
  images?: MaterialDetailImageDTO[]
  desc?: string
  price?: number
  sort: number
  published?: boolean
}

/** L3 素材卡片 */
export interface MaterialCardDTO {
  id: string
  projectId: string
  title: string
  cover: ImageRef
  sort: number
  published?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface MaterialCardSaveParams {
  id?: string
  projectId: string
  title: string
  cover: ImageRef
  sort: number
  published?: boolean
}

/**
 * L4 素材详情 — 仅表单字段，无富文本/自定义块
 * 管理端：标题 Input、正文 TextArea、多图 Upload + 拖拽排序
 */
export interface MaterialDetailDTO {
  id: string
  cardId: string
  title: string
  content: string
  images: MaterialDetailImageDTO[]
  sort: number
  createdAt?: string
  updatedAt?: string
}

export interface MaterialDetailSaveParams {
  id?: string
  cardId: string
  title: string
  content: string
  images: MaterialDetailImageDTO[]
  sort: number
}

/** 按 sort 升序排列（用于前端归一化或云函数组装） */
export function sortByOrder<T extends { sort: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sort - b.sort)
}

/** 详情配图按 sort 升序 */
export function sortDetailImages(images: MaterialDetailImageDTO[]): MaterialDetailImageDTO[] {
  return sortByOrder(images)
}
