import { invokeApi } from '../tauri'
import type {
  EnvBillingDTO,
  EnvProfileDTO,
  MediaCleanupResultDTO,
  MediaRedundancyReportDTO,
  MigrateEnvParams,
  MigrateEnvResultDTO
} from '@share/types/sync'

export function listEnvProfiles(): Promise<EnvProfileDTO[]> {
  return invokeApi<EnvProfileDTO[]>('list_env_profiles', undefined, '读取环境列表失败')
}

export function setActiveEnvProfile(id: string): Promise<EnvProfileDTO> {
  return invokeApi<EnvProfileDTO>('set_active_env_profile', { id }, '切换环境失败')
}

export function syncEnvProfilesFromFiles(): Promise<EnvProfileDTO[]> {
  return invokeApi<EnvProfileDTO[]>('sync_env_profiles_from_files', undefined, '同步环境文件失败')
}

export function getEnvBillingInfo(): Promise<EnvBillingDTO> {
  return invokeApi<EnvBillingDTO>('get_env_billing_info', undefined, '查询套餐信息失败')
}

export function migrateEnv(params: MigrateEnvParams): Promise<MigrateEnvResultDTO> {
  return invokeApi<MigrateEnvResultDTO>('migrate_env', { params }, '环境迁移失败')
}

export function analyzeMediaRedundancy(profileId: string): Promise<MediaRedundancyReportDTO> {
  return invokeApi<MediaRedundancyReportDTO>(
    'analyze_media_redundancy',
    { profileId },
    '媒体冗余分析失败'
  )
}

export function deleteUnusedMedia(profileId: string): Promise<MediaCleanupResultDTO> {
  return invokeApi<MediaCleanupResultDTO>(
    'delete_unused_media',
    { profileId },
    '删除未使用媒体失败'
  )
}
