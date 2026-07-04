import { ContactConfigDTO } from '@share/types/api'
import { adaptContactConfig } from '../../adapters/contact'
import { ContactConfig } from '../../types/contact'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const contactConfigFunctionName = 'contactConfig'
const contactConfigTimeout = 8000
const cacheKey = 'contactConfig:v2'

export async function getContactConfig(): Promise<ContactConfig> {
  return getCachedOrFetch(cacheKey, async () => {
    const response = await callCloudFunction<ContactConfigDTO, Record<string, never>>(
      contactConfigFunctionName,
      {},
      contactConfigTimeout
    )
    return adaptContactConfig(response.data)
  })
}
