export interface ProductCategoryItem {
  id: string
  name: string
  titleEn: string
  titleZh: string
  desc: string
}

export interface ProductProjectItem {
  id: string
  categoryId: string
  title: string
  cover: string
  desc: string
  price: number
  sort: number
}

export interface ProductCatalogData {
  categories: ProductCategoryItem[]
  projects: ProductProjectItem[]
  traceId?: string
}

export interface MaterialDetailMediaItem {
  type: 'image' | 'video'
  src: string
  sort: number
}

export interface MaterialDetailItem {
  id: string
  title: string
  content: string
  media: MaterialDetailMediaItem[]
  sort: number
}

export interface MaterialCardDetailData {
  cardId: string
  cardTitle: string
  cardCover: string
  details: MaterialDetailItem[]
  traceId?: string
}
