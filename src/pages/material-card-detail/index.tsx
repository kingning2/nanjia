import { ScrollView, Text, Video, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { sortByOrder, sortDetailMedia } from '@share/types/content'
import AppEmpty from '../../components/app-empty'
import CustomHeader from '../../components/custom-header'
import LazyImage from '../../components/lazy-image'
import PageShell from '../../components/page-shell'
import { useLoadOnFirstShow } from '../../hooks/useLoadOnFirstShow'
import { getMaterialCardDetail } from '../../services/cloud/material-card'
import { useMiniShare } from '../../hooks/useMiniShare'
import { MaterialCardDetailData } from '../../types/product'
import { hideNativeLoading, showNativeLoading } from '../../utils/native-loading'
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
  const [ready, setReady] = useState(false)

  const sortedDetails = useMemo(() => sortByOrder(detail.details), [detail.details])
  const pageTitle = sortedDetails[0]?.title || detail.cardTitle || '方案详情'

  useMiniShare(() => ({ title: pageTitle || undefined }))

  const loadDetail = useCallback(async () => {
    if (!cardId || loadingRef.current) return
    loadingRef.current = true
    const showOverlay = !detail.cardId
    if (showOverlay) showNativeLoading()
    try {
      const data = await getMaterialCardDetail(cardId, detailId || undefined)
      setDetail(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      if (showOverlay) hideNativeLoading()
      loadingRef.current = false
      setReady(true)
    }
  }, [cardId, detail.cardId, detailId])

  useLoadOnFirstShow(() => {
    void loadDetail()
  }, `${cardId}:${detailId}`)

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
          {ready && !detail.cardId ? (
            <View className='material-card-detail-page__empty'>
              <AppEmpty description='方案不存在或未发布' />
            </View>
          ) : null}
          {ready && sortedDetails.length === 0 && detail.cardId ? (
            <View className='material-card-detail-page__empty'>
              <AppEmpty description='暂无详情内容' />
            </View>
          ) : null}
          {ready
            ? sortedDetails.map((item) => {
                const media = sortDetailMedia(item.media)
                const imageUrls = media
                  .filter((entry) => entry.type === 'image')
                  .map((entry) => entry.src)
                return (
                  <View key={item.id} className='material-card-detail-page__block'>
                    {item.content ? (
                      <Text className='material-card-detail-page__content'>{item.content}</Text>
                    ) : null}
                    {media.map((entry) =>
                      entry.type === 'video' ? (
                        <View
                          key={`${item.id}-video-${entry.sort}-${entry.src}`}
                          className='material-card-detail-page__video'
                        >
                          <Video
                            className='material-card-detail-page__video-player'
                            src={entry.src}
                            controls
                            showCenterPlayBtn
                            objectFit='contain'
                            enableProgressGesture
                          />
                        </View>
                      ) : (
                        <View
                          key={`${item.id}-image-${entry.sort}-${entry.src}`}
                          className='material-card-detail-page__image'
                        >
                          <View
                            className='material-card-detail-page__image-item'
                            onClick={() =>
                              handleImagePreview(
                                imageUrls,
                                imageUrls.indexOf(entry.src)
                              )
                            }
                          >
                            <LazyImage
                              src={entry.src}
                              className='material-card-detail-page__image-photo'
                              mode='widthFix'
                            />
                          </View>
                        </View>
                      )
                    )}
                  </View>
                )
              })
            : null}
        </View>
      </ScrollView>
    </PageShell>
  )
}
