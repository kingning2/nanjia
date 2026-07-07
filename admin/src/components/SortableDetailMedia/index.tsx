import {
  DeleteOutlined,
  HolderOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import { App, Button, Carousel, Image, Space, Spin, Tag, Typography } from 'antd'
import type { CarouselRef } from 'antd/es/carousel'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { MaterialDetailMediaDTO } from '@share/types/content'
import { sortDetailMedia } from '@share/types/content'
import type { PickedImagePayload, PickedVideoPayload } from '@share/types/upload'
import { useDeferredUploadOptional, useDeferredUploadTask } from '../DeferredUpload/context'
import CloudImage from '../CloudImage'
import ImageUploadPicker from '../ImageUploadPicker'
import VideoUploadPicker from '../VideoUploadPicker'
import { resolveStorageUrl } from '../../services/cloud/storage'
import { uploadCompressedVideoBytes, uploadWebpBatch } from '../../services/cloud/upload'
import listStyles from '../SortableImageList/index.module.css'
import {
  adjustActiveIndex,
  reorderRowsByIndex,
  useThumbGridDrag
} from '../SortableImageList/useThumbGridDrag'

type PendingRow = MaterialDetailMediaDTO & {
  pendingFile?: File
  pendingWebp?: Uint8Array
  pendingVideoBytes?: Uint8Array
  previewUrl?: string
}

interface SortableDetailMediaProps {
  value?: MaterialDetailMediaDTO[]
  onChange?: (value: MaterialDetailMediaDTO[]) => void
}

function toDto(rows: PendingRow[]): MaterialDetailMediaDTO[] {
  return sortDetailMedia(
    rows
      .filter((row) => !row.pendingFile && row.src?.trim())
      .map(({ type, src, sort }) => ({ type, src: src.trim(), sort }))
  )
}

function nextSort(rows: Array<{ sort: number }>): number {
  return rows.reduce((max, item) => Math.max(max, item.sort), -1) + 1
}

function CloudVideoSlide({ src }: { src: string }) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setUrl(undefined)

    void resolveStorageUrl(src)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [src])

  if (failed) {
    return <div className={listStyles.carouselEmpty}>视频加载失败</div>
  }

  if (!url) {
    return <div className={listStyles.carouselEmpty}>视频加载中…</div>
  }

  return (
    <video
      src={url}
      controls
      playsInline
      preload='metadata'
      className={listStyles.carouselImage}
      style={{ width: '100%', height: 420, objectFit: 'contain', background: '#000' }}
    />
  )
}

function CarouselSlide({ item }: { item: PendingRow }) {
  if (item.type === 'video') {
    if (item.previewUrl) {
      return (
        <video
          src={item.previewUrl}
          controls
          playsInline
          preload='metadata'
          className={listStyles.carouselImage}
          style={{ width: '100%', height: 420, objectFit: 'contain', background: '#000' }}
        />
      )
    }
    return <CloudVideoSlide src={item.src} />
  }

  if (item.previewUrl) {
    return (
      <Image
        src={item.previewUrl}
        alt='配图预览'
        className={listStyles.carouselImage}
        rootClassName={listStyles.carouselImageWrap}
        preview={{ mask: '预览' }}
      />
    )
  }

  return (
    <CloudImage
      src={item.src}
      alt='配图'
      width='100%'
      height={420}
      className={listStyles.carouselImage}
      rootClassName={listStyles.carouselImageWrap}
      style={{ objectFit: 'contain' }}
      preview={{ mask: '预览' }}
      fallbackLabel='加载失败'
    />
  )
}

