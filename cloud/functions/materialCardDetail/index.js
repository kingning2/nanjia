const {
  COLLECTIONS,
  db,
  mapDoc,
  mapDocs,
  sortBySort,
  sortDetailImages
} = require('cf-shared/db')
const { fail, makeTraceId, success, emptyWithTrace } = require('cf-shared/response')

/**
 * 素材卡片详情：L3 卡片信息 + L4 详情列表
 * @typedef {import('../../../share/types/api').MaterialCardDetailParams} MaterialCardDetailParams
 * @typedef {import('../../../share/types/api').MaterialCardDetailDTO} MaterialCardDetailDTO
 */

exports.main = async (event) => {
  const traceId = makeTraceId()
  try {
    const { cardId, detailId } = event || {}
    if (!cardId) {
      return fail('缺少 cardId', traceId, emptyWithTrace(traceId, { card: null, details: [] }))
    }

    const cardRes = await db.collection(COLLECTIONS.materialCards).doc(cardId).get()
    const cardDoc = mapDoc(cardRes.data)
    if (!cardDoc || cardDoc.published === false) {
      return fail('素材卡片不存在或未发布', traceId, emptyWithTrace(traceId, { card: null, details: [] }))
    }

    const mapDetail = (item) => ({
      id: item.id,
      title: item.title,
      content: item.content || '',
      images: sortDetailImages(item.images).map((image) => ({
        image: image.image,
        sort: image.sort
      })),
      sort: item.sort || 0
    })

    let details = []
    if (detailId) {
      const detailRes = await db.collection(COLLECTIONS.materialDetails).doc(detailId).get()
      const detailDoc = mapDoc(detailRes.data)
      if (!detailDoc || detailDoc.cardId !== cardId) {
        return fail('详情不存在', traceId, emptyWithTrace(traceId, { card: null, details: [] }))
      }
      details = [mapDetail(detailDoc)]
    } else {
      const detailsRes = await db
        .collection(COLLECTIONS.materialDetails)
        .where({ cardId })
        .orderBy('sort', 'asc')
        .get()
      details = sortBySort(mapDocs(detailsRes.data)).map(mapDetail)
    }

    /** @type {MaterialCardDetailDTO} */
    const data = {
      card: {
        id: cardDoc.id,
        title: cardDoc.title,
        cover: cardDoc.cover || ''
      },
      details,
      traceId
    }

    return success(data, traceId)
  } catch (err) {
    return fail(
      err && err.message ? err.message : 'materialCardDetail failed',
      traceId,
      emptyWithTrace(traceId, { card: null, details: [] })
    )
  }
}
