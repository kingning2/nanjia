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
  publishedWhere
}
