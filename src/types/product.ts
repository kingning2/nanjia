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

export interface MaterialDetailItem {
  id: string
  title: string
  content: string
  images: Array<{ image: string; sort: number }>
  sort: number
}

export interface MaterialCardDetailData {
  cardId: string
  cardTitle: string
  cardCover: string
  details: MaterialDetailItem[]
  traceId?: string
}
