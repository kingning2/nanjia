import type { VideoCompressPresetDTO } from '@share/types/upload'

export interface VideoCompressPresetOption {
  value: VideoCompressPresetDTO
  label: string
  description: string
}

export const VIDEO_COMPRESS_PRESET_OPTIONS: VideoCompressPresetOption[] = [
  {
    value: 'standard',
    label: '标准',
    description: 'CRF 24 · medium，画质与体积平衡（推荐）'
  },
  {
    value: 'high',
    label: '高清',
    description: 'CRF 23 · slow，画质优先'
  },
  {
    value: 'fast',
    label: '极速',
    description: 'CRF 26 · fast，编码更快、体积更小'
  }
]

export function normalizeVideoCompressPreset(
  value?: string | null
): VideoCompressPresetDTO {
  if (value === 'high' || value === 'fast') return value
  return 'standard'
}
