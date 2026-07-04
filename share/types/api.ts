/** 前后端共享的 API 契约类型（DTO），云函数返回与前端请求参数均使用此定义 */

/** 启动页配置（云函数已解析为可播放 URL） */
export interface SplashConfigDTO {
  videoUrl: string
  skipSeconds: number
  traceId?: string
}

/** 联系页配置（云函数已解析微信二维码为可访问 URL） */
export interface ContactConfigDTO {
  storeName: string
  slogan: string
  address: string
  phone: string
  latitude: number
  longitude: number
  hours: string
  wechatQrUrl: string
  traceId?: string
}

export interface SocialPageItemDTO {
  qrUrl: string
  hint: string
}

/** 小红书 / 抖音页配置 */
export interface SocialConfigDTO {
  xiaohongshu: SocialPageItemDTO
  douyin: SocialPageItemDTO
  traceId?: string
}

/** 首页系统设置视频轮播（已解析为可播放 URL） */
export interface PortfolioCarouselVideoDTO {
  videoUrl: string
  sort: number
}

/** 首页展示配图（已解析为可访问 URL） */
export interface PortfolioHomeImageDTO {
  imageUrl: string
  sort: number
}

/** 首页主营 CTA（来自 home_settings.primaryCategoryId + L1 分类） */
export interface PortfolioHomePrimaryCtaDTO {
  categoryId: string
  titleEn: string
  titleZh: string
  desc: string
}

export interface PortfolioHomeDTO {
  /** 首页顶部轮播模式：'video' 多视频 / 'image' 多图，默认 'video' */
  heroMediaType: 'video' | 'image'
  carouselVideos: PortfolioCarouselVideoDTO[]
  /** 首页顶部图片轮播（heroMediaType='image' 时使用） */
  heroImages: PortfolioHomeImageDTO[]
  /** 图片轮播自动切换间隔（秒），仅图片模式生效 */
  heroCarouselInterval: number
  homeImages: PortfolioHomeImageDTO[]
  primaryCta: PortfolioHomePrimaryCtaDTO | null
  traceId?: string
}

/** 项目详情页 — L2 项目 + L3 素材卡片 */
export interface ProjectDetailParams {
  projectId: string
}

export interface ProjectDetailProjectDTO {
  id: string
  title: string
  cover: string
  desc?: string
  price?: number
  /** 详情页顶部广告轮播（已解析为可访问 URL / cloud://） */
  bannerImages: Array<{ imageUrl: string; sort: number }>
}

export interface ProjectDetailCardDTO {
  id: string
  cardId: string
  title: string
  cover: string
}

export interface ProjectDetailDTO {
  project: ProjectDetailProjectDTO | null
  cards: ProjectDetailCardDTO[]
  traceId?: string
}

/** 素材卡片详情 — L3 卡片 + L4 详情列表 */
export interface MaterialCardDetailParams {
  cardId: string
  /** 指定时只返回该条 L4 详情（从项目详情页点某方案进入） */
  detailId?: string
}

export interface MaterialCardDetailCardDTO {
  id: string
  title: string
  cover: string
}

export interface MaterialCardDetailItemDTO {
  id: string
  title: string
  content: string
  images: Array<{ image: string; sort: number }>
  sort: number
}

export interface MaterialCardDetailDTO {
  card: MaterialCardDetailCardDTO | null
  details: MaterialCardDetailItemDTO[]
  traceId?: string
}

/** 产品页 — L1 分类 + L2 项目（含价格） */
export interface ProductCatalogCategoryDTO {
  id: string
  name: string
  titleEn?: string
  titleZh?: string
  desc?: string
}

export interface ProductCatalogProjectDTO {
  id: string
  categoryId: string
  title: string
  cover: string
  desc?: string
  price: number
  sort: number
}

export interface ProductCatalogDTO {
  categories: ProductCatalogCategoryDTO[]
  projects: ProductCatalogProjectDTO[]
  traceId?: string
}
