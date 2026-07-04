import { PortfolioHomeDTO } from '@share/types/api'
import { adaptPortfolioHome } from '../../adapters/project'
import { PortfolioHomeData } from '../../types/project'
import { getCachedOrFetch } from '../../store/api-cache'
import { callCloudFunction } from './call'

const portfolioHomeFunctionName = 'portfolioHome'
const cacheKey = 'portfolioHome:v6'

export type PortfolioHomeFetchResult = {
  data: PortfolioHomeData
  raw: PortfolioHomeDTO
  traceId?: string
  message: string
}

export async function getPortfolioHome(): Promise<PortfolioHomeFetchResult> {
  return getCachedOrFetch(cacheKey, async () => {
    const response = await callCloudFunction<PortfolioHomeDTO, Record<string, never>>(
      portfolioHomeFunctionName,
      {}
    )
    return {
      raw: response.data,
      data: adaptPortfolioHome(response.data),
      traceId: response.traceId || response.data?.traceId,
      message: response.message
    }
  })
}
