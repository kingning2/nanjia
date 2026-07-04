import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Loading } from '@nutui/nutui-react-taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { sortByOrder, sortDetailImages } from '@share/types/content'
import AppEmpty from '../../components/app-empty'
import CustomHeader from '../../components/custom-header'
import LazyImage from '../../components/lazy-image'
import PageShell from '../../components/page-shell'
import { getMaterialCardDetail } from '../../services/cloud/material-card'
import { useMiniShare } from '../../hooks/useMiniShare'
import { MaterialCardDetailData } from '../../types/product'
import { previewProtectedImages } from '../../utils/preview-image'
import './index.scss'

const emptyDetail: MaterialCardDetailData = {
  cardId: '',
  cardTitle: '',
  cardCover: '',
  details: []
}

export default function MaterialCardDetailPage() {
  const { params } = useRouter()
  const cardId = params.id || ''
  const detailId = params.detailId || ''
  const loadingRef = useRef(false)
  const [detail, setDetail] = useState<MaterialCardDetailData>(emptyDetail)
  const [loading, setLoading] = useState(true)

  const sortedDetails = useMemo(() => sortByOrder(detail.details), [detail.details])
  const pageTitle = sortedDetails[0]?.title || detail.cardTitle || '方案详情'

  useMiniShare(() => ({ title: pageTitle || undefined }))

  const loadDetail = useCallback(async () => {
    if (!cardId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const data = await getMaterialCardDetail(cardId, detailId || undefined)
      setDetail(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [cardId, detailId])

  useDidShow(() => {
    void loadDetail()
  })

  const handleImagePreview = useCallback((urls: string[], index: number) => {
    void previewProtectedImages(urls, index, 'material-detail')
  }, [])

  return (
    <PageShell
      className='material-card-detail-page'
      showServiceFab={false}
    >
      <CustomHeader title={pageTitle} />
      <ScrollView
        className='material-card-detail-page__scroll'
        scrollY
        enhanced
        showScrollbar={false}
      >
        <View className='material-card-detail-page__inner'>
          {loading ? (
            <View className='material-card-detail-page__loading'>
              <Loading type='circular'>加载中...</Loading>
            </View>
          ) : null}
          {!loading && !detail.cardId ? (
            <View className='material-card-detail-page__empty'>
              <AppEmpty description='方案不存在或未发布' />
            </View>
          ) : null}
          {!loading && sortedDetails.length === 0 && detail.cardId ? (
            <View className='material-card-detail-page__empty'>
              <AppEmpty description='暂无详情内容' />
            </View>
          ) : null}
          {!loading
            ? sortedDetails.map((item) => {
                const images = sortDetailImages(item.images)
                return (
                  <View key={item.id} className='material-card-detail-page__block'>
                    <Text className='material-card-detail-page__title'>{item.title}</Text>
                    {item.content ? (
                      <Text className='material-card-detail-page__content'>{item.content}</Text>
                    ) : null}
                    {images.length > 0 ? (
                      <View className='material-card-detail-page__image'>
                        {images.map((image, imageIndex) => (
                          <View
                            key={`${item.id}-${image.sort}-${image.image}`}
                            className='material-card-detail-page__image-item'
                            onClick={() =>
                              handleImagePreview(
                                images.map((entry) => entry.image),
                                imageIndex
                              )
                            }
                          >
                            <LazyImage
                              src={image.image}
                              className='material-card-detail-page__image-photo'
                              mode='widthFix'
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                )
              })
            : null}
        </View>
      </ScrollView>
    </PageShell>
  )
}
