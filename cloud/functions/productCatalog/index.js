const { COLLECTIONS, db, mapDocs, publishedWhere, sortBySort } = require('cf-shared/db')
const { fail, makeTraceId, success } = require('cf-shared/response')

function pickNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

/**
 * 产品页：L1 分类 + L2 项目（含价格）
 * @typedef {import('../../../share/types/api').ProductCatalogDTO} ProductCatalogDTO
 */

exports.main = async () => {
  const traceId = makeTraceId()
  try {
    const [categoryRes, projectRes] = await Promise.all([
      db.collection(COLLECTIONS.categories).where(publishedWhere()).orderBy('sort', 'asc').get(),
      db.collection(COLLECTIONS.projects).where(publishedWhere()).orderBy('sort', 'asc').get()
    ])

    const categories = sortBySort(mapDocs(categoryRes.data)).map((item) => ({
      id: item.id,
      name: item.name,
      titleEn: typeof item.titleEn === 'string' ? item.titleEn.trim() : '',
      titleZh: typeof item.titleZh === 'string' ? item.titleZh.trim() : '',
      desc: typeof item.desc === 'string' ? item.desc.trim() : ''
    }))

    const projects = sortBySort(mapDocs(projectRes.data)).map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      title: item.title,
      cover: item.cover || '',
      desc: item.desc || '',
      price: pickNumber(item.price),
      sort: item.sort || 0
    }))

    /** @type {ProductCatalogDTO} */
    const data = {
      categories,
      projects,
      traceId
    }

    return success(data, traceId)
  } catch (err) {
    return fail(err && err.message ? err.message : 'productCatalog failed', traceId, {
      categories: [],
      projects: [],
      traceId
    })
  }
}
