import { InboxOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { App, Button, Modal, Radio, Space, Switch, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import type { UploadVideoOptions, VideoCompressPresetDTO } from '@share/types/upload'
import {
  normalizeVideoCompressPreset,
  VIDEO_COMPRESS_PRESET_OPTIONS
} from '../../constants/videoCompress'
import { getHomeSettings } from '../../services/content'
import { uploadVideoFile, validateVideoFile } from '../../services/cloud/upload'
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
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const VideoUploadPicker = forwardRef<VideoUploadPickerRef, VideoUploadPickerProps>(
  function VideoUploadPicker(
    { uploadPrefix = 'categories/videos', deferUpload = false, trigger = 'dragger', onUploaded, disabled },
    ref
  ) {
    const { message } = App.useApp()
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [settingsLoading, setSettingsLoading] = useState(true)
    const [compressFeatureEnabled, setCompressFeatureEnabled] = useState(true)
    const [compress, setCompress] = useState(true)
    const [preset, setPreset] = useState<VideoCompressPresetDTO>('standard')

    const previewUrl = useMemo(() => {
      if (!pendingFile) return undefined
      return URL.createObjectURL(pendingFile)
    }, [pendingFile])

    useEffect(() => {
      return () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
      }
    }, [previewUrl])

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

    const buildUploadOptions = useCallback((): UploadVideoOptions => {
      return {
        prefix: uploadPrefix,
        compress: compressFeatureEnabled && compress,
        preset
      }
    }, [uploadPrefix, compressFeatureEnabled, compress, preset])

    const clearPending = useCallback(() => {
      setPendingFile(null)
      setModalOpen(false)
    }, [])

    const uploadFile = useCallback(
      async (file: File) => {
        setUploading(true)
        const options = buildUploadOptions()
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
      [buildUploadOptions, message, onUploaded]
    )

    useImperativeHandle(
      ref,
      () => ({
        uploadPending: async () => {
          if (!pendingFile) return true
          const ok = await uploadFile(pendingFile)
          if (ok) clearPending()
          return ok
        },
        hasPending: () => !!pendingFile
      }),
      [pendingFile, uploadFile, clearPending]
    )

    const handleBeforeUpload: UploadProps['beforeUpload'] = (file) => {
      const error = validateVideoFile(file)
      if (error) {
        message.error(error)
        return Upload.LIST_IGNORE
      }

      setPendingFile(file)
      setModalOpen(true)
      return false
    }

    const handleModalConfirm = async () => {
      if (!pendingFile) return
      if (deferUpload) {
        setModalOpen(false)
        message.success('已保存上传选项，提交表单时将上传')
        return
      }
      const ok = await uploadFile(pendingFile)
      if (ok) clearPending()
    }

    const uploadInput = (
      <Upload
        accept='video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.mkv,.webm,.m4v'
        maxCount={1}
        showUploadList={false}
        disabled={disabled || uploading || settingsLoading}
        beforeUpload={handleBeforeUpload}
      >
        {trigger === 'plus' ? (
          <Button
            type='dashed'
            icon={<PlusOutlined />}
            disabled={disabled || uploading || settingsLoading}
            loading={uploading}
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
            disabled={disabled || uploading || settingsLoading}
            beforeUpload={handleBeforeUpload}
          >
            <p className='ant-upload-drag-icon'>
              <InboxOutlined />
            </p>
            <p className='ant-upload-text'>
              {uploading ? '上传处理中…' : '点击或拖拽选择视频'}
            </p>
            <p className='ant-upload-hint'>
              支持 mp4 / mov / avi 等，源文件不超过 200MB；选择后在弹窗中预览并配置压缩参数
            </p>
          </Upload.Dragger>
        )}

        {pendingFile && deferUpload && !modalOpen ? (
          <Typography.Link onClick={() => setModalOpen(true)}>
            已选择 {pendingFile.name}（{formatFileSize(pendingFile.size)}），点击修改上传选项
          </Typography.Link>
        ) : null}

        <Modal
          title='上传视频'
          open={modalOpen && !!pendingFile}
          onCancel={clearPending}
          width={860}
          destroyOnClose
          footer={
            <Space>
              <Button onClick={clearPending} disabled={uploading}>
                取消
              </Button>
              <Button
                type='primary'
                icon={<UploadOutlined />}
                loading={uploading}
                onClick={() => void handleModalConfirm()}
              >
                {deferUpload ? '确认' : '确认上传'}
              </Button>
            </Space>
          }
        >
          {pendingFile && previewUrl ? (
            <div className={styles.uploadModalBody}>
              <div className={styles.previewPane}>
                <video
                  className={styles.videoPlayer}
                  src={previewUrl}
                  controls
                  playsInline
                  preload='metadata'
                />
                <Typography.Text type='secondary' className={styles.fileMeta}>
                  {pendingFile.name} · {formatFileSize(pendingFile.size)}
                </Typography.Text>
              </div>

              <div className={styles.paramsPane}>
                {compressFeatureEnabled ? (
                  <>
                    <div>
                      <Space align='center'>
                        <Switch
                          checked={compress}
                          onChange={setCompress}
                          disabled={uploading}
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
                          disabled={uploading}
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

                {deferUpload ? (
                  <Typography.Text type='secondary'>
                    点击「确认」保存选项，提交表单时再上传
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
