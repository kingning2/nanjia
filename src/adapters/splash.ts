import { SplashConfigDTO } from '@share/types/api'
import { SplashConfig } from '../types/splash'

export function adaptSplashConfig(response: SplashConfigDTO): SplashConfig {
  return {
    videoUrl: response.videoUrl?.trim() || '',
    skipSeconds: response.skipSeconds > 0 ? response.skipSeconds : 5
  }
}
