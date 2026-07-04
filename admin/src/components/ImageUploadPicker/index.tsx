import { CloseOutlined, InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, Space, Spin, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import type { MediaFileDTO } from '@share/types/media'
import type { PickedImagePayload } from '@share/types/upload'
import { UPLOAD_WEBP_MAX_BYTES } from '@share/types/upload'
import { uploadWebpBytes, validateImageFile } from '../../services/cloud/upload'
import { formatFileSize } from '../../utils/feedback'
import {
  compressImageFile,
  revokePendingImage,
  type PendingImageCompress
} from '../../utils/imageCompressPending'
import styles from './index.module.css'

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp'
const WEBP_MAX_LABEL = formatFileSize(UPLOAD_WEBP_MAX_BYTES)

export interface ImageUploadPickerRef {
  uploadPending: () => Promise<MediaFileDTO | null>
  hasPending: () => boolean
}

interface ImageUploadPickerProps {
  uploadPrefix?: string
  draggerTitle?: string
  compact?: boolean
  multiple?: boolean
  /** dragger：大拖拽区；plus：仅显示 + 按钮 */
  trigger?: 'dragger' | 'plus'
  /** 表单内：选图后内联预览，由父级在点「确定」时调用 uploadPending */
  deferUpload?: boolean
  onFilesPicked?: (items: PickedImagePayload[]) => void
  onUploaded?: (result: MediaFileDTO) => void
  disabled?: boolean
}

function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return '—'
  return `${width} × ${height}`
}

function savingsPercent(originalSize: number, outputSize: number): string {
  if (originalSize <= 0) return '—'
  const pct = ((1 - outputSize / originalSize) * 100).toFixed(1)
  return `${pct}%`
}

function ImageCompressPreviewInline({
  item,
  footer
}: {
  item: PendingImageCompress
  footer?: ReactNode
}) {
  return (
    <div className={styles.previewSection}>
      <div className={styles.previewBody}>
        <div className={styles.previewPane}>
          <Typography.Text className={styles.paneTitle}>压缩前（原图）</Typography.Text>
          <img className={styles.previewImage} src={item.originalPreviewUrl} alt='原图预览' />
          <div className={styles.metaList}>
            <Typography.Text type='secondary'>
              尺寸：{formatDimensions(item.preview.originalWidth, item.preview.originalHeight)}
            </Typography.Text>
            <Typography.Text type='secondary'>
              体积：{formatFileSize(item.preview.originalSize)}
            </Typography.Text>
          </div>
        </div>

        <div className={styles.previewPane}>
          <Typography.Text className={styles.paneTitle}>压缩后（WebP）</Typography.Text>
          <img className={styles.previewImage} src={item.compressedPreviewUrl} alt='WebP 预览' />
          <div className={styles.metaList}>
            <Typography.Text type='secondary'>
              尺寸：{formatDimensions(item.preview.outputWidth, item.preview.outputHeight)}
            </Typography.Text>
            <Typography.Text type='secondary'>
              体积：{formatFileSize(item.preview.outputSize)}
            </Typography.Text>
            <Typography.Text type='success'>
              节省约 {savingsPercent(item.preview.originalSize, item.preview.outputSize)}
            </Typography.Text>
          </div>
        </div>
      </div>
      {footer}
    </div>
  )
}

