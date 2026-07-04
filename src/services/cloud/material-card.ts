import { MaterialCardDetailDTO, MaterialCardDetailParams } from '@share/types/api'
import { adaptMaterialCardDetail } from '../../adapters/product'
import { MaterialCardDetailData } from '../../types/product'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const materialCardDetailFunctionName = 'materialCardDetail'

export async function getMaterialCardDetail(
  cardId: string,
  detailId?: string
): Promise<MaterialCardDetailData> {
  const cacheKey = detailId
    ? `materialCardDetail:${cardId}:${detailId}`
    : `materialCardDetail:${cardId}`
  return getCachedOrFetch(cacheKey, async () => {
    const response = await callCloudFunction<MaterialCardDetailDTO, MaterialCardDetailParams>(
      materialCardDetailFunctionName,
      detailId ? { cardId, detailId } : { cardId }
    )
    return adaptMaterialCardDetail(response.data)
  })
}
