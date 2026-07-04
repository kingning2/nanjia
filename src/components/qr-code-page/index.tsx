import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import PageShell from '../page-shell'
import RouteTabbar from '../route-tabbar'
import './index.scss'

interface QrCodePageProps {
  className: string
  title: string
  hint: string
  qrSrc: string
}

export default function QrCodePage({ className, title, hint, qrSrc }: QrCodePageProps) {
  const [broken, setBroken] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const placeholder = useMemo(
    () => '请将二维码图片放入对应目录，文件名为 qrcode.jpg',
    []
  )

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

    // 微信：previewImage 最稳的是 wxfile://（用户数据目录）
    // @ts-expect-error - WeChat global
    const wxBase64ToArrayBuffer: ((b64: string) => ArrayBuffer) | undefined = wx?.base64ToArrayBuffer
    if (!wxBase64ToArrayBuffer) return ''

    const buffer = wxBase64ToArrayBuffer(base64)
    const filePath = `${Taro.env.USER_DATA_PATH}/qr-preview-${Date.now()}.${ext}`
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

  const resolvePreviewSrc = useCallback(async () => {
    if (previewSrc) return previewSrc

    // 1) 已经是网络图：直接预览
    if (/^https?:\/\//i.test(qrSrc)) {
      setPreviewSrc(qrSrc)
      return qrSrc
    }

    // 2) base64/dataURL：先落地成 wxfile://
    if (/^data:image\//i.test(qrSrc)) {
      try {
        const localFile = await writeBase64ToLocalFile(qrSrc)
        if (localFile) {
          setPreviewSrc(localFile)
          return localFile
        }
      } catch {
        // continue fallback
      }
    }

    try {
      const info = await Taro.getImageInfo({ src: qrSrc })
      const localPath = info.path || qrSrc
      setPreviewSrc(localPath)
      return localPath
    } catch {
      return qrSrc
    }
  }, [previewSrc, qrSrc, writeBase64ToLocalFile])

  const handlePreview = useCallback(async () => {
    const src = await resolvePreviewSrc()
    Taro.previewImage({
      current: src,
      urls: [src],
      // 微信预览菜单支持“保存到手机”
      showmenu: true
    }).catch(() => {
      Taro.showToast({
        title: '预览失败',
        icon: 'none'
      })
    })
  }, [resolvePreviewSrc])

  return (
    <PageShell className={className}>
      <View className='qr-code-page__content'>
        <Text className='qr-code-page__title'>{title}</Text>
        <Text className='qr-code-page__hint'>{hint}</Text>
        <View className='qr-code-page__card'>
          {broken ? (
            <Text className='qr-code-page__placeholder'>{placeholder}</Text>
          ) : (
            <Image
              className='qr-code-page__image'
              src={qrSrc}
              mode='aspectFit'
              showMenuByLongpress
              onClick={handlePreview}
              onError={() => setBroken(true)}
            />
          )}
        </View>
      </View>
      <RouteTabbar />
    </PageShell>
  )
}
