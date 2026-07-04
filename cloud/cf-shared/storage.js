const { cloud } = require('./db')

/**
 * 将 cloud:// fileID 批量解析为临时 HTTPS 播放地址
 * @param {string[]} fileIds
 * @returns {Promise<Record<string, string>>}
 */
async function resolveTempFileUrls(fileIds) {
  const ids = [...new Set((fileIds || []).filter((id) => typeof id === 'string' && id.trim()))]
  if (!ids.length) {
    return {}
  }

  const result = await cloud.getTempFileURL({ fileList: ids })
  const map = {}
  for (const item of result.fileList || []) {
    if (item.status === 0 && item.tempFileURL) {
      map[item.fileID] = item.tempFileURL
    }
  }
  return map
}

module.exports = {
  resolveTempFileUrls
}
