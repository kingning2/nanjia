const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/** 与 share/types/database.ts 保持一致 */
const COLLECTIONS = {
  categories: 'categories',
  projects: 'projects',
  materialCards: 'material_cards',
  materialDetails: 'material_details',
  homeSettings: 'home_settings'
}

function mapDoc(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return {
    id: _id,
    ...rest
  }
}

function mapDocs(list) {
  return (list || []).map(mapDoc).filter(Boolean)
}

function sortBySort(list) {
  return [...(list || [])].sort((a, b) => (a.sort || 0) - (b.sort || 0))
}

function sortDetailImages(images) {
  return sortBySort(images || [])
}

function sortDetailMedia(media) {
  return sortBySort(media || [])
}

function normalizeDetailMedia(doc) {
  const saved = (doc.media || [])
    .filter(
      (item) =>
        item &&
        (item.type === 'image' || item.type === 'video') &&
        typeof item.src === 'string' &&
        item.src.trim()
    )
    .map((item) => ({
      type: item.type,
      src: item.src.trim(),
      sort: item.sort || 0
    }))

  if (saved.length > 0) {
    return sortDetailMedia(saved)
  }

  const images = sortDetailImages(doc.images)
  const video = typeof doc.video === 'string' ? doc.video.trim() : ''
  const legacy = []

  if (video) {
    legacy.push({ type: 'video', src: video, sort: 0 })
    images.forEach((item, index) => {
      legacy.push({ type: 'image', src: item.image, sort: index + 1 })
    })
  } else {
    images.forEach((item) => {
      legacy.push({ type: 'image', src: item.image, sort: item.sort || 0 })
    })
  }

  return sortDetailMedia(legacy)
}

/** 小程序只展示已发布内容（published 缺省视为 true） */
function publishedWhere(extra = {}) {
  return {
    ...extra,
    published: true
  }
}

module.exports = {
  cloud,
  db,
  COLLECTIONS,
  mapDoc,
  mapDocs,
  sortBySort,
  sortDetailImages,
  sortDetailMedia,
  normalizeDetailMedia,
  publishedWhere
}
