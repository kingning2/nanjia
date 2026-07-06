import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Price, SearchBar } from '@nutui/nutui-react-taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import AppEmpty from '../../components/app-empty'
import CustomHeader from '../../components/custom-header'
import LazyImage from '../../components/lazy-image'
import PageShell from '../../components/page-shell'
import RouteTabbar from '../../components/route-tabbar'
import { useLoadOnFirstShow } from '../../hooks/useLoadOnFirstShow'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getProductCatalog } from '../../services/cloud/product'
import { ProductCatalogData, ProductProjectItem } from '../../types/product'
import { openProject } from '../../utils/navigate-project'
import { hideNativeLoading, showNativeLoading } from '../../utils/native-loading'
import './index.scss'

const emptyCatalog: ProductCatalogData = {
  categories: [],
  projects: []
}

const SCROLL_SPY_OFFSET = 48
const TAB_CLICK_LOCK_MS = 450
const SCROLL_REMEASURE_DEBOUNCE_MS = 120

function matchKeyword(item: ProductProjectItem, keyword: string) {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return (
    item.title.toLowerCase().includes(text) ||
    item.desc.toLowerCase().includes(text)
  )
}

function sectionId(categoryId: string) {
  return `section-${categoryId}`
}

export default function ProductsPage() {
  useMiniShare()

  const { params } = useRouter()
  const loadingRef = useRef(false)
  const tabClickLockRef = useRef(false)
  const sectionOffsetsRef = useRef<Record<string, number>>({})
  const remeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deepLinkHandledRef = useRef(false)
  const [catalog, setCatalog] = useState<ProductCatalogData>(emptyCatalog)
  const [ready, setReady] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [scrollIntoView, setScrollIntoView] = useState('')
  const [tabScrollIntoView, setTabScrollIntoView] = useState('')

  const loadCatalog = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    showNativeLoading()
    try {
      const data = await getProductCatalog()
      setCatalog(data)
      const preferred = params.categoryId || ''
      const firstId = data.categories[0]?.id || ''
      setActiveCategoryId((current) => {
        if (preferred && data.categories.some((item) => item.id === preferred)) {
          return preferred
        }
        if (current && data.categories.some((item) => item.id === current)) {
          return current
        }
        return firstId
      })
    } catch {
      Taro.showToast({ title: '产品加载失败', icon: 'none' })
    } finally {
      loadingRef.current = false
      hideNativeLoading()
      setReady(true)
    }
  }, [params.categoryId])

  useLoadOnFirstShow(() => {
    void loadCatalog()
  })

  const handleOpenProject = useCallback((projectId: string) => {
    void openProject(projectId)
  }, [])

  const projectsByCategory = useMemo(() => {
    const map = new Map<string, ProductProjectItem[]>()
    for (const category of catalog.categories) {
      const list = sortByOrder(
        catalog.projects.filter((item) => item.categoryId === category.id)
      ).filter((item) => matchKeyword(item, keyword))
      map.set(category.id, list)
    }
    return map
  }, [catalog.categories, catalog.projects, keyword])

  const visibleCategories = useMemo(() => {
    const trimmed = keyword.trim()
    if (!trimmed) return catalog.categories
    return catalog.categories.filter(
      (category) => (projectsByCategory.get(category.id) || []).length > 0
    )
  }, [catalog.categories, keyword, projectsByCategory])

  const remeasureSections = useCallback(() => {
    if (!visibleCategories.length) return
    Taro.nextTick(() => {
      setTimeout(() => {
        const query = Taro.createSelectorQuery()
        visibleCategories.forEach((category) => {
          query.select(`#${sectionId(category.id)}`).boundingClientRect()
        })
        query.select('.product-page__scroll').scrollOffset()
        query.select('.product-page__scroll').boundingClientRect()
        query.exec((res) => {
          const count = visibleCategories.length
          const scrollOffset = res?.[count] as { scrollTop: number } | null
          const scrollRect = res?.[count + 1] as { top: number } | null
          if (!scrollOffset || !scrollRect) return
          const offsets: Record<string, number> = {}
          visibleCategories.forEach((category, index) => {
            const rect = res?.[index] as { top: number } | null
            if (rect) {
              offsets[category.id] = scrollOffset.scrollTop + rect.top - scrollRect.top
            }
          })
          sectionOffsetsRef.current = offsets
        })
      }, 80)
    })
  }, [visibleCategories])

  const scheduleRemeasure = useCallback(() => {
    if (remeasureTimerRef.current) {
      clearTimeout(remeasureTimerRef.current)
    }
    remeasureTimerRef.current = setTimeout(() => {
      remeasureTimerRef.current = null
      remeasureSections()
    }, SCROLL_REMEASURE_DEBOUNCE_MS)
  }, [remeasureSections])

  useEffect(() => {
    return () => {
      if (remeasureTimerRef.current) {
        clearTimeout(remeasureTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!visibleCategories.length) {
      setActiveCategoryId('')
      return
    }
    setActiveCategoryId((current) => {
      if (current && visibleCategories.some((item) => item.id === current)) {
        return current
      }
      return visibleCategories[0].id
    })
    remeasureSections()
  }, [ready, visibleCategories, remeasureSections])

  const syncActiveTabScroll = useCallback((categoryId: string) => {
    if (!categoryId) return
    setTabScrollIntoView(`tab-${categoryId}`)
    setTimeout(() => setTabScrollIntoView(''), TAB_CLICK_LOCK_MS)
  }, [])

  const handleTabChange = useCallback(
    (id: string) => {
      tabClickLockRef.current = true
      setActiveCategoryId(id)
      syncActiveTabScroll(id)
      setScrollIntoView(sectionId(id))
      setTimeout(() => {
        setScrollIntoView('')
        tabClickLockRef.current = false
        remeasureSections()
      }, TAB_CLICK_LOCK_MS)
    },
    [remeasureSections, syncActiveTabScroll]
  )

  useEffect(() => {
    if (!ready || deepLinkHandledRef.current || !params.categoryId) return
    const targetId = params.categoryId
    if (!catalog.categories.some((item) => item.id === targetId)) return
    deepLinkHandledRef.current = true
    tabClickLockRef.current = true
    setActiveCategoryId(targetId)
    syncActiveTabScroll(targetId)
    remeasureSections()
    setTimeout(() => {
      setScrollIntoView(sectionId(targetId))
      setTimeout(() => {
        setScrollIntoView('')
        tabClickLockRef.current = false
      }, TAB_CLICK_LOCK_MS)
    }, 120)
  }, [ready, catalog.categories, params.categoryId, remeasureSections, syncActiveTabScroll])

  const handleScroll = useCallback(
    (event: { detail: { scrollTop: number } }) => {
      scheduleRemeasure()
      if (tabClickLockRef.current || !visibleCategories.length) return
      const scrollTop = event.detail.scrollTop
      const offsets = sectionOffsetsRef.current
      let nextId = visibleCategories[0].id
      for (let index = visibleCategories.length - 1; index >= 0; index -= 1) {
        const category = visibleCategories[index]
        const top = offsets[category.id]
        if (top !== undefined && scrollTop + SCROLL_SPY_OFFSET >= top) {
          nextId = category.id
          break
        }
      }
      setActiveCategoryId((current) => {
        if (current === nextId) return current
        syncActiveTabScroll(nextId)
        return nextId
      })
    },
    [scheduleRemeasure, syncActiveTabScroll, visibleCategories]
  )

  return (
    <PageShell className='product-page'>
      <CustomHeader title='产品' showBack={false} compact />
      <View className='product-page__search'>
        <SearchBar
          value={keyword}
          placeholder='搜索套餐名称'
          shape='round'
          inputProps={{
            placeholderStyle: 'color: #c9bfb3',
          }}
          onChange={(value) => setKeyword(String(value))}
          onClear={() => setKeyword('')}
        />
      </View>

      {!ready ? null : catalog.categories.length === 0 ? (
        <View className='product-page__empty'>
          <AppEmpty description='暂无分类' />
        </View>
      ) : visibleCategories.length === 0 ? (
        <View className='product-page__empty'>
          <AppEmpty description='没有匹配的套餐' />
        </View>
      ) : (
        <>
          <View className='product-page__tabs'>
            <ScrollView
              className='product-page__tabs-scroll'
              scrollX
              enhanced
              showScrollbar={false}
              scrollWithAnimation
              scrollIntoView={tabScrollIntoView}
            >
              <View className='product-page__tabs-inner'>
                {visibleCategories.map((category) => (
                  <View
                    key={category.id}
                    id={`tab-${category.id}`}
                    className={`product-page__tab${
                      activeCategoryId === category.id ? ' product-page__tab--active' : ''
                    }`}
                    onClick={() => handleTabChange(category.id)}
                  >
                    <Text className='product-page__tab-text'>{category.name}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <ScrollView
            className='product-page__scroll'
            scrollY
            enhanced
            showScrollbar={false}
            scrollWithAnimation
            scrollIntoView={scrollIntoView}
            onScroll={handleScroll}
          >
            {visibleCategories.map((category) => {
              const projects = projectsByCategory.get(category.id) || []
              return (
                <View key={category.id} className='product-section'>
                  <View
                    id={sectionId(category.id)}
                    className='product-section__anchor'
                  />
                  <Text className='product-section__title'>{category.name}</Text>
                  {projects.length === 0 ? (
                    <View className='product-section__empty'>
                      <Text className='product-section__empty-text'>该分类暂无套餐</Text>
                    </View>
                  ) : (
                    <View className='product-grid'>
                      {projects.map((item) => (
                        <View
                          key={item.id}
                          className='product-card'
                          onClick={() => handleOpenProject(item.id)}
                        >
                          <View className='product-card__cover-wrap'>
                            {item.cover ? (
                              <LazyImage
                                src={item.cover}
                                alt={item.title}
                                className='product-card__cover'
                                mode='aspectFill'
                                observeRoot='.product-page__scroll'
                              />
                            ) : (
                              <View className='product-card__cover-placeholder'>
                                <Text className='product-card__cover-placeholder-text'>配图待更新</Text>
                              </View>
                            )}
                          </View>
                          <View className='product-card__body'>
                            <Text className='product-card__title'>{item.title}</Text>
                            {item.desc ? (
                              <Text className='product-card__desc'>{item.desc}</Text>
                            ) : null}
                            <View className='product-card__footer'>
                              {item.price > 0 ? (
                                <Price
                                  className='product-card__price'
                                  price={item.price}
                                  size='normal'
                                  digits={item.price % 1 === 0 ? 0 : 2}
                                />
                              ) : (
                                <Text className='product-card__desc'>面议</Text>
                              )}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
            <View className='product-page__scroll-tail' />
          </ScrollView>
        </>
      )}

      <RouteTabbar />
    </PageShell>
  )
}
