export interface TabItem {
  id: string
  name: string
}

export interface CarouselVideoItem {
  videoUrl: string
  sort: number
}

export interface HomeImageItem {
  imageUrl: string
  sort: number
}

export interface ProjectCardItem {
  id: string
  cardId: string
  title: string
  cover: string
  desc: string
  tags: string[]
  link?: string
}

export interface PaginationState {
  pageNo: number
  pageSize: number
  total: number
  hasMore: boolean
}

export interface HomePrimaryCta {
  categoryId: string
  titleEn: string
  titleZh: string
  desc: string
}

export type HomeHeroMediaType = 'video' | 'image'

export interface PortfolioHomeData {
  heroMediaType: HomeHeroMediaType
  carouselVideos: CarouselVideoItem[]
  heroImages: HomeImageItem[]
  /** 图片轮播自动切换间隔（秒），仅图片模式生效 */
  heroCarouselInterval: number
  homeImages: HomeImageItem[]
  primaryCta: HomePrimaryCta | null
  traceId?: string
}
