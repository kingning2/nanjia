import { ProjectDetailDTO } from '@share/types/api'
import { sortByOrder } from '@share/types/content'
import { ProjectCardItem } from '../types/project'

export interface ProjectDetailData {
  projectId: string
  projectTitle: string
  projectCover: string
  projectDesc: string
  projectPrice: number
  bannerImages: string[]
  cards: ProjectCardItem[]
  traceId?: string
}

export const adaptProjectDetail = (response: ProjectDetailDTO): ProjectDetailData => {
  const project = response.project
  const cards = (response.cards || []).map((card) => ({
    id: card.id,
    cardId: card.cardId || card.id,
    title: card.title,
    cover: card.cover?.trim() || '',
    desc: '',
    tags: []
  }))
  const fromBanners = sortByOrder(project?.bannerImages || [])
    .map((item) => item.imageUrl?.trim() || '')
    .filter(Boolean)
  const cover = project?.cover?.trim() || ''
  const cardCover = cards.map((item) => item.cover).find(Boolean) || ''
  const bannerImages =
    fromBanners.length > 0 ? fromBanners : cover ? [cover] : cardCover ? [cardCover] : []

  return {
    projectId: project?.id || '',
    projectTitle: project?.title || '',
    projectCover: cover || cardCover,
    projectDesc: project?.desc || '',
    projectPrice: Number.isFinite(project?.price) ? Number(project?.price) : 0,
    bannerImages,
    cards,
    traceId: response.traceId
  }
}
