import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Loading, Price } from '@nutui/nutui-react-taro'
import { useCallback, useRef, useState } from 'react'
import AppEmpty from '../../components/app-empty'
import CustomHeader from '../../components/custom-header'
import LazyImage from '../../components/lazy-image'
import PageShell from '../../components/page-shell'
import { ProjectDetailData } from '../../adapters/project-detail'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getProjectDetail } from '../../services/cloud/project-detail'
import './index.scss'

const emptyDetail: ProjectDetailData = {
  projectId: '',
  projectTitle: '',
  projectCover: '',
  projectDesc: '',
  projectPrice: 0,
  bannerImages: [],
  cards: []
}

export default function ProjectDetailPage() {
  const { params } = useRouter()
  const projectId = params.id || ''
  const loadingRef = useRef(false)
  const [detail, setDetail] = useState<ProjectDetailData>(emptyDetail)
  const [loading, setLoading] = useState(true)

  useMiniShare(() => ({ title: detail.projectTitle || undefined }))

  const loadDetail = useCallback(async () => {
    if (!projectId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const data = await getProjectDetail(projectId)
      setDetail(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [projectId])

  useDidShow(() => {
    void loadDetail()
  })

  const handleCardClick = useCallback((cardId: string, detailId?: string) => {
    const detailQuery = detailId ? `&detailId=${detailId}` : ''
    Taro.navigateTo({ url: `/pages/material-card-detail/index?id=${cardId}${detailQuery}` })
  }, [])

  return (
    <PageShell
      className='project-detail-page'
      showServiceFab={false}
    >
      <CustomHeader title={detail.projectTitle || '套餐详情'} />
      <ScrollView className='project-detail-page__scroll' scrollY enhanced showScrollbar={false}>
        {loading ? (
          <View className='project-detail-page__loading'>
            <Loading type='circular'>加载中...</Loading>
          </View>
        ) : null}
        {!loading && !detail.projectId ? (
          <View className='project-detail-page__empty'>
            <AppEmpty description='套餐不存在或未发布' />
          </View>
        ) : null}
        {!loading && detail.projectId ? (
          <>
            <View className='project-detail-page__info'>
              <Text className='project-detail-page__title'>{detail.projectTitle}</Text>
              {detail.projectDesc ? (
                <Text className='project-detail-page__desc'>{detail.projectDesc}</Text>
              ) : null}
              {detail.projectPrice > 0 ? (
                <Price
                  className='project-detail-page__price'
                  price={detail.projectPrice}
                  size='large'
                  digits={detail.projectPrice % 1 === 0 ? 0 : 2}
                />
              ) : (
                <Text className='project-detail-page__price-note'>价格面议</Text>
              )}
            </View>

            <View className='project-detail-page__divider' />

            <View className='project-detail-page__materials'>
              <Text className='project-detail-page__section-title'>正式素材</Text>
              {detail.cards.length === 0 ? (
                <View className='project-detail-page__materials-empty'>
                  <AppEmpty description='暂无素材卡片' />
                </View>
              ) : (
                <View className='project-detail-page__material-list'>
                  {detail.cards.map((card) => (
                    <View
                      key={card.id}
                      className='project-detail-page__material-card'
                      onClick={() => handleCardClick(card.cardId, card.id)}
                    >
                      <View className='project-detail-page__material-cover-wrap'>
                        {card.cover ? (
                          <LazyImage
                            src={card.cover}
                            alt={card.title}
                            className='project-detail-page__material-image'
                            mode='aspectFill'
                            observeRoot='.project-detail-page__scroll'
                          />
                        ) : (
                          <View className='project-detail-page__material-placeholder'>
                            <Text>配图待更新</Text>
                          </View>
                        )}
                      </View>
                      {card.title ? (
                        <View className='project-detail-page__material-body'>
                          <Text className='project-detail-page__material-title'>{card.title}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </PageShell>
  )
}
