import Taro from '@tarojs/taro'
import { CloudFunctionResponse } from '@share/types/response'
import { CloudErrorShape } from '../../types/cloud'
import { pushDevError, pushDevResponse } from '../../utils/dev-error-sink'
import { ensureCloudInit, getCloudEnvId } from './init'

declare const wx: any

const defaultTimeout = 30000

const parseCloudError = (error: unknown): string => {
  if (!error) return '云函数调用失败'
  const cloudError = error as CloudErrorShape
  return cloudError.message || cloudError.errMsg || '云函数调用失败'
}

export async function callCloudFunction<TData, TPayload = Record<string, unknown>>(
  name: string,
  data: TPayload,
  timeout = defaultTimeout
): Promise<CloudFunctionResponse<TData>> {
  await ensureCloudInit()

  const cloud = Taro.cloud || (typeof wx !== 'undefined' ? wx.cloud : undefined)
  const env = getCloudEnvId()

  if (!cloud) {
    throw new Error('当前环境不支持云函数调用')
  }

  if (!env) {
    throw new Error('缺少云环境 ID，请在 .env 中配置 TARO_APP_CLOUD_ENV_ID')
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('云函数请求超时')), timeout)
  })

  const requestPromise = cloud.callFunction({
    name,
    data,
    config: {
      env
    }
  }) as Promise<{ result: CloudFunctionResponse<TData> }>

  try {
    const { result } = await Promise.race([requestPromise, timeoutPromise])
    if (!result) {
      throw new Error('云函数响应为空')
    }
    if (result.code !== 0) {
      const message = result.message || '云函数业务异常'
      pushDevError(name, message)
      pushDevResponse(name, result)
      throw new Error(message)
    }
    pushDevResponse(name, result)
    return result
  } catch (error) {
    const message = parseCloudError(error)
    pushDevError(name, message)
    throw new Error(message)
  }
}
