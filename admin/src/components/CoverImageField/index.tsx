import { ArrowRightOutlined, CloseOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Image, Space, Spin, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { UPLOAD_WEBP_MAX_BYTES } from '@share/types/upload'
import { useDeferredUploadOptional, useDeferredUploadTask } from '../DeferredUpload/context'
import { uploadWebpBytes, validateImageFile } from '../../services/cloud/upload'
import { deleteStorageFile, resolveStorageUrl } from '../../services/cloud/storage'
import { formatFileSize } from '../../utils/feedback'
import {
  compressImageFile,
  revokePendingImage,
  type PendingImageCompress
} from '../../utils/imageCompressPending'
import CloudImage from '../CloudImage'
import styles from './index.module.css'

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp'
const WEBP_MAX_LABEL = formatFileSize(UPLOAD_WEBP_MAX_BYTES)

interface CoverImageFieldProps {
  value?: string
  onChange?: (value: string) => void
  uploadPrefix?: string
}

function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return '—'
  return `${width} × ${height}`
}

function ImageMeta({
  width,
  height,
  size
}: {
  width?: number
  height?: number
  size?: number
}) {
  return (
    <div className={styles.meta}>
      <Typography.Text type='secondary' style={{ fontSize: 12 }}>
        尺寸：{formatDimensions(width, height)}
      </Typography.Text>
      {size !== undefined ? (
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
          体积：{formatFileSize(size)}
        </Typography.Text>
      ) : null}
    </div>
  )
}

function PreviewPanelImage({
  src,
  alt,
  onDimensions
}: {
  src: string
  alt: string
  onDimensions?: (width: number, height: number) => void
}) {
  useEffect(() => {
    if (!onDimensions) return
    const img = new window.Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        onDimensions(img.naturalWidth, img.naturalHeight)
      }
    }
    img.src = src
  }, [onDimensions, src])

  return (
    <div className={styles.panelImageWrap}>
      <Image src={src} alt={alt} className={styles.panelImage} preview={{ mask: '预览' }} />
    </div>
  )
}

function ExistingCoverPane({ fileId }: { fileId: string }) {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    setDims(null)

    void resolveStorageUrl(fileId).then((url) => {
      const img = new window.Image()
      img.onload = () => {
        if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
          setDims({ width: img.naturalWidth, height: img.naturalHeight })
        }
      }
      img.onerror = () => {
        if (!cancelled) setDims(null)
      }
      img.src = url
    })

    return () => {
      cancelled = true
    }
  }, [fileId])

  return (
    <div className={styles.coverPane}>
      <Typography.Text className={styles.paneTitle}>当前封面</Typography.Text>
      <div className={styles.panelImageWrap}>
        <CloudImage
          src={fileId}
          alt='当前封面'
          className={styles.panelImage}
          width='100%'
          height={136}
          style={{ objectFit: 'contain' }}
          preview={{ mask: '预览' }}
          fallbackLabel='加载失败'
        />
      </div>
      <ImageMeta width={dims?.width} height={dims?.height} />
    </div>
  )
}

function StripArrow() {
  return (
    <div className={styles.arrow} aria-hidden>
      <ArrowRightOutlined />
    </div>
  )
}

