import { ProductCatalogDTO } from '@share/types/api'
import { adaptProductCatalog } from '../../adapters/product'
import { ProductCatalogData } from '../../types/product'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const productCatalogFunctionName = 'productCatalog'
const cacheKey = 'productCatalog'

export async function getProductCatalog(): Promise<ProductCatalogData> {
  return getCachedOrFetch(cacheKey, async () => {
    const response = await callCloudFunction<ProductCatalogDTO, Record<string, never>>(
      productCatalogFunctionName,
      {}
    )
    return adaptProductCatalog(response.data)
  })
}
