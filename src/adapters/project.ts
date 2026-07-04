import {
  PortfolioHomeDTO,
  PortfolioCarouselVideoDTO,
  PortfolioHomeImageDTO,
  PortfolioHomePrimaryCtaDTO
} from '@share/types/api'
import {
  PortfolioHomeData,
  CarouselVideoItem,
  HomeImageItem,
  HomePrimaryCta
} from '../types/project'

const normalizeCarouselVideo = (item: PortfolioCarouselVideoDTO): CarouselVideoItem => ({
  videoUrl: item.videoUrl,
  sort: item.sort
})

const normalizeHomeImage = (item: PortfolioHomeImageDTO): HomeImageItem => ({
  imageUrl: item.imageUrl,
  sort: item.sort
})

const normalizePrimaryCta = (
  item: PortfolioHomePrimaryCtaDTO | null | undefined
): HomePrimaryCta | null => {
  if (!item?.categoryId?.trim()) return null
  return {
    categoryId: item.categoryId,
    titleEn: item.titleEn?.trim() || '',
    titleZh: item.titleZh?.trim() || '',
    desc: item.desc?.trim() || ''
  }
}

export const adaptPortfolioHome = (
  response: PortfolioHomeDTO
): PortfolioHomeData => ({
  heroMediaType: response.heroMediaType === 'image' ? 'image' : 'video',
  carouselVideos: (response.carouselVideos || []).map(normalizeCarouselVideo),
  heroImages: (response.heroImages || []).map(normalizeHomeImage),
  heroCarouselInterval:
    Number.isFinite(response.heroCarouselInterval) && response.heroCarouselInterval > 0
      ? response.heroCarouselInterval
      : 4,
  homeImages: (response.homeImages || []).map(normalizeHomeImage),
  primaryCta: normalizePrimaryCta(response.primaryCta),
  traceId: response.traceId
})