export default function CoverImageField({
  value,
  onChange,
  uploadPrefix = 'projects/uploads'
}: CoverImageFieldProps) {
  const { message } = App.useApp()
  const deferCtx = useDeferredUploadOptional()
  const [compressing, setCompressing] = useState(false)
  const [pending, setPending] = useState<PendingImageCompress | null>(null)
  const pendingRef = useRef<PendingImageCompress | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const revokePending = useCallback((item: PendingImageCompress | null) => {
    revokePendingImage(item)
  }, [])

  const clearPending = useCallback(() => {
    setPending((prev) => {
      revokePending(prev)
      pendingRef.current = null
      return null
    })
  }, [revokePending])

  const setPendingItem = useCallback((item: PendingImageCompress | null) => {
    pendingRef.current = item
    setPending(item)
  }, [])

  const handlePickFile = useCallback(
    async (file: File) => {
      const error = validateImageFile(file)
      if (error) {
        message.error(error)
        return Upload.LIST_IGNORE
      }

      setCompressing(true)
      clearPending()

      try {
        setPendingItem(await compressImageFile(file))
      } catch {
        // previewImageCompress 已提示错误
      } finally {
        setCompressing(false)
      }

      return Upload.LIST_IGNORE
    },
    [clearPending, message, setPendingItem]
  )

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    void handlePickFile(file)
    return Upload.LIST_IGNORE
  }

  const flushUpload = useCallback(async (): Promise<boolean> => {
    const item = pendingRef.current
    if (!item) return true

    const previousFileId = valueRef.current?.trim()
    try {
      const result = await uploadWebpBytes(item.webpBytes, item.file.name, uploadPrefix)
      if (previousFileId && previousFileId !== result.fileID) {
        try {
          await deleteStorageFile(previousFileId)
        } catch {
          message.warning('新封面已上传，但旧文件未能从云存储删除，请在媒体库中手动清理')
        }
      }
      onChange?.(result.fileID)
      clearPending()
      return true
    } catch {
      return false
    }
  }, [clearPending, message, onChange, uploadPrefix])

  useDeferredUploadTask(
    flushUpload,
    () => pendingRef.current !== null,
    !!deferCtx
  )

  useEffect(() => {
    return () => revokePending(pendingRef.current)
  }, [revokePending])

  const pendingFooter = deferCtx ? (
    <Space style={{ marginTop: 8 }} wrap>
      <Typography.Text type='secondary' style={{ fontSize: 12 }}>
        点击表单「确定」时上传
      </Typography.Text>
      <Button size='small' icon={<CloseOutlined />} onClick={clearPending}>
        取消
      </Button>
    </Space>
  ) : null

  const replaceUploadSlot = (
    <div className={styles.uploadWrap}>
      <Upload
        accept={IMAGE_ACCEPT}
        showUploadList={false}
        disabled={compressing}
        beforeUpload={beforeUpload}
      >
        <div className={styles.replaceSlot}>
          {compressing ? (
            <Spin tip='压缩中…' />
          ) : (
            <PlusOutlined style={{ fontSize: 28, color: 'rgba(0,0,0,0.45)' }} />
          )}
        </div>
      </Upload>
    </div>
  )

  const hasExisting = !!value?.trim()

  if (hasExisting) {
    return (
      <div className={styles.coverStrip}>
        <ExistingCoverPane fileId={value!} />
        <StripArrow />
        <div className={styles.coverPane}>
          <Typography.Text className={styles.paneTitle}>替换为</Typography.Text>
          {pending ? (
            <>
              <PreviewPanelImage src={pending.compressedPreviewUrl} alt='压缩后预览' />
              <ImageMeta
                width={pending.preview.outputWidth}
                height={pending.preview.outputHeight}
                size={pending.preview.outputSize}
              />
              {pendingFooter}
            </>
          ) : (
            replaceUploadSlot
          )}
        </div>
      </div>
    )
  }

  if (!pending && !compressing) {
    return (
      <Upload.Dragger
        accept={IMAGE_ACCEPT}
        showUploadList={false}
        beforeUpload={beforeUpload}
        style={{ padding: '12px 0' }}
      >
        <p className='ant-upload-drag-icon' style={{ marginBottom: 4 }}>
          <InboxOutlined />
        </p>
        <p className='ant-upload-text' style={{ margin: 0, fontSize: 13 }}>
          点击或拖拽上传封面
        </p>
        <p className='ant-upload-hint' style={{ margin: '4px 0 0', fontSize: 12 }}>
          选图后自动压缩预览，点击表单「确定」时上传（不超过 {WEBP_MAX_LABEL}）
        </p>
      </Upload.Dragger>
    )
  }

  if (compressing && !pending) {
    return (
      <div className={styles.compressingPane}>
        <Spin tip='正在转 WebP…' />
      </div>
    )
  }

  if (!pending) return null

  return (
    <div className={styles.coverStrip}>
      <div className={styles.coverPane}>
        <Typography.Text className={styles.paneTitle}>压缩前（原图）</Typography.Text>
        <PreviewPanelImage src={pending.originalPreviewUrl} alt='原图' />
        <ImageMeta
          width={pending.preview.originalWidth}
          height={pending.preview.originalHeight}
          size={pending.preview.originalSize}
        />
      </div>
      <StripArrow />
      <div className={styles.coverPane}>
        <Typography.Text className={styles.paneTitle}>压缩后（WebP）</Typography.Text>
        <PreviewPanelImage src={pending.compressedPreviewUrl} alt='WebP' />
        <ImageMeta
          width={pending.preview.outputWidth}
          height={pending.preview.outputHeight}
          size={pending.preview.outputSize}
        />
        {pendingFooter}
      </div>
    </div>
  )
}
