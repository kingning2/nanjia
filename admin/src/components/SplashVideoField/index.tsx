import { ArrowRightOutlined, CloseOutlined, InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, Modal, Radio, Space, Spin, Switch, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { VideoCompressPresetDTO } from '@share/types/upload'
import {
  normalizeVideoCompressPreset,
  VIDEO_COMPRESS_PRESET_OPTIONS
} from '../../constants/videoCompress'
import { getHomeSettings } from '../../services/content'
import { uploadVideoFile, validateVideoFile } from '../../services/cloud/upload'
import { deleteStorageFile, resolveStorageUrl } from '../../services/cloud/storage'
import { useDeferredUploadOptional, useDeferredUploadTask } from '../DeferredUpload/context'
import pickerStyles from '../VideoUploadPicker/index.module.css'
import styles from './index.module.css'

const VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.mkv,.webm,.m4v'

interface SplashVideoFieldProps {
  value?: string
  onChange?: (value: string) => void
  uploadPrefix?: string
}

interface PendingVideo {
  file: File
  previewUrl: string
  compress: boolean
  preset: VideoCompressPresetDTO
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function StripArrow() {
  return (
    <div className={styles.arrow} aria-hidden>
      <ArrowRightOutlined />
    </div>
  )
}

function PanelVideo({ src, hint }: { src: string; hint?: string }) {
  return (
    <>
      <div className={styles.panelVideoWrap}>
        <video className={styles.panelVideo} src={src} controls playsInline preload='metadata' />
      </div>
      {hint ? (
        <Typography.Text type='secondary' className={styles.paneHint}>
          {hint}
        </Typography.Text>
      ) : null}
    </>
  )
}

function StoredVideoPane({ fileId, title }: { fileId: string; title: string }) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setUrl(undefined)

    void resolveStorageUrl(fileId)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [fileId])

  return (
    <div className={styles.videoPane}>
      <Typography.Text className={styles.paneTitle}>{title}</Typography.Text>
      {failed ? (
        <div className={styles.panelPlaceholder}>视频加载失败</div>
      ) : !url ? (
        <div className={styles.panelPlaceholder}>视频加载中…</div>
      ) : (
        <PanelVideo src={url} hint='点击播放预览，不会自动播放' />
      )}
    </div>
  )
}

