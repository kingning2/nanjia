import { SocialConfigDTO } from '@share/types/api'
import { SocialConfig } from '../types/social'

const defaultXhsHint = '长按识别二维码，关注我们的小红书'
const defaultDouyinHint = '长按识别二维码，关注我们的抖音'

export function adaptSocialConfig(response: SocialConfigDTO): SocialConfig {
  return {
    xiaohongshu: {
      qrUrl: response.xiaohongshu?.qrUrl?.trim() || '',
      hint: response.xiaohongshu?.hint?.trim() || defaultXhsHint
    },
    douyin: {
      qrUrl: response.douyin?.qrUrl?.trim() || '',
      hint: response.douyin?.hint?.trim() || defaultDouyinHint
    }
  }
}
