import { Image, Map, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { adaptContactConfig } from '@/adapters/contact'
import { ContactConfigDTO } from '@share/types/api'
import CustomHeader from '../../components/custom-header'
import PageShell from '../../components/page-shell'
import { useLoadOnFirstShow } from '../../hooks/useLoadOnFirstShow'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getContactConfig } from '../../services/cloud/contact'
import { hideNativeLoading, showNativeLoading } from '../../utils/native-loading'
import { ContactConfig } from '../../types/contact'
import './index.scss'

const defaultContact = adaptContactConfig({
  storeName: '南嘉婚礼策划工作室',
  slogan: '用心记录每一场独一无二的婚礼',
  address: '',
  phone: '',
  latitude: 0,
  longitude: 0,
  hours: '周一至周日 10:00 - 20:00',
  wechatQrUrl: ''
} satisfies ContactConfigDTO)

export default function ContactPage() {
  useMiniShare()

  const loadingRef = useRef(false)
  const [contact, setContact] = useState<ContactConfig>(defaultContact)
  const [previewSrc, setPreviewSrc] = useState('')
  const qrPlaceholder = useMemo(
    () => '请在管理端「系统设置 → 联系页」上传微信二维码',
    []
  )
  const hasLocation = contact.latitude !== 0 && contact.longitude !== 0
  const hasQr = Boolean(contact.wechatQrUrl)

  const loadContact = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    showNativeLoading()
    try {
      const data = await getContactConfig()
      setContact(data)
      setPreviewSrc('')
    } catch {
      Taro.showToast({ title: '联系信息加载失败', icon: 'none' })
    } finally {
      loadingRef.current = false
      hideNativeLoading()
    }
  }, [])

  useLoadOnFirstShow(() => {
    void loadContact()
  })

  const writeBase64ToLocalFile = useCallback(async (dataUrl: string) => {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
    if (!match) return ''

    const mime = match[1]
    const base64 = match[2]
    const ext =
      mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/jpeg' || mime === 'image/jpg'
            ? 'jpg'
            : 'img'

    // @ts-expect-error - WeChat global
    const wxBase64ToArrayBuffer: ((b64: string) => ArrayBuffer) | undefined = wx?.base64ToArrayBuffer
    if (!wxBase64ToArrayBuffer) return ''

    const buffer = wxBase64ToArrayBuffer(base64)
    const filePath = `${Taro.env.USER_DATA_PATH}/qr-preview-wechat-${Date.now()}.${ext}`
    const fsm = Taro.getFileSystemManager()

    await new Promise<void>((resolve, reject) => {
      fsm.writeFile({
        filePath,
        data: buffer,
        success: () => resolve(),
        fail: () => reject(new Error('writeFile failed'))
      })
    })

    return filePath
  }, [])

  const resolvePreviewSrc = useCallback(
    async (src: string) => {
      if (previewSrc) return previewSrc

      if (/^https?:\/\//i.test(src)) {
        setPreviewSrc(src)
        return src
      }

      if (/^data:image\//i.test(src)) {
        try {
          const localFile = await writeBase64ToLocalFile(src)
          if (localFile) {
            setPreviewSrc(localFile)
            return localFile
          }
        } catch {
          // continue fallback
        }
      }

      try {
        const info = await Taro.getImageInfo({ src })
        const localPath = info.path || src
        setPreviewSrc(localPath)
        return localPath
      } catch {
        return src
      }
    },
    [previewSrc, writeBase64ToLocalFile]
  )

  const handlePreviewQr = useCallback(async () => {
    if (!contact.wechatQrUrl) return
    const src = await resolvePreviewSrc(contact.wechatQrUrl)
    Taro.previewImage({
      current: src,
      urls: [src],
      showmenu: true
    }).catch(() => {
      Taro.showToast({ title: '预览失败', icon: 'none' })
    })
  }, [contact.wechatQrUrl, resolvePreviewSrc])

  const handleOpenLocation = useCallback(() => {
    if (!hasLocation) {
      if (!contact.address) {
        Taro.showToast({ title: '暂未配置门店位置', icon: 'none' })
        return
      }
      void Taro.setClipboardData({ data: contact.address }).then(() => {
        Taro.showToast({ title: '地址已复制', icon: 'success' })
      })
      return
    }

    Taro.openLocation({
      latitude: contact.latitude,
      longitude: contact.longitude,
      name: contact.storeName,
      address: contact.address || contact.storeName,
      scale: 16
    })
  }, [contact, hasLocation])

  const handleCall = useCallback(() => {
    if (!contact.phone) {
      Taro.showToast({ title: '暂未配置联系电话', icon: 'none' })
      return
    }

    Taro.makePhoneCall({ phoneNumber: contact.phone })
  }, [contact.phone])

  return (
    <PageShell className='contact-page' showServiceFab={false}>
      <CustomHeader title='联系' showBack compact />
      <ScrollView className='contact-page__scroll' scrollY enhanced showScrollbar={false}>
        <View className='contact-page__inner'>
          <View className='contact-page__intro'>
            <Text className='contact-page__name'>{contact.storeName}</Text>
            <Text className='contact-page__slogan'>{contact.slogan}</Text>
          </View>

          {hasLocation ? (
            <View className='contact-page__card contact-page__card--map' onClick={handleOpenLocation}>
              <Text className='contact-page__card-title'>门店位置</Text>
              <Map
                className='contact-page__map'
                latitude={contact.latitude}
                longitude={contact.longitude}
                scale={16}
                enableScroll={false}
                enableZoom={false}
              />
              <Text className='contact-page__map-hint'>点击地图打开微信导航</Text>
            </View>
          ) : null}

          <View className='contact-page__card'>
            <Text className='contact-page__card-title'>门店信息</Text>
            <View className='contact-page__row' onClick={handleOpenLocation}>
              <Text className='contact-page__label'>地址</Text>
              <Text className='contact-page__value'>
                {contact.address || (hasLocation ? '已配置坐标，点击导航' : '暂未配置')}
              </Text>
              {contact.address || hasLocation ? (
                <Text className='contact-page__action'>
                  {hasLocation ? '导航' : '复制'}
                </Text>
              ) : null}
            </View>
            <View className='contact-page__row' onClick={handleCall}>
              <Text className='contact-page__label'>电话</Text>
              <Text className='contact-page__value'>
                {contact.phone || '暂未配置'}
              </Text>
              {contact.phone ? <Text className='contact-page__action'>拨打</Text> : null}
            </View>
            <View className='contact-page__row contact-page__row--plain'>
              <Text className='contact-page__label'>营业时间</Text>
              <Text className='contact-page__value'>{contact.hours}</Text>
            </View>
          </View>

          <View className='contact-page__card contact-page__card--qr'>
            <Text className='contact-page__card-title'>微信添加</Text>
            <Text className='contact-page__hint'>长按识别二维码，添加微信好友</Text>
            <View className='contact-page__qr-wrap'>
              {hasQr ? (
                <Image
                  className='contact-page__qr'
                  src={contact.wechatQrUrl}
                  mode='aspectFit'
                  showMenuByLongpress
                  onClick={handlePreviewQr}
                />
              ) : (
                <Text className='contact-page__qr-placeholder'>{qrPlaceholder}</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </PageShell>
  )
}
