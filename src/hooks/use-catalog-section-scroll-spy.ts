import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

const SECTION_REMEASURE_MS = 120
const STICKY_SCROLL_OFFSET = 4

type UseCatalogSectionScrollSpyOptions = {
  sectionIds: string[]
  scrollSelector: string
  headerInset: number
  scrollPaddingTop?: number
  enabled: boolean
}

/** 多分类列表：根据滚动位置切换当前分类，不在滚动中改 ScrollView 子节点 */
export function useCatalogSectionScrollSpy({
  sectionIds,
  scrollSelector,
  headerInset,
  scrollPaddingTop = 0,
  enabled
}: UseCatalogSectionScrollSpyOptions) {
  const sectionIdsKey = sectionIds.join('|')
  const sectionIdsRef = useRef(sectionIds)
  sectionIdsRef.current = sectionIds

  const sectionOffsetsRef = useRef<Record<string, number>>({})
  const activeSectionRef = useRef('')
  const [activeSectionId, setActiveSectionId] = useState('')
  const stickInset = Math.max(0, headerInset - scrollPaddingTop)

  const remeasureSections = useCallback(() => {
    const ids = sectionIdsRef.current
    if (!enabled || !ids.length) return
    Taro.nextTick(() => {
      setTimeout(() => {
        const query = Taro.createSelectorQuery()
        ids.forEach((id) => {
          query.select(`#${id}`).boundingClientRect()
        })
        query.select(scrollSelector).scrollOffset()
        query.select(scrollSelector).boundingClientRect()
        query.exec((res) => {
          const scrollOffset = res?.[ids.length] as { scrollTop: number } | null
          const scrollRect = res?.[ids.length + 1] as { top: number } | null
          if (!scrollOffset || !scrollRect) return

          const offsets: Record<string, number> = {}
          ids.forEach((id, index) => {
            const rect = res?.[index] as { top: number } | null
            if (rect) {
              offsets[id] = scrollOffset.scrollTop + rect.top - scrollRect.top
            }
          })
          sectionOffsetsRef.current = offsets
        })
      }, SECTION_REMEASURE_MS)
    })
  }, [enabled, scrollSelector, sectionIdsKey])

  const syncActiveSection = useCallback(
    (scrollTop: number) => {
      const ids = sectionIdsRef.current
      if (!enabled || !ids.length) return

      const stickLine = scrollTop + stickInset + STICKY_SCROLL_OFFSET
      const offsets = sectionOffsetsRef.current

      let nextId = ids[0]
      for (let index = ids.length - 1; index >= 0; index -= 1) {
        const id = ids[index]
        const top = offsets[id]
        if (top !== undefined && stickLine >= top) {
          nextId = id
          break
        }
      }

      if (nextId !== activeSectionRef.current) {
        activeSectionRef.current = nextId
        setActiveSectionId(nextId)
      }
    },
    [enabled, stickInset, sectionIdsKey]
  )

  const handleScroll = useCallback(
    (event: { detail: { scrollTop: number } }) => {
      syncActiveSection(event.detail.scrollTop)
    },
    [syncActiveSection]
  )

  useEffect(() => {
    if (!enabled || !sectionIds.length) {
      activeSectionRef.current = ''
      setActiveSectionId('')
      return
    }
    activeSectionRef.current = sectionIds[0]
    setActiveSectionId(sectionIds[0])
    remeasureSections()
  }, [enabled, remeasureSections, sectionIds, sectionIdsKey])

  return { activeSectionId, handleScroll, remeasureSections }
}
