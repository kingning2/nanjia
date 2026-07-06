import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import { adaptSocialConfig } from '@/adapters/social'
import { SocialConfigDTO } from '@share/types/api'
import CustomHeader from '../../components/custom-header'
import PageShell from '../../components/page-shell'
import RouteTabbar from '../../components/route-tabbar'
import { useLoadOnFirstShow } from '../../hooks/useLoadOnFirstShow'
import { getSocialConfig } from '../../services/cloud/social'
import { useMiniShare } from '../../hooks/useMiniShare'
import { SocialPageConfig } from '../../types/social'
import { hideNativeLoading, showNativeLoading } from '../../utils/native-loading'
import { previewCloudImage } from '../../utils/preview-image'
import './index.scss'

const defaultPage = adaptSocialConfig({
  xiaohongshu: { qrUrl: '', hint: '长按识别二维码，关注我们的小红书' },
  douyin: { qrUrl: '', hint: '长按识别二维码，关注我们的抖音' }
} satisfies SocialConfigDTO).douyin

export default function DouyinPage() {
  useMiniShare()

  const loadingRef = useRef(false)
  const [page, setPage] = useState<SocialPageConfig>(defaultPage)

  const loadPage = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    showNativeLoading()
    try {
      const data = await getSocialConfig()
      setPage(data.douyin)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      loadingRef.current = false
      hideNativeLoading()
    }
  }, [])

  useLoadOnFirstShow(() => {
    void loadPage()
  })

  const handlePreview = useCallback(async () => {
    if (!page.qrUrl) return
    previewCloudImage(page.qrUrl, 'qr-preview-douyin').catch(() => {
      Taro.showToast({ title: '预览失败', icon: 'none' })
    })
  }, [page.qrUrl])

  return (
    <PageShell className='douyin-page'>
      <CustomHeader title='抖音' showBack={false} compact />
      <View className='qr-code-page__content'>
        <Text className='qr-code-page__hint'>{page.hint}</Text>
        <View className='qr-code-page__card'>
          {page.qrUrl ? (
            <Image
              className='qr-code-page__image'
              src={page.qrUrl}
              mode='widthFix'
              showMenuByLongpress
              onClick={handlePreview}
            />
          ) : (
            <Text className='qr-code-page__placeholder'>
              请在管理端「系统设置 → 社交页」上传抖音二维码
            </Text>
          )}
        </View>
      </View>
      <RouteTabbar />
    </PageShell>
  )
}