function MediaCarouselPreview({
  items,
  activeIndex,
  onActiveIndexChange,
  carouselRef
}: {
  items: PendingRow[]
  activeIndex: number
  onActiveIndexChange?: (index: number) => void
  carouselRef: RefObject<CarouselRef | null>
}) {
  const slides = [...items]
    .sort((a, b) => a.sort - b.sort)
    .filter((item) => item.previewUrl || item.src?.trim())

  useEffect(() => {
    if (activeIndex >= slides.length) {
      onActiveIndexChange?.(Math.max(0, slides.length - 1))
      return
    }
    carouselRef.current?.goTo(activeIndex, false)
  }, [activeIndex, carouselRef, onActiveIndexChange, slides.length])

  if (!slides.length) {
    return (
      <div className={`${listStyles.carouselFrame} ${listStyles.carouselEmpty}`}>
        暂无媒体，右侧添加配图或视频
      </div>
    )
  }

  return (
    <div className={listStyles.carouselFrame}>
      <Carousel
        ref={carouselRef}
        key={slides.map((item) => `${item.sort}-${item.type}-${item.src || item.previewUrl}`).join('|')}
        dots={slides.length > 1}
        slidesToShow={1}
        afterChange={onActiveIndexChange}
        draggable
      >
        {slides.map((item, index) => (
          <div key={`${item.sort}-${item.type}-${item.src || item.previewUrl}-${index}`}>
            <div className={listStyles.carouselSlide}>
              <CarouselSlide item={item} />
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}

function RowThumb({ item, size = 96 }: { item: PendingRow; size?: number }) {
  const style = { width: size, height: size, objectFit: 'cover' as const }

  if (item.type === 'video') {
    if (item.previewUrl) {
      return (
        <video
          className={listStyles.thumb}
          src={item.previewUrl}
          muted
          playsInline
          preload='metadata'
          style={{ width: size, height: size, objectFit: 'cover' }}
        />
      )
    }
    return (
      <div
        className={listStyles.thumb}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111',
          color: '#fff'
        }}
      >
        <PlayCircleOutlined style={{ fontSize: 24 }} />
      </div>
    )
  }

  if (item.previewUrl) {
    return (
      <div className={listStyles.thumbWrap} style={{ width: size, height: size }}>
        <Image src={item.previewUrl} width={size} height={size} style={style} preview={{ mask: '预览' }} />
      </div>
    )
  }

  if (item.src) {
    return (
      <div className={listStyles.thumbWrap} style={{ width: size, height: size }}>
        <CloudImage
          src={item.src}
          width={size}
          height={size}
          style={style}
          preview={{ mask: '预览' }}
          fallbackLabel='无预览'
        />
      </div>
    )
  }

  return (
    <div className={listStyles.thumb} style={{ width: size, height: size }}>
      无图
    </div>
  )
}

/** 素材详情媒体：配图与视频统一排序，左轮播预览 + 右列表 */
export default function SortableDetailMedia({ value = [], onChange }: SortableDetailMediaProps) {
  const { message } = App.useApp()
  const deferCtx = useDeferredUploadOptional()
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const carouselRef = useRef<CarouselRef>(null)
  const valueRef = useRef(value)
  const pendingRowsRef = useRef<PendingRow[]>(pendingRows)
  valueRef.current = value
  pendingRowsRef.current = pendingRows

  const savedItems = sortDetailMedia(value)
  const displayItems: PendingRow[] = sortDetailMedia([
    ...savedItems,
    ...pendingRows
  ] as MaterialDetailMediaDTO[]) as PendingRow[]

  useEffect(() => {
    return () => {
      for (const row of pendingRowsRef.current) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
      }
    }
  }, [])

  const emitChange = useCallback(
    (rows: PendingRow[]) => {
      onChange?.(toDto(rows.filter((row) => !row.pendingFile)))
    },
    [onChange]
  )

  const splitAndApply = (rows: PendingRow[]) => {
    const saved = rows.filter((row) => !row.pendingFile)
    const pending = rows.filter((row) => row.pendingFile)
    emitChange(saved)
    setPendingRows(pending)
  }

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = reorderRowsByIndex(displayItems, fromIndex, toIndex)
      splitAndApply(next)
      setPreviewIndex((current) => adjustActiveIndex(current, fromIndex, toIndex))
    },
    [displayItems]
  )

  const { dropTarget, dragging, getDropProps, getHandleProps } = useThumbGridDrag(
    reorder,
    uploading
  )

  const removeItem = (index: number) => {
    const row = displayItems[index]
    if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
    splitAndApply(displayItems.filter((_, i) => i !== index))
  }

  const appendMedia = useCallback(
    (saved: MaterialDetailMediaDTO[], entry: MaterialDetailMediaDTO): MaterialDetailMediaDTO[] => {
      const next = sortDetailMedia([...saved, entry])
      onChange?.(next)
      valueRef.current = next
      return next
    },
    [onChange]
  )

  const addPendingRows = useCallback((items: PickedImagePayload[]) => {
    setPendingRows((prev) => {
      const base = [...sortDetailMedia(valueRef.current), ...prev]
      let sort = nextSort(base) - 1
      const added = items.map((item) => {
        sort += 1
        const copy = new Uint8Array(item.webpBytes)
        return {
          type: 'image' as const,
          src: '',
          sort,
          pendingFile: item.file,
          pendingWebp: copy,
          previewUrl: URL.createObjectURL(new Blob([copy], { type: 'image/webp' }))
        }
      })
      return [...prev, ...added]
    })
  }, [])

  const uploadPickedItems = useCallback(
    async (items: PickedImagePayload[]) => {
      const saved = sortDetailMedia(valueRef.current)
      let sort = nextSort(saved) - 1
      const jobs = items.map((item) => {
        sort += 1
        return { item, sort }
      })

      const messageKey = 'material-detail-media-upload'
      const results = await uploadWebpBatch(
        jobs.map(({ item }) => ({ webpBytes: item.webpBytes, originalName: item.file.name })),
        'material-details/images',
        (done, total) => {
          message.loading({
            key: messageKey,
            duration: 0,
            content: `正在上传图片（${done}/${total}）…`
          })
        }
      )

      const next = sortDetailMedia([
        ...saved,
        ...results.map((result, index) => ({
          type: 'image' as const,
          src: result.fileID,
          sort: jobs[index].sort
        }))
      ])
      onChange?.(next)
      valueRef.current = next
      message.destroy(messageKey)
    },
    [message, onChange]
  )

  const handleFilesPicked = useCallback(
    async (items: PickedImagePayload[]) => {
      if (items.length === 0) return
      if (deferCtx) {
        addPendingRows(items)
        return
      }

      setUploading(true)
      try {
        await uploadPickedItems(items)
      } catch {
        message.error('部分图片上传失败，请重试')
      } finally {
        setUploading(false)
      }
    },
    [addPendingRows, deferCtx, message, uploadPickedItems]
  )

  const handleVideoPicked = useCallback((payload: PickedVideoPayload) => {
    setPendingRows((prev) => {
      const base = [...sortDetailMedia(valueRef.current), ...prev]
      const sort = nextSort(base)
      const copy = new Uint8Array(payload.videoBytes)
      return [
        ...prev,
        {
          type: 'video' as const,
          src: '',
          sort,
          pendingFile: payload.file,
          pendingVideoBytes: copy,
          previewUrl: URL.createObjectURL(new Blob([copy], { type: 'video/mp4' }))
        }
      ]
    })
  }, [])

  const handleVideoUploaded = useCallback(
    (fileID: string) => {
      appendMedia(sortDetailMedia(valueRef.current), {
        type: 'video',
        src: fileID,
        sort: nextSort(sortDetailMedia(valueRef.current))
      })
    },
    [appendMedia]
  )

  const flushPendingUploads = useCallback(async (): Promise<boolean> => {
    const rows = [...pendingRows]
      .sort((a, b) => a.sort - b.sort)
      .filter(
        (row): row is PendingRow =>
          !!row.pendingFile && (!!row.pendingWebp || !!row.pendingVideoBytes)
      )
    if (rows.length === 0) return true

    const messageKey = 'material-detail-media-upload'
    setUploading(true)
    try {
      const saved = sortDetailMedia(valueRef.current)
      const imageRows = rows.filter((row) => row.pendingWebp)
      const videoRows = rows.filter((row) => row.pendingVideoBytes)

      const imageResults =
        imageRows.length > 0
          ? await uploadWebpBatch(
              imageRows.map((row) => ({
                webpBytes: row.pendingWebp!,
                originalName: row.pendingFile!.name
              })),
              'material-details/images',
              (done, total) => {
                message.loading({
                  key: messageKey,
                  duration: 0,
                  content: `正在上传图片（${done}/${total}）…`
                })
              }
            )
          : []

      const videoResults = []
      for (const [index, row] of videoRows.entries()) {
        message.loading({
          key: messageKey,
          duration: 0,
          content: `正在上传视频（${index + 1}/${videoRows.length}）…`
        })
        const result = await uploadCompressedVideoBytes(
          row.pendingVideoBytes!,
          row.pendingFile!.name,
          'material-details/videos'
        )
        videoResults.push(result)
      }

      const next = sortDetailMedia([
        ...saved,
        ...imageResults.map((result, index) => ({
          type: 'image' as const,
          src: result.fileID,
          sort: imageRows[index].sort
        })),
        ...videoResults.map((result, index) => ({
          type: 'video' as const,
          src: result.fileID,
          sort: videoRows[index].sort
        }))
      ])
      onChange?.(next)
      valueRef.current = next
      for (const row of rows) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
      }

      setPendingRows([])
      message.destroy(messageKey)
      return true
    } catch {
      message.destroy(messageKey)
      return false
    } finally {
      setUploading(false)
    }
  }, [message, onChange, pendingRows])

  useDeferredUploadTask(
    flushPendingUploads,
    () => pendingRows.some((row) => row.pendingFile),
    !!deferCtx
  )

  const imageCount = displayItems.filter((item) => item.type === 'image').length
  const videoCount = displayItems.filter((item) => item.type === 'video').length

  return (
    <div className={listStyles.carouselRoot}>
      <div className={listStyles.previewColumn}>
        <Typography.Text type='secondary' className={listStyles.sectionLabel}>
          小程序预览
        </Typography.Text>
        <MediaCarouselPreview
          items={displayItems}
          activeIndex={previewIndex}
          onActiveIndexChange={setPreviewIndex}
          carouselRef={carouselRef}
        />
      </div>

      <div className={listStyles.controlColumn}>
        <div className={listStyles.controlHeader}>
          <Typography.Text type='secondary' className={listStyles.sectionLabel}>
            媒体列表（{displayItems.length}）
          </Typography.Text>
          {uploading ? <Spin size='small' tip='上传中' /> : null}
        </div>

        <Typography.Text type='secondary'>
          配图 {imageCount} · 视频 {videoCount} · 拖拽右上角把手排序
        </Typography.Text>

        <div className={listStyles.thumbGrid}>
          {displayItems.map((item, index) => (
            <div
              key={`${item.sort}-${item.type}-${item.src}-${index}`}
              className={[
                listStyles.thumbCell,
                index === previewIndex ? listStyles.thumbCellActive : '',
                dragging === index ? listStyles.thumbCellDragging : '',
                dropTarget === index ? listStyles.thumbCellDragOver : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setPreviewIndex(index)}
              {...getDropProps(index)}
            >
              <RowThumb item={item} size={72} />
              <span className={listStyles.thumbIndex}>{index + 1}</span>
              <span className={listStyles.dragHandle} title='拖拽排序' {...getHandleProps(index)}>
                <HolderOutlined />
              </span>
              <Tag
                color={item.type === 'video' ? 'purple' : 'blue'}
                className={listStyles.pendingTag}
                style={{ right: 4, left: 'auto', top: 'auto', bottom: 28 }}
              >
                {item.type === 'video' ? '视频' : '配图'}
              </Tag>
              {item.pendingFile ? (
                <Tag color='processing' className={listStyles.pendingTag}>
                  待上传
                </Tag>
              ) : null}
              <div className={listStyles.thumbActions}>
                <Button
                  type='text'
                  size='small'
                  danger
                  icon={<DeleteOutlined />}
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeItem(index)
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <Space wrap align='center'>
          <Typography.Text type='secondary'>添加配图</Typography.Text>
          <ImageUploadPicker
            trigger='plus'
            multiple
            disabled={uploading}
            uploadPrefix='material-details/images'
            onFilesPicked={(items) => void handleFilesPicked(items)}
          />
          <Typography.Text type='secondary'>添加视频</Typography.Text>
          <VideoUploadPicker
            trigger='plus'
            disabled={uploading}
            uploadPrefix='material-details/videos'
            onVideoPicked={handleVideoPicked}
            onUploaded={deferCtx ? undefined : handleVideoUploaded}
          />
        </Space>
      </div>
    </div>
  )
}
