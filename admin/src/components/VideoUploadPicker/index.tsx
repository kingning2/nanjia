import { InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, Modal, Radio, Space, Switch, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import type {
  PickedVideoPayload,
  UploadVideoOptions,
  VideoCompressPresetDTO
} from '@share/types/upload'
import {
  normalizeVideoCompressPreset,
  VIDEO_COMPRESS_PRESET_OPTIONS
} from '../../constants/videoCompress'
import { useDeferredUploadOptional, useDeferredUploadTask } from '../DeferredUpload/context'
import { getHomeSettings } from '../../services/content'
import {
  previewVideoCompress,
  uploadCompressedVideoBytes,
  uploadVideoFile,
  validateVideoFile
} from '../../services/cloud/upload'
import styles from './index.module.css'

export interface VideoUploadPickerRef {
  uploadPending: () => Promise<boolean>
  hasPending: () => boolean
}

interface VideoUploadPickerProps {
  uploadPrefix?: string
  /** 为 true 时模态框仅确认参数，由父级在保存时调用 uploadPending */
  deferUpload?: boolean
  /** dragger：大拖拽区；plus：仅显示 + 按钮 */
  trigger?: 'dragger' | 'plus'
  onUploaded?: (fileID: string) => void
  /** 延迟上传场景：确认时先压缩，由父级持有待上传数据并在保存时上传 */
  onVideoPicked?: (payload: PickedVideoPayload) => void
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function savingsPercent(originalSize: number, outputSize: number): string {
  if (originalSize <= 0) return '—'
  return `${((1 - outputSize / originalSize) * 100).toFixed(1)}%`
}

const VideoUploadPicker = forwardRef<VideoUploadPickerRef, VideoUploadPickerProps>(
  function VideoUploadPicker(
    {
      uploadPrefix = 'categories/videos',
      deferUpload = false,
      trigger = 'dragger',
      onUploaded,
      onVideoPicked,
      disabled
    },
    ref
  ) {
    const { message } = App.useApp()
    const deferCtx = useDeferredUploadOptional()
    const shouldDeferUpload = deferUpload || !!deferCtx
    const parentOwnsPending = shouldDeferUpload && !!onVideoPicked
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [pendingCompressed, setPendingCompressed] = useState<PickedVideoPayload | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [compressing, setCompressing] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [settingsLoading, setSettingsLoading] = useState(true)
    const [compressFeatureEnabled, setCompressFeatureEnabled] = useState(true)
    const [compress, setCompress] = useState(true)
    const [preset, setPreset] = useState<VideoCompressPresetDTO>('standard')

    const sourcePreviewUrl = useMemo(() => {
      if (!pendingFile || pendingCompressed) return undefined
      return URL.createObjectURL(pendingFile)
    }, [pendingCompressed, pendingFile])

    const compressedPreviewUrl = useMemo(() => {
      if (!pendingCompressed) return undefined
      return URL.createObjectURL(
        new Blob([pendingCompressed.videoBytes], { type: 'video/mp4' })
      )
    }, [pendingCompressed])

    useEffect(() => {
      return () => {
        if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl)
      }
    }, [sourcePreviewUrl])

    useEffect(() => {
      return () => {
        if (compressedPreviewUrl) URL.revokeObjectURL(compressedPreviewUrl)
      }
    }, [compressedPreviewUrl])

    useEffect(() => {
      let cancelled = false
      void (async () => {
        setSettingsLoading(true)
        try {
          const settings = await getHomeSettings()
          if (cancelled) return
          const enabled = settings.videoCompressEnabled !== false
          setCompressFeatureEnabled(enabled)
          setCompress(enabled)
          setPreset(normalizeVideoCompressPreset(settings.defaultVideoCompressPreset))
        } catch {
          if (!cancelled) {
            setCompressFeatureEnabled(true)
            setCompress(true)
            setPreset('standard')
          }
        } finally {
          if (!cancelled) setSettingsLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }, [])

    const buildCompressOptions = useCallback((): Pick<UploadVideoOptions, 'compress' | 'preset'> => {
      return {
        compress: compressFeatureEnabled && compress,
        preset
      }
    }, [compressFeatureEnabled, compress, preset])

    const clearPending = useCallback(() => {
      setPendingFile(null)
      setPendingCompressed(null)
      setModalOpen(false)
    }, [])

    const compressSelectedFile = useCallback(
      async (file: File): Promise<PickedVideoPayload | null> => {
        setCompressing(true)
        const loadingText =
          buildCompressOptions().compress === false ? '正在准备视频…' : '正在压缩视频…'
        try {
          message.loading({ content: loadingText, key: 'video-compress', duration: 0 })
          const payload = await previewVideoCompress(file, buildCompressOptions())
          message.success({ content: '视频已准备好', key: 'video-compress' })
          return payload
        } catch {
          message.destroy('video-compress')
          return null
        } finally {
          setCompressing(false)
        }
      },
      [buildCompressOptions, message]
    )

    const uploadCompressed = useCallback(
      async (payload: PickedVideoPayload) => {
        setUploading(true)
        try {
          message.loading({ content: '正在上传视频…', key: 'video-upload', duration: 0 })
          const result = await uploadCompressedVideoBytes(
            payload.videoBytes,
            payload.file.name,
            uploadPrefix
          )
          onUploaded?.(result.fileID)
          message.success({ content: '视频上传成功', key: 'video-upload' })
          return true
        } catch {
          message.destroy('video-upload')
          return false
        } finally {
          setUploading(false)
        }
      },
      [message, onUploaded, uploadPrefix]
    )

    const uploadFileImmediate = useCallback(
      async (file: File) => {
        setUploading(true)
        const options = {
          prefix: uploadPrefix,
          ...buildCompressOptions()
        }
        const loadingText =
          options.compress === false ? '正在上传原片…' : '正在压缩并上传视频…'
        try {
          message.loading({ content: loadingText, key: 'video-upload', duration: 0 })
          const result = await uploadVideoFile(file, options)
          onUploaded?.(result.fileID)
          message.success({ content: '视频上传成功', key: 'video-upload' })
          return true
        } catch {
          message.destroy('video-upload')
          return false
        } finally {
          setUploading(false)
        }
      },
      [buildCompressOptions, message, onUploaded, uploadPrefix]
    )

    const flushPending = useCallback(async (): Promise<boolean> => {
      if (!pendingCompressed) return true
      const ok = await uploadCompressed(pendingCompressed)
      if (ok) clearPending()
      return ok
    }, [clearPending, pendingCompressed, uploadCompressed])

    useDeferredUploadTask(
      flushPending,
      () => !!pendingCompressed,
      shouldDeferUpload && !!deferCtx && !parentOwnsPending
    )

    useImperativeHandle(
      ref,
      () => ({
        uploadPending: async () => flushPending(),
        hasPending: () => !!pendingCompressed
      }),
      [flushPending, pendingCompressed]
    )

    const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
      const error = validateVideoFile(file)
      if (error) {
        message.error(error)
        return Upload.LIST_IGNORE
      }

      setPendingCompressed(null)
      setPendingFile(file)
      setModalOpen(true)
      return false
    }

    const handleModalConfirm = async () => {
      if (!pendingFile) return

      if (shouldDeferUpload) {
        const payload = await compressSelectedFile(pendingFile)
        if (!payload) return

        if (parentOwnsPending) {
          onVideoPicked?.(payload)
          clearPending()
          return
        }

        setPendingCompressed(payload)
        setModalOpen(false)
        message.success('视频已压缩，提交表单时将上传')
        return
      }

      const ok = await uploadFileImmediate(pendingFile)
      if (ok) clearPending()
    }

    const modalPreviewUrl = compressedPreviewUrl ?? sourcePreviewUrl
    const modalPreviewFile = pendingCompressed?.file ?? pendingFile
    const busy = compressing || uploading

    const uploadInput = (
      <Upload
        accept='video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.mkv,.webm,.m4v'
        maxCount={1}
        showUploadList={false}
        disabled={disabled || busy || settingsLoading}
        beforeUpload={handleBeforeUpload}
      >
        {trigger === 'plus' ? (
          <Button
            type='dashed'
            icon={<PlusOutlined />}
            disabled={disabled || busy || settingsLoading}
            loading={busy}
          >
            添加视频
          </Button>
        ) : null}
      </Upload>
    )

    return (
      <>
        {trigger === 'plus' ? (
          uploadInput
        ) : (
          <Upload.Dragger
            accept='video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.mkv,.webm,.m4v'
            maxCount={1}
            showUploadList={false}
            disabled={disabled || busy || settingsLoading}
            beforeUpload={handleBeforeUpload}
          >
            <p className='ant-upload-drag-icon'>
              <InboxOutlined />
            </p>
            <p className='ant-upload-text'>
              {busy ? '处理中…' : '点击或拖拽选择视频'}
            </p>
            <p className='ant-upload-hint'>
              支持 mp4 / mov / avi 等，源文件不超过 200MB；选择后在弹窗中预览并配置压缩参数
            </p>
          </Upload.Dragger>
        )}

        {pendingCompressed && shouldDeferUpload && !parentOwnsPending && !modalOpen ? (
          <Typography.Link
            onClick={() => {
              setPendingCompressed(null)
              setModalOpen(true)
            }}
          >
            已压缩 {pendingCompressed.file.name}（{formatFileSize(pendingCompressed.preview.outputSize)}），点击重新选择
          </Typography.Link>
        ) : null}

        <Modal
          title='上传视频'
          open={modalOpen && !!modalPreviewFile}
          onCancel={clearPending}
          width={860}
          destroyOnClose
          footer={
            <Space>
              <Button onClick={clearPending} disabled={busy}>
                取消
              </Button>
              <Button
                type='primary'
                icon={<UploadOutlined />}
                loading={busy}
                onClick={() => void handleModalConfirm()}
              >
                {shouldDeferUpload ? '确认' : '确认上传'}
              </Button>
            </Space>
          }
        >
          {modalPreviewFile && modalPreviewUrl ? (
            <div className={styles.uploadModalBody}>
              <div className={styles.previewPane}>
                <video
                  className={styles.videoPlayer}
                  src={modalPreviewUrl}
                  controls
                  playsInline
                  preload='metadata'
                />
                <Typography.Text type='secondary' className={styles.fileMeta}>
                  {modalPreviewFile.name} · {formatFileSize(modalPreviewFile.size)}
                </Typography.Text>
                {pendingCompressed ? (
                  <Typography.Text type='success' className={styles.fileMeta}>
                    压缩后 {formatFileSize(pendingCompressed.preview.outputSize)}（节省约{' '}
                    {savingsPercent(
                      pendingCompressed.preview.originalSize,
                      pendingCompressed.preview.outputSize
                    )}
                    ）
                  </Typography.Text>
                ) : null}
              </div>

              <div className={styles.paramsPane}>
                {compressFeatureEnabled ? (
                  <>
                    <div>
                      <Space align='center'>
                        <Switch
                          checked={compress}
                          onChange={setCompress}
                          disabled={busy || !!pendingCompressed}
                        />
                        <Typography.Text>压缩后上传（推荐，目标 5～20MB）</Typography.Text>
                      </Space>
                    </div>

                    {compress ? (
                      <div>
                        <Typography.Text type='secondary'>压缩预设</Typography.Text>
                        <Radio.Group
                          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}
                          value={preset}
                          onChange={(e) => setPreset(e.target.value as VideoCompressPresetDTO)}
                          disabled={busy || !!pendingCompressed}
                        >
                          {VIDEO_COMPRESS_PRESET_OPTIONS.map((item) => (
                            <Radio key={item.value} value={item.value}>
                              <div>
                                <div>{item.label}</div>
                                <div className={styles.presetOptionDesc}>{item.description}</div>
                              </div>
                            </Radio>
                          ))}
                        </Radio.Group>
                      </div>
                    ) : (
                      <Typography.Text type='secondary'>
                        将原片直接上传（不转码，体积可能较大）
                      </Typography.Text>
                    )}
                  </>
                ) : (
                  <Typography.Text type='secondary'>
                    系统设置已关闭视频压缩，将原片上传
                  </Typography.Text>
                )}

                {shouldDeferUpload ? (
                  <Typography.Text type='secondary'>
                    点击「确认」先压缩视频，提交表单时再上传云存储
                  </Typography.Text>
                ) : null}
              </div>
            </div>
          ) : null}
        </Modal>
      </>
    )
  }
)

export default VideoUploadPicker
