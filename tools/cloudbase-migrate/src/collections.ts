/** 已知业务集合（ListCollections 失败时回退） */
export const FALLBACK_COLLECTIONS = [
  'categories',
  'projects',
  'material_cards',
  'material_details',
  'home_settings',
  'media_files'
] as const
