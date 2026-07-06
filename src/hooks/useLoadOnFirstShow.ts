import { useDidShow } from '@tarojs/taro'
import { useEffect, useRef } from 'react'

/**
 * 仅在页面首次显示时加载数据，避免从子页返回或关闭图片预览时重复刷新。
 * resetKey 变化时（如路由 id 变更）会重新允许加载。
 */
export function useLoadOnFirstShow(load: () => void | Promise<void>, resetKey?: string) {
  const loadedRef = useRef(false)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    loadedRef.current = false
  }, [resetKey])

  useDidShow(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void loadRef.current()
  })
}
