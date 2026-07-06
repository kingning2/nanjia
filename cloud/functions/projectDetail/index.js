const { COLLECTIONS, db, mapDoc, mapDocs, publishedWhere, sortBySort, sortDetailImages, normalizeDetailMedia } = require('cf-shared/db')
const { fail, makeTraceId, success, emptyWithTrace } = require('cf-shared/response')

/**
 * 项目详情页：L2 项目信息 + L3 素材卡片列表
 * @typedef {import('../../../share/types/api').ProjectDetailParams} ProjectDetailParams
 * @typedef {import('../../../share/types/api').ProjectDetailDTO} ProjectDetailDTO
 */

function resolveBannerImages(doc) {
  const cover = doc.cover || ''
  const images = sortDetailImages(doc.images || [])
    .map((item) => ({
      imageUrl: item.image || '',
      sort: item.sort || 0
    }))
    .filter((item) => item.imageUrl)
  if (images.length) return images
  return cover ? [{ imageUrl: cover, sort: 0 }] : []
}

exports.main = async (event) => {
  const traceId = makeTraceId()
  try {
    const { projectId } = event || {}
    if (!projectId) {
      return fail('缺少 projectId', traceId, emptyWithTrace(traceId, { project: null, cards: [] }))
    }

    const projectRes = await db.collection(COLLECTIONS.projects).doc(projectId).get()
    const projectDoc = mapDoc(projectRes.data)
    if (!projectDoc || projectDoc.published === false) {
      return fail('项目不存在或未发布', traceId, emptyWithTrace(traceId, { project: null, cards: [] }))
    }

    const cardsRes = await db
      .collection(COLLECTIONS.materialCards)
      .where(publishedWhere({ projectId }))
      .orderBy('sort', 'asc')
      .get()

    const cardDocs = sortBySort(mapDocs(cardsRes.data))
    const cardDetailEntries = await Promise.all(
      cardDocs.map(async (card) => {
        const detailRes = await db
          .collection(COLLECTIONS.materialDetails)
          .where({ cardId: card.id })
          .orderBy('sort', 'asc')
          .get()
        const details = sortBySort(mapDocs(detailRes.data))
        if (details.length === 0) {
          return [
            {
              id: card.id,
              cardId: card.id,
              title: card.title,
              cover: card.cover || ''
            }
          ]
        }
        return details.map((detail) => ({
          id: detail.id,
          cardId: card.id,
          title: detail.title || card.title,
          cover:
            normalizeDetailMedia(detail).find((item) => item.type === 'image')?.src ||
            card.cover ||
            ''
        }))
      })
    )
    const cards = cardDetailEntries.flat()
    let bannerImages = resolveBannerImages(projectDoc)
    if (!bannerImages.length) {
      const fallbackCover = cards.map((item) => item.cover).find(Boolean)
      if (fallbackCover) {
        bannerImages = [{ imageUrl: fallbackCover, sort: 0 }]
      }
    }
    const projectCover = projectDoc.cover || cards.map((item) => item.cover).find(Boolean) || ''

    /** @type {ProjectDetailDTO} */
    const data = {
      project: {
        id: projectDoc.id,
        title: projectDoc.title,
        cover: projectCover,
        desc: projectDoc.desc || '',
        price: Number(projectDoc.price) || 0,
        bannerImages
      },
      cards,
      traceId
    }

    return success(data, traceId)
  } catch (err) {
    return fail(err && err.message ? err.message : 'projectDetail failed', traceId, emptyWithTrace(traceId, { project: null, cards: [] }))
  }
}
