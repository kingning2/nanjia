import { ProjectDetailDTO, ProjectDetailParams } from '@share/types/api'
import { adaptProjectDetail, ProjectDetailData } from '../../adapters/project-detail'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const projectDetailFunctionName = 'projectDetail'

export async function getProjectDetail(projectId: string): Promise<ProjectDetailData> {
  return getCachedOrFetch(`projectDetail:v2:${projectId}`, async () => {
    const response = await callCloudFunction<ProjectDetailDTO, ProjectDetailParams>(
      projectDetailFunctionName,
      { projectId }
    )
    return adaptProjectDetail(response.data)
  })
}
