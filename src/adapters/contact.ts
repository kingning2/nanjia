import { ContactConfigDTO } from '@share/types/api'
import { ContactConfig } from '../types/contact'

export function adaptContactConfig(response: ContactConfigDTO): ContactConfig {
  return {
    storeName: response.storeName?.trim() || '南嘉婚礼策划工作室',
    slogan: response.slogan?.trim() || '用心记录每一场独一无二的婚礼',
    address: response.address?.trim() || '',
    phone: response.phone?.trim() || '',
    latitude: Number.isFinite(response.latitude) ? response.latitude : 0,
    longitude: Number.isFinite(response.longitude) ? response.longitude : 0,
    hours: response.hours?.trim() || '周一至周日 10:00 - 20:00',
    wechatQrUrl: response.wechatQrUrl?.trim() || ''
  }
}
