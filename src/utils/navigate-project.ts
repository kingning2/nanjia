import Taro from '@tarojs/taro'
import { getProjectDetail } from '../services/cloud/project-detail'
import { hideNativeLoading, showNativeLoading } from './native-loading'

function buildMaterialDetailUrl(cardId: string, entryId: string) {
  const detailQuery = entryId !== cardId ? `&detailId=${entryId}` : ''
  return `/pages/material-card-detail/index?id=${cardId}${detailQuery}`
}

/** L2 进入项目：仅一个案例时跳过 L3，直达 L4 */
export async function openProject(projectId: string) {
  try {
    showNativeLoading()
    const detail = await getProjectDetail(projectId)
    hideNativeLoading()

    if (detail.cards.length === 1) {
      const card = detail.cards[0]
      await Taro.navigateTo({
        url: buildMaterialDetailUrl(card.cardId, card.id)
      })
      return
    }

    await Taro.navigateTo({ url: `/pages/project-detail/index?id=${projectId}` })
  } catch {
    hideNativeLoading()
    Taro.showToast({ title: '加载失败', icon: 'none' })
  }
}
