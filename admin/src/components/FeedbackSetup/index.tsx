import { useLayoutEffect } from 'react'
import { App } from 'antd'
import { registerMessage } from '../../utils/feedback'

/** 挂载 Ant Design message 实例，供 invoke 层统一弹出接口错误 */
export default function FeedbackSetup({ children }: { children: React.ReactNode }) {
  const { message } = App.useApp()

  useLayoutEffect(() => {
    registerMessage(message)
    return () => registerMessage(null)
  }, [message])

  return children
}
