/** 云函数统一响应结构，前后端必须保持一致 */
export interface CloudFunctionResponse<TData = unknown> {
  code: number
  message: string
  data: TData
  traceId?: string
}
