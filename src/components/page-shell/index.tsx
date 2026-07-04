import { View } from '@tarojs/components'
import { PropsWithChildren } from 'react'
import DevDebugFab from '../dev-debug-fab'
import ServiceFab from '../service-fab'

type PageShellProps = PropsWithChildren<{
  className?: string
  /** 默认展示；启动页传 false */
  showServiceFab?: boolean
}>

/** 页面根容器：全局客服浮球 + 调试浮球（仅 dev/test） */
export default function PageShell({
  className = '',
  children,
  showServiceFab = true,
}: PageShellProps) {
  return (
    <View className={className ? `page-shell ${className}` : 'page-shell'}>
      {children}
      {showServiceFab ? <ServiceFab /> : null}
      <DevDebugFab />
    </View>
  )
}
