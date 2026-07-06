import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Price } from '@nutui/nutui-react-taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import AppEmpty from '../../components/app-empty'
import CatalogSectionHead from '../../components/catalog-section-head'
import CustomHeader, { useCustomHeaderInset } from '../../components/custom-header'
import LazyImage from '../../components/lazy-image'
import PageShell from '../../components/page-shell'
import { MORE_SERVICES_CTA } from '../../constants/home-cta'
import { useCatalogSectionScrollSpy } from '../../hooks/use-catalog-section-scroll-spy'
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

const SCROLL_SELECTOR = '.more-services-page__scroll'

function sectionAnchorId(categoryId: string) {
  return `more-section-${categoryId}`
}

export default function MoreServicesPage() {
  useMiniShare(() => ({ title: MORE_SERVICES_CTA.titleZh }))

  const { params } = useRouter()
  const excludeCategoryId = params.excludeCategoryId || ''
  const headerInset = useCustomHeaderInset()
  const loadingRef = useRef(false)
  const [catalog, setCatalog] = useState<ProductCatalogData>(emptyCatalog)
  const [ready, setReady] = useState(false)

  const categories = useMemo(
    () =>
      sortByOrder(
        catalog.categories.filter((item) => item.id && item.id !== excludeCategoryId)
      ),
    [catalog.categories, excludeCategoryId]
  )

  const sectionIds = useMemo(
    () => categories.map((category) => sectionAnchorId(category.id)),
    [categories]
  )

  const projectsByCategory = useMemo(() => {
    const map = new Map<string, ProductProjectItem[]>()
    for (const category of categories) {
      map.set(
        category.id,
        sortByOrder(catalog.projects.filter((item) => item.categoryId === category.id))
      )
    }
    return map
  }, [catalog.projects, categories])

  const { activeSectionId, handleScroll } = useCatalogSectionScrollSpy({
    sectionIds,
    scrollSelector: SCROLL_SELECTOR,
    headerInset,
    enabled: ready && categories.length > 0
  })

  const activeCategory = useMemo(() => {
    if (!activeSectionId) return categories[0]
    const categoryId = activeSectionId.replace(/^more-section-/, '')
    return categories.find((item) => item.id === categoryId) ?? categories[0]
  }, [activeSectionId, categories])

  const loadCatalog = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    const showOverlay = catalog.categories.length === 0
    if (showOverlay) showNativeLoading()
    try {
      const data = await getProductCatalog()
      setCatalog(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      if (showOverlay) hideNativeLoading()
      loadingRef.current = false
      setReady(true)
    }
  }, [catalog.categories.length])

  useLoadOnFirstShow(() => {
    void loadCatalog()
  })

  const handleOpenProject = useCallback((projectId: string) => {
    void openProject(projectId)
  }, [])

  return (
    <PageShell
      className='catalog-page catalog-page--sticky more-services-page'
      showServiceFab={false}
    >
      <CustomHeader title={MORE_SERVICES_CTA.titleZh} overlay />
      {ready && categories.length === 0 ? (
        <View className='catalog-page__empty'>
          <AppEmpty description='暂无更多服务' />
        </View>
      ) : null}
      {ready && categories.length > 0 ? (
        <>
          <View
            className='more-services-page__head'
            style={{ paddingTop: `${headerInset}px` }}
          >
            {activeCategory ? <CatalogSectionHead category={activeCategory} /> : null}
          </View>
          <ScrollView
            className='catalog-page__scroll more-services-page__scroll'
            scrollY
            enhanced
            showScrollbar={false}
            onScroll={handleScroll}
          >
            {categories.map((category) => {
              const projects = projectsByCategory.get(category.id) || []
              return (
                <View key={category.id} className='catalog-section'>
                  <View id={sectionAnchorId(category.id)} className='catalog-section__anchor' />
                  {projects.length === 0 ? (
                    <View className='catalog-section__empty'>
                      <Text className='catalog-section__empty-text'>该分类暂无业务板块</Text>
                    </View>
                  ) : (
                    <View className='catalog-grid'>
                      {projects.map((item) => (
                        <View
                          key={item.id}
                          className='catalog-card'
                          onClick={() => handleOpenProject(item.id)}
                        >
                          <View className='catalog-card__cover-wrap'>
                            {item.cover ? (
                              <LazyImage
                                src={item.cover}
                                alt={item.title}
                                className='catalog-card__cover'
                                mode='aspectFill'
                                observeRoot={SCROLL_SELECTOR}
                              />
                            ) : (
                              <View className='catalog-card__cover-placeholder'>
                                <Text className='catalog-card__cover-placeholder-text'>配图待更新</Text>
                              </View>
                            )}
                          </View>
                          <View className='catalog-card__body'>
                            <Text className='catalog-card__title'>{item.title}</Text>
                            {item.desc ? (
                              <Text className='catalog-card__desc'>{item.desc}</Text>
                            ) : null}
                            <View className='catalog-card__footer'>
                              {item.price > 0 ? (
                                <Price
                                  className='catalog-card__price'
                                  price={item.price}
                                  size='normal'
                                  digits={item.price % 1 === 0 ? 0 : 2}
                                />
                              ) : (
                                <Text className='catalog-card__desc'>面议</Text>
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
          </ScrollView>
        </>
      ) : null}
    </PageShell>
  )
}