export default function SplashVideoField({
  value,
  onChange,
  uploadPrefix = 'home-settings/splash'
}: SplashVideoFieldProps) {
  const { message } = App.useApp()
  const deferCtx = useDeferredUploadOptional()
  const deferUpload = !!deferCtx

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [compressFeatureEnabled, setCompressFeatureEnabled] = useState(true)
  const [compress, setCompress] = useState(true)
  const [preset, setPreset] = useState<VideoCompressPresetDTO>('standard')

  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [modalFile, setModalFile] = useState<File | null>(null)
  const [pending, setPending] = useState<PendingVideo | null>(null)

  const pendingRef = useRef<PendingVideo | null>(null)
  const valueRef = useRef(value)
  pendingRef.current = pending
  valueRef.current = value

  const modalPreviewUrl = useMemo(() => {
    if (!modalFile) return undefined
    return URL.createObjectURL(modalFile)
  }, [modalFile])

  useEffect(() => {
    return () => {
      if (modalPreviewUrl) URL.revokeObjectURL(modalPreviewUrl)
    }
  }, [modalPreviewUrl])

  useEffect(() => {
    return () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl)
    }
  }, [pending])

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

  const clearPending = useCallback(() => {
    setPending((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      pendingRef.current = null
      return null
    })
  }, [])

  const clearModal = useCallback(() => {
    setModalFile(null)
    setModalOpen(false)
  }, [])

  const setPendingItem = useCallback((item: PendingVideo | null) => {
    pendingRef.current = item
    setPending(item)
  }, [])

  const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
    const error = validateVideoFile(file)
    if (error) {
      message.error(error)
      return Upload.LIST_IGNORE
    }

    setModalFile(file)
    setModalOpen(true)
    return false
  }

  const handleModalConfirm = () => {
    if (!modalFile) return

    const previewUrl = URL.createObjectURL(modalFile)
    setPendingItem({
      file: modalFile,
      previewUrl,
      compress: compressFeatureEnabled && compress,
      preset
    })
    clearModal()

    if (!deferUpload) {
      void (async () => {
        setUploading(true)
        try {
          const ok = await flushUploadRef.current()
          if (!ok) clearPending()
        } finally {
          setUploading(false)
        }
      })()
    } else {
      message.success('已选择视频，点击「保存」时上传')
    }
  }

  const flushUpload = useCallback(async (): Promise<boolean> => {
    const item = pendingRef.current
    if (!item) return true

    const previousFileId = valueRef.current?.trim()
    setUploading(true)
    try {
      const result = await uploadVideoFile(item.file, {
        prefix: uploadPrefix,
        compress: item.compress,
        preset: item.preset
      })
      if (previousFileId && previousFileId !== result.fileID) {
        try {
          await deleteStorageFile(previousFileId)
        } catch {
          message.warning('新视频已上传，但旧文件未能从云存储删除')
        }
      }
      onChange?.(result.fileID)
      URL.revokeObjectURL(item.previewUrl)
      pendingRef.current = null
      setPending(null)
      return true
    } catch {
      return false
    } finally {
      setUploading(false)
    }
  }, [message, onChange, uploadPrefix])

  const flushUploadRef = useRef(flushUpload)
  flushUploadRef.current = flushUpload

  useDeferredUploadTask(
    flushUpload,
    () => pendingRef.current !== null,
    deferUpload
  )

  const replaceUploadSlot = (
    <div className={styles.uploadWrap}>
      <Upload
        accept={VIDEO_ACCEPT}
        maxCount={1}
        showUploadList={false}
        disabled={uploading || settingsLoading}
        beforeUpload={handleBeforeUpload}
      >
        <div className={styles.replaceSlot}>
          {settingsLoading || uploading ? (
            <Spin tip={uploading ? '上传中…' : '加载中…'} />
          ) : (
            <PlusOutlined style={{ fontSize: 28, color: 'rgba(0,0,0,0.45)' }} />
          )}
        </div>
      </Upload>
    </div>
  )

  const pendingFooter = (
    <Space style={{ marginTop: 8 }} wrap>
      {deferUpload ? (
        <Typography.Text type='secondary' style={{ fontSize: 12 }}>
          点击「保存」时上传
        </Typography.Text>
      ) : null}
      <Button size='small' icon={<CloseOutlined />} disabled={uploading} onClick={clearPending}>
        取消
      </Button>
    </Space>
  )

  const pendingPane = pending ? (
  <div className={styles.videoPane}>
      <Typography.Text className={styles.paneTitle}>
        {value?.trim() ? '替换为' : '待上传'}
      </Typography.Text>
      <PanelVideo src={pending.previewUrl} hint='点击播放预览，不会自动播放' />
      <Typography.Text type='secondary' className={styles.paneHint}>
        {pending.file.name} · {formatFileSize(pending.file.size)}
      </Typography.Text>
      {pendingFooter}
    </div>
  ) : null

  const hasExisting = !!value?.trim()

  const uploadModal = (
    <Modal
      title='上传视频'
      open={modalOpen && !!modalFile}
      onCancel={clearModal}
      width={860}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={clearModal} disabled={uploading}>
            取消
          </Button>
          <Button
            type='primary'
            icon={<UploadOutlined />}
            loading={uploading}
            onClick={handleModalConfirm}
          >
            确认
          </Button>
        </Space>
      }
    >
      {modalFile && modalPreviewUrl ? (
        <div className={pickerStyles.uploadModalBody}>
          <div className={pickerStyles.previewPane}>
            <video
              className={pickerStyles.videoPlayer}
              src={modalPreviewUrl}
              controls
              playsInline
              preload='metadata'
            />
            <Typography.Text type='secondary' className={pickerStyles.fileMeta}>
              {modalFile.name} · {formatFileSize(modalFile.size)}
            </Typography.Text>
          </div>

          <div className={pickerStyles.paramsPane}>
            {compressFeatureEnabled ? (
              <>
                <div>
                  <Space align='center'>
                    <Switch checked={compress} onChange={setCompress} disabled={uploading} />
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
                      disabled={uploading}
                    >
                      {VIDEO_COMPRESS_PRESET_OPTIONS.map((item) => (
                        <Radio key={item.value} value={item.value}>
                          <div>
                            <div>{item.label}</div>
                            <div className={pickerStyles.presetOptionDesc}>{item.description}</div>
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
              <Typography.Text type='secondary'>系统设置已关闭视频压缩，将原片上传</Typography.Text>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )

  if (hasExisting) {
    return (
      <>
        <div className={styles.videoStrip}>
          <StoredVideoPane fileId={value!} title='当前视频' />
          <StripArrow />
          {pending ? pendingPane : (
            <div className={styles.videoPane}>
              <Typography.Text className={styles.paneTitle}>替换为</Typography.Text>
              {replaceUploadSlot}
            </div>
          )}
        </div>
        {uploadModal}
      </>
    )
  }

  if (pending) {
    return (
      <>
        <div className={styles.videoStrip}>{pendingPane}</div>
        {uploadModal}
      </>
    )
  }

  return (
    <>
      <Upload.Dragger
        accept={VIDEO_ACCEPT}
        maxCount={1}
        showUploadList={false}
        disabled={uploading || settingsLoading}
        beforeUpload={handleBeforeUpload}
        style={{ padding: '12px 0' }}
      >
        <p className='ant-upload-drag-icon' style={{ marginBottom: 4 }}>
          <InboxOutlined />
        </p>
        <p className='ant-upload-text' style={{ margin: 0, fontSize: 13 }}>
          点击或拖拽选择启动页视频
        </p>
        <p className='ant-upload-hint' style={{ margin: '4px 0 0', fontSize: 12 }}>
          支持 mp4 / mov / avi 等；选择后配置压缩参数，点击「保存」时上传
        </p>
      </Upload.Dragger>
      {uploadModal}
    </>
  )
}