const ImageUploadPicker = forwardRef<ImageUploadPickerRef, ImageUploadPickerProps>(
  function ImageUploadPicker(
    {
      uploadPrefix = 'projects/uploads',
      draggerTitle = '点击或拖拽图片到此区域',
      compact = false,
      multiple = false,
      trigger = 'dragger',
      deferUpload = false,
      onFilesPicked,
      onUploaded,
      disabled
    },
    ref
  ) {
    const { message } = App.useApp()
    const [compressing, setCompressing] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deferredPending, setDeferredPending] = useState<PendingImageCompress | null>(null)
    const [inlinePending, setInlinePending] = useState<PendingImageCompress | null>(null)
    const fileQueueRef = useRef<File[]>([])
    const onFilesPickedRef = useRef(onFilesPicked)
    onFilesPickedRef.current = onFilesPicked
    const startCompressRef = useRef<(file: File) => Promise<void>>(async () => {})

    const revokePending = useCallback((item: PendingImageCompress | null) => {
      revokePendingImage(item)
    }, [])

    const resetDeferred = useCallback(() => {
      setDeferredPending((prev) => {
        revokePending(prev)
        return null
      })
    }, [revokePending])

    const resetInline = useCallback(() => {
      setInlinePending((prev) => {
        revokePending(prev)
        return null
      })
    }, [revokePending])

    const processNextInQueue = useCallback(() => {
      const next = fileQueueRef.current.shift()
      if (next) {
        void startCompressRef.current(next)
      }
    }, [])

    const startCompressForFile = useCallback(
      async (file: File) => {
        setCompressing(true)

        try {
          const item = await compressImageFile(file)

          if (deferUpload) {
            resetDeferred()
            setDeferredPending(item)
          } else if (onFilesPickedRef.current) {
            onFilesPickedRef.current([
              { file: item.file, preview: item.preview, webpBytes: item.webpBytes }
            ])
            revokePending(item)
            processNextInQueue()
          } else {
            resetInline()
            setInlinePending(item)
          }
        } catch {
          processNextInQueue()
        } finally {
          setCompressing(false)
        }
      },
      [deferUpload, processNextInQueue, resetDeferred, resetInline, revokePending]
    )

    startCompressRef.current = startCompressForFile

    const uploadPending = useCallback(async (): Promise<MediaFileDTO | null> => {
      if (!deferredPending) return null
      setUploading(true)
      try {
        const result = await uploadWebpBytes(
          deferredPending.webpBytes,
          deferredPending.file.name,
          uploadPrefix
        )
        onUploaded?.(result)
        resetDeferred()
        return result
      } catch {
        return null
      } finally {
        setUploading(false)
      }
    }, [deferredPending, onUploaded, resetDeferred, uploadPrefix])

    const uploadInline = useCallback(async () => {
      if (!inlinePending) return
      setUploading(true)
      try {
        message.loading({ content: '正在上传…', key: 'image-upload', duration: 0 })
        const result = await uploadWebpBytes(
          inlinePending.webpBytes,
          inlinePending.file.name,
          uploadPrefix
        )
        message.success({ content: `上传成功：${result.originalName}`, key: 'image-upload' })
        onUploaded?.(result)
        resetInline()
      } catch {
        message.destroy('image-upload')
      } finally {
        setUploading(false)
      }
    }, [inlinePending, message, onUploaded, resetInline, uploadPrefix])

    useImperativeHandle(
      ref,
      () => ({
        uploadPending,
        hasPending: () => deferredPending !== null
      }),
      [deferredPending, uploadPending]
    )

    const pickFiles = useCallback(
      (files: File[]) => {
        const valid: File[] = []
        for (const file of files) {
          const error = validateImageFile(file)
          if (error) {
            message.error(`${file.name}：${error}`)
            continue
          }
          valid.push(file)
        }
        if (valid.length === 0) return false

        fileQueueRef.current = valid.slice(1)
        void startCompressForFile(valid[0])
        return true
      },
      [message, startCompressForFile]
    )

    const beforeUpload: UploadProps['beforeUpload'] = (file, fileList) => {
      if (multiple || onFilesPicked) {
        const isLast = fileList[fileList.length - 1]?.uid === file.uid
        if (!isLast) return Upload.LIST_IGNORE
        pickFiles(fileList.map((item) => item as File))
        return Upload.LIST_IGNORE
      }
      pickFiles([file])
      return Upload.LIST_IGNORE
    }

    const handleDrop: UploadProps['onDrop'] = (event) => {
      const files = Array.from(event.dataTransfer.files ?? [])
      if (files.length === 0) {
        message.warning('未检测到图片文件')
        return
      }
      pickFiles(files)
    }

    useEffect(() => {
      return () => {
        revokePending(deferredPending)
        revokePending(inlinePending)
      }
    }, [deferredPending, inlinePending, revokePending])

    const inlinePreview = deferUpload ? deferredPending : inlinePending
    const pickMultiple = multiple || !!onFilesPicked

    const uploadControl = (
      <Upload
        disabled={disabled || uploading || compressing}
        multiple={pickMultiple}
        maxCount={pickMultiple ? undefined : 1}
        showUploadList={false}
        accept={IMAGE_ACCEPT}
        beforeUpload={beforeUpload}
        onDrop={trigger === 'dragger' ? handleDrop : undefined}
      >
        {trigger === 'plus' ? (
          <Button
            type='dashed'
            icon={<PlusOutlined />}
            disabled={disabled || uploading || compressing}
            loading={uploading || compressing}
          >
            添加配图
          </Button>
        ) : null}
      </Upload>
    )

    return (
      <Space direction='vertical' style={{ width: '100%' }} size={12}>
        {trigger === 'plus' ? (
          uploadControl
        ) : (
          <Upload.Dragger
            disabled={disabled || uploading || compressing}
            multiple={pickMultiple}
            maxCount={pickMultiple ? undefined : 1}
            showUploadList={false}
            accept={IMAGE_ACCEPT}
            beforeUpload={beforeUpload}
            onDrop={handleDrop}
            style={compact ? { padding: '8px 0' } : undefined}
          >
            <p className='ant-upload-drag-icon' style={compact ? { marginBottom: 4 } : undefined}>
              <InboxOutlined />
            </p>
            <p className='ant-upload-text' style={compact ? { margin: 0, fontSize: 13 } : undefined}>
              {uploading ? '正在上传…' : compressing ? '正在压缩…' : draggerTitle}
            </p>
            <p className='ant-upload-hint' style={compact ? { margin: '4px 0 0', fontSize: 12 } : undefined}>
              {deferUpload
                ? `选图后自动压缩预览，点击表单「确定」时上传（不超过 ${WEBP_MAX_LABEL}）`
                : onFilesPicked
                  ? `选图后自动压缩并加入列表，保存表单时上传（不超过 ${WEBP_MAX_LABEL}）`
                  : `选图后自动压缩预览（不超过 ${WEBP_MAX_LABEL}）`}
            </p>
          </Upload.Dragger>
        )}

        {compressing ? (
          <div className={styles.compressing}>
            <Spin tip='正在转 WebP…' />
          </div>
        ) : null}

        {inlinePreview ? (
          <ImageCompressPreviewInline
            item={inlinePreview}
            footer={
              <Space style={{ marginTop: 12 }}>
                {deferUpload ? (
                  <>
                    <Typography.Text type='secondary'>
                      点击表单「确定」时将上传此 WebP
                    </Typography.Text>
                    <Button
                      size='small'
                      icon={<CloseOutlined />}
                      disabled={uploading}
                      onClick={resetDeferred}
                    >
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type='primary'
                      icon={<UploadOutlined />}
                      loading={uploading}
                      onClick={() => void uploadInline()}
                    >
                      确认上传
                    </Button>
                    <Button icon={<CloseOutlined />} disabled={uploading} onClick={resetInline}>
                      取消
                    </Button>
                  </>
                )}
              </Space>
            }
          />
        ) : null}
      </Space>
    )
  }
)

export default ImageUploadPicker
