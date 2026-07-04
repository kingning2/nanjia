import { SocialConfigDTO } from '@share/types/api'
import { adaptSocialConfig } from '../../adapters/social'
import { SocialConfig } from '../../types/social'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const socialConfigFunctionName = 'socialConfig'
const socialConfigTimeout = 8000
const cacheKey = 'socialConfig:v2'

export async function getSocialConfig(): Promise<SocialConfig> {
  return getCachedOrFetch(cacheKey, async () => {
    const response = await callCloudFunction<SocialConfigDTO, Record<string, never>>(
      socialConfigFunctionName,
      {},
      socialConfigTimeout
    )
    return adaptSocialConfig(response.data)
  })
}
