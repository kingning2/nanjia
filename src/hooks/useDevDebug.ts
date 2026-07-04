import { useEffect } from 'react'
import { DevDebugEntry, useDevDebugContext } from '@/components/dev-debug-panel/context'

/** 向全局调试面板注册当前页信息；仅 dev/test 构建下 DevDebugPanel 可见 */
export function useDevDebug(pageId: string, title: string, entries: DevDebugEntry[]) {
  const setSection = useDevDebugContext()?.setSection
  const entriesKey = JSON.stringify(entries)

  useEffect(() => {
    if (!setSection) return
    setSection(pageId, { id: pageId, title, entries })
    return () => setSection(pageId, null)
  }, [setSection, pageId, title, entriesKey])
}
