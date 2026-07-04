import {
  ProductCatalogDTO,
  ProductCatalogCategoryDTO,
  ProductCatalogProjectDTO,
  MaterialCardDetailDTO
} from '@share/types/api'
import {
  ProductCatalogData,
  ProductCategoryItem,
  ProductProjectItem,
  MaterialCardDetailData,
  MaterialDetailItem
} from '../types/product'

const normalizeCategory = (item: ProductCatalogCategoryDTO): ProductCategoryItem => ({
  id: item.id,
  name: item.name,
  titleEn: item.titleEn?.trim() || '',
  titleZh: item.titleZh?.trim() || '',
  desc: item.desc?.trim() || ''
})

const normalizeProject = (item: ProductCatalogProjectDTO): ProductProjectItem => ({
  id: item.id,
  categoryId: item.categoryId,
  title: item.title,
  cover: item.cover,
  desc: item.desc?.trim() || '',
  price: Number.isFinite(item.price) ? item.price : 0,
  sort: item.sort
})

export const adaptProductCatalog = (response: ProductCatalogDTO): ProductCatalogData => ({
  categories: (response.categories || []).map(normalizeCategory),
  projects: (response.projects || []).map(normalizeProject),
  traceId: response.traceId
})

const normalizeDetail = (item: MaterialCardDetailDTO['details'][number]): MaterialDetailItem => ({
  id: item.id,
  title: item.title,
  content: item.content || '',
  images: item.images || [],
  sort: item.sort
})

export const adaptMaterialCardDetail = (
  response: MaterialCardDetailDTO
): MaterialCardDetailData => ({
  cardId: response.card?.id || '',
  cardTitle: response.card?.title || '',
  cardCover: response.card?.cover || '',
  details: (response.details || []).map(normalizeDetail),
  traceId: response.traceId
})
