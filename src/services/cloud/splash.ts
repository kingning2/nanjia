import { adaptSplashConfig } from '../../adapters/splash'
import { SplashConfigDTO } from '@share/types/api'
import { SplashConfig } from '../../types/splash'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const splashConfigFunctionName = 'splashConfig'
const splashConfigTimeout = 6000
const cacheKey = 'splashConfig:v2'

export async function getSplashConfig(): Promise<SplashConfig> {
  return getCachedOrFetch(cacheKey, async () => {
    const response = await callCloudFunction<SplashConfigDTO, Record<string, never>>(
      splashConfigFunctionName,
      {},
      splashConfigTimeout
    )
    return adaptSplashConfig(response.data)
  })
}
