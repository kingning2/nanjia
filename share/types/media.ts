/** 云数据库 media_files 集合记录 */

export interface MediaFileDTO {
  id: string
  fileID: string
  cloudPath: string
  downloadUrl?: string
  originalName: string
  mimeType: string
  createdAt: string
}

export interface MediaFileListDTO {
  list: MediaFileDTO[]
}

export {
  CATEGORIES_COLLECTION,
  MATERIAL_CARDS_COLLECTION,
  MATERIAL_DETAILS_COLLECTION,
  MEDIA_FILES_COLLECTION,
  PROJECTS_COLLECTION
} from './database'
