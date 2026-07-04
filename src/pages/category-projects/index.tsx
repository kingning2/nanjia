import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Loading, Price } from '@nutui/nutui-react-taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import AppEmpty from '../../components/app-empty'
import CatalogSectionHead, { categoryTitleZh } from '../../components/catalog-section-head'
import CustomHeader, { useCustomHeaderInset } from '../../components/custom-header'
import LazyImage from '../../components/lazy-image'
import PageShell from '../../components/page-shell'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getProductCatalog } from '../../services/cloud/product'
import { ProductCatalogData, ProductProjectItem } from '../../types/product'
import './index.scss'

const emptyCatalog: ProductCatalogData = {
  categories: [],
  projects: []
}

const SCROLL_SELECTOR = '.category-projects-page__scroll'

export default function CategoryProjectsPage() {
  const { params } = useRouter()
  const categoryId = params.categoryId || ''
  const headerInset = useCustomHeaderInset()
  const loadingRef = useRef(false)
  const [catalog, setCatalog] = useState<ProductCatalogData>(emptyCatalog)
  const [loading, setLoading] = useState(true)

  const category = useMemo(
    () => catalog.categories.find((item) => item.id === categoryId),
    [catalog.categories, categoryId]
  )

  const projects = useMemo(
    () =>
      sortByOrder(catalog.projects.filter((item) => item.categoryId === categoryId)),
    [catalog.projects, categoryId]
  )

  useMiniShare(() => ({ title: category ? categoryTitleZh(category) : undefined }))

  const loadCatalog = useCallback(async () => {
    if (!categoryId || loadingRef.current) return
    loadingRef.current = true
    const showLoading = catalog.categories.length === 0
    if (showLoading) setLoading(true)
    try {
      const data = await getProductCatalog()
      setCatalog(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [catalog.categories.length, categoryId])

  useDidShow(() => {
    void loadCatalog()
  })

  const openProject = useCallback((projectId: string) => {
    Taro.navigateTo({ url: `/pages/project-detail/index?id=${projectId}` })
  }, [])

  const headerTitle = category ? categoryTitleZh(category) : '业务板块'

  return (
    <PageShell
      className='catalog-page catalog-page--sticky category-projects-page'
      showServiceFab={false}
    >
      <CustomHeader title={headerTitle} overlay />
      {loading ? (
        <View className='catalog-page__loading'>
          <Loading type='circular'>加载中...</Loading>
        </View>
      ) : null}
      {!loading && !category ? (
        <View className='catalog-page__empty'>
          <AppEmpty description='分类不存在或未发布' />
        </View>
      ) : null}
      {!loading && category ? (
        <>
          <View
            className='category-projects-page__head'
            style={{ paddingTop: `${headerInset}px` }}
          >
            <CatalogSectionHead category={category} />
          </View>
          <ScrollView
            className='catalog-page__scroll category-projects-page__scroll'
            scrollY
            enhanced
            showScrollbar={false}
          >
            {projects.length === 0 ? (
              <View className='category-projects-page__empty'>
                <AppEmpty description='该分类暂无业务板块' />
              </View>
            ) : (
              <View className='catalog-grid'>
                {projects.map((item) => (
                  <ProjectCard key={item.id} item={item} onClick={() => openProject(item.id)} />
                ))}
              </View>
            )}
          </ScrollView>
        </>
      ) : null}
    </PageShell>
  )
}

function ProjectCard({
  item,
  onClick
}: {
  item: ProductProjectItem
  onClick: () => void
}) {
  return (
    <View className='catalog-card' onClick={onClick}>
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
        {item.desc ? <Text className='catalog-card__desc'>{item.desc}</Text> : null}
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
  )
}
