import { invokeApi } from '../tauri'
import type {
  CategoryDTO,
  CategorySaveParams,
  HomeSettingsDTO,
  HomeSettingsSaveParams,
  MaterialCardDTO,
  MaterialCardSaveParams,
  MaterialDetailDTO,
  MaterialDetailSaveParams,
  ProjectDTO,
  ProjectSaveParams
} from '@share/types/content'

/** 内容 CRUD — Tauri invoke → CloudBase 云数据库 */

export function listCategories(): Promise<CategoryDTO[]> {
  return invokeApi<CategoryDTO[]>('list_categories', undefined, '加载分类失败')
}

export function saveCategory(params: CategorySaveParams): Promise<CategoryDTO> {
  return invokeApi<CategoryDTO>('save_category', { params }, '保存分类失败')
}

export function deleteCategory(id: string): Promise<void> {
  return invokeApi('delete_category', { id }, '删除分类失败')
}

export function getCategory(id: string): Promise<CategoryDTO | undefined> {
  return invokeApi<CategoryDTO | null>('get_category', { id }, '加载分类信息失败').then(
    (item) => item ?? undefined
  )
}

export function listProjects(categoryId: string): Promise<ProjectDTO[]> {
  return invokeApi<ProjectDTO[]>('list_projects', { categoryId }, '加载项目失败')
}

export function saveProject(params: ProjectSaveParams): Promise<ProjectDTO> {
  return invokeApi<ProjectDTO>('save_project', { params }, '保存项目失败')
}

export function deleteProject(id: string): Promise<void> {
  return invokeApi('delete_project', { id }, '删除项目失败')
}

export function getProject(id: string): Promise<ProjectDTO | undefined> {
  return invokeApi<ProjectDTO | null>('get_project', { id }, '加载项目信息失败').then(
    (item) => item ?? undefined
  )
}

export function listMaterialCards(projectId: string): Promise<MaterialCardDTO[]> {
  return invokeApi<MaterialCardDTO[]>(
    'list_material_cards',
    { projectId },
    '加载素材卡片失败'
  )
}

export function saveMaterialCard(params: MaterialCardSaveParams): Promise<MaterialCardDTO> {
  return invokeApi<MaterialCardDTO>('save_material_card', { params }, '保存素材卡片失败')
}

export function deleteMaterialCard(id: string): Promise<void> {
  return invokeApi('delete_material_card', { id }, '删除素材卡片失败')
}

export function getMaterialCard(id: string): Promise<MaterialCardDTO | undefined> {
  return invokeApi<MaterialCardDTO | null>(
    'get_material_card',
    { id },
    '加载素材卡片信息失败'
  ).then((item) => item ?? undefined)
}

export function listMaterialDetails(cardId: string): Promise<MaterialDetailDTO[]> {
  return invokeApi<MaterialDetailDTO[]>(
    'list_material_details',
    { cardId },
    '加载素材详情失败'
  )
}

export function saveMaterialDetail(params: MaterialDetailSaveParams): Promise<MaterialDetailDTO> {
  return invokeApi<MaterialDetailDTO>('save_material_detail', { params }, '保存素材详情失败')
}

export function deleteMaterialDetail(id: string): Promise<void> {
  return invokeApi('delete_material_detail', { id }, '删除素材详情失败')
}

export function getMaterialDetail(id: string): Promise<MaterialDetailDTO | undefined> {
  return invokeApi<MaterialDetailDTO | null>(
    'get_material_detail',
    { id },
    '加载素材详情信息失败'
  ).then((item) => item ?? undefined)
}

export function getHomeSettings(): Promise<HomeSettingsDTO> {
  return invokeApi('get_home_settings', undefined, '加载系统设置失败')
}

export function saveHomeSettings(params: HomeSettingsSaveParams): Promise<HomeSettingsDTO> {
  return invokeApi('save_home_settings', { params }, '保存系统设置失败')
}

/** 确保云数据库集合存在；分类为空时导入种子数据 */
export function ensureDatabase(): Promise<boolean> {
  return invokeApi<boolean>('ensure_database', undefined, '数据库初始化失败')
}
