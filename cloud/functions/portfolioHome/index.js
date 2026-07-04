const { COLLECTIONS, db, mapDocs, sortDetailImages } = require('cf-shared/db')
const { fail, makeTraceId, success } = require('cf-shared/response')

/**
 * 首页：系统设置视频轮播 + 配图 + 主营 CTA
 * ponytail: 小程序 Image/Video 支持 cloud:// 直读，不走 CDN 临时链，避免流量耗尽后 403
 * @typedef {import('../../../share/types/api').PortfolioHomeDTO} PortfolioHomeDTO
 */

async function loadHomeSettingsDoc() {
  const res = await db.collection(COLLECTIONS.homeSettings).limit(20).get()
  const docs = mapDocs(res.data)
  if (!docs.length) return null

  let primaryCategoryId = ''
  for (const doc of docs) {
    const id = typeof doc.primaryCategoryId === 'string' ? doc.primaryCategoryId.trim() : ''
    if (id) {
      primaryCategoryId = id
      break
    }
  }

  const main =
    docs.find(
      (doc) =>
        (doc.videos || []).length > 0 ||
        (doc.heroImages || []).length > 0 ||
        (doc.images || []).length > 0
    ) ||
    docs.find((doc) => doc.splashVideo) ||
    docs[0]

  if (primaryCategoryId && !main.primaryCategoryId) {
    return { ...main, primaryCategoryId }
  }
  return main
}

function resolveCarouselVideos(doc) {
  if (!doc) return []
  const videos = sortDetailImages(doc.videos || doc.banners || [])
  return videos
    .map((item) => {
      const fileId = item.video || item.image || ''
      return {
        videoUrl: fileId,
        sort: item.sort || 0
      }
    })
    .filter((item) => item.videoUrl)
}

function resolveImageList(list) {
  const images = sortDetailImages(list || [])
  return images
    .map((item) => ({
      imageUrl: item.image || '',
      sort: item.sort || 0
    }))
    .filter((item) => item.imageUrl)
}

function resolveHomeImages(doc) {
  if (!doc) return []
  return resolveImageList(doc.images)
}

function resolveHeroImages(doc) {
  if (!doc) return []
  return resolveImageList(doc.heroImages)
}

function resolveHeroMediaType(doc) {
  return doc && doc.heroMediaType === 'image' ? 'image' : 'video'
}

function resolveHeroInterval(doc) {
  const raw = Number(doc && doc.heroCarouselInterval)
  return Number.isFinite(raw) && raw > 0 ? raw : 4
}

function pickText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function resolvePrimaryCta(doc) {
  if (!doc) return null
  const categoryId = pickText(doc.primaryCategoryId)
  if (!categoryId) return null

  const res = await db.collection(COLLECTIONS.categories).doc(categoryId).get()
  const category = mapDocs(res.data ? [res.data] : [])[0]
  if (!category || category.published === false) return null

  const titleZh = pickText(category.titleZh) || pickText(category.name)
  const titleEn = pickText(category.titleEn)
  if (!titleZh && !titleEn) return null

  return {
    categoryId,
    titleEn,
    titleZh,
    desc: pickText(category.desc)
  }
}

exports.main = async () => {
  const traceId = makeTraceId()
  try {
    const homeDoc = await loadHomeSettingsDoc()
    const carouselVideos = resolveCarouselVideos(homeDoc)
    const heroImages = resolveHeroImages(homeDoc)
    const homeImages = resolveHomeImages(homeDoc)
    const primaryCta = await resolvePrimaryCta(homeDoc)

    /** @type {PortfolioHomeDTO} */
    const data = {
      heroMediaType: resolveHeroMediaType(homeDoc),
      carouselVideos,
      heroImages,
      heroCarouselInterval: resolveHeroInterval(homeDoc),
      homeImages,
      primaryCta,
      traceId
    }

    return success(data, traceId)
  } catch (err) {
    return fail(err && err.message ? err.message : 'portfolioHome failed', traceId, {
      heroMediaType: 'video',
      carouselVideos: [],
      heroImages: [],
      heroCarouselInterval: 4,
      homeImages: [],
      primaryCta: null,
      traceId
    })
  }
}
