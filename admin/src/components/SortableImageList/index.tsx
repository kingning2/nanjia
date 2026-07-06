import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Carousel, Image, Input, InputNumber, Space, Spin, Tag, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CarouselRef } from 'antd/es/carousel'
import type { MaterialDetailImageDTO } from '@share/types/content'
import { sortDetailImages } from '@share/types/content'
import type { MediaFileDTO } from '@share/types/media'
import type { PickedImagePayload } from '@share/types/upload'
import { useDeferredUploadOptional, useDeferredUploadTask } from '../DeferredUpload/context'
import CloudImage from '../CloudImage'
import ImageUploadPicker from '../ImageUploadPicker'
import { uploadWebpBytes } from '../../services/cloud/upload'
import styles from './index.module.css'
import { adjustActiveIndex, reorderRowsByIndex, useThumbGridDrag } from './useThumbGridDrag'

type PendingRow = MaterialDetailImageDTO & {
  pendingFile?: File
  pendingWebp?: Uint8Array
  previewUrl?: string
}

interface SortableImageListProps {
  value?: MaterialDetailImageDTO[]
  onChange?: (value: MaterialDetailImageDTO[]) => void
  uploadPrefix?: string
  draggerTitle?: string
  compact?: boolean
  multiple?: boolean
  showManualRow?: boolean
  /** default：拖拽上传 + 卡片列表；carousel：左预览轮播 + 右列表（素材详情） */
  layout?: 'default' | 'carousel'
  /** 每张图上传成功后的回调（如媒体库同步列表） */
  onUploaded?: (result: MediaFileDTO) => void
}

function toDto(rows: PendingRow[]): MaterialDetailImageDTO[] {
  return sortDetailImages(rows.map(({ image, sort }) => ({ image, sort })))
}

function nextSort(rows: Array<{ sort: number }>): number {
  return rows.reduce((max, item) => Math.max(max, item.sort), -1) + 1
}

function CarouselSlideImage({ item }: { item: PendingRow }) {
  if (item.previewUrl) {
    return (
      <Image
        src={item.previewUrl}
        alt='配图预览'
        className={styles.carouselImage}
        rootClassName={styles.carouselImageWrap}
        preview={{ mask: '预览' }}
      />
    )
  }

  return (
    <CloudImage
      src={item.image}
      alt='配图'
      width='100%'
      height={420}
      className={styles.carouselImage}
      rootClassName={styles.carouselImageWrap}
      style={{ objectFit: 'contain' }}
      preview={{ mask: '预览' }}
      fallbackLabel='加载失败'
    />
  )
}

function ImageCarouselPreview({
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
    .filter((item) => item.previewUrl || item.image?.trim())

  useEffect(() => {
    if (activeIndex >= slides.length) {
      onActiveIndexChange?.(Math.max(0, slides.length - 1))
      return
    }
    carouselRef.current?.goTo(activeIndex, false)
  }, [activeIndex, carouselRef, onActiveIndexChange, slides.length])

  if (!slides.length) {
    return (
      <div className={`${styles.carouselFrame} ${styles.carouselEmpty}`}>
        暂无配图，右侧点击「添加配图」
      </div>
    )
  }

  return (
    <div className={styles.carouselFrame}>
      <Carousel
        ref={carouselRef}
        key={slides.map((item) => `${item.sort}-${item.image || item.previewUrl}`).join('|')}
        dots={slides.length > 1}
        slidesToShow={1}
        afterChange={onActiveIndexChange}
        draggable
      >
        {slides.map((item, index) => (
          <div key={`${item.sort}-${item.image || item.previewUrl}-${index}`}>
            <div className={styles.carouselSlide}>
              <CarouselSlideImage item={item as PendingRow} />
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}

function RowThumb({ item, size = 96 }: { item: PendingRow; size?: number }) {
  const style = { width: size, height: size, objectFit: 'cover' as const }

  if (item.previewUrl) {
    return (
      <div className={styles.thumbWrap} style={{ width: size, height: size }}>
        <Image src={item.previewUrl} width={size} height={size} style={style} preview={{ mask: '预览' }} />
      </div>
    )
  }

  if (item.image) {
    return (
      <div className={styles.thumbWrap} style={{ width: size, height: size }}>
        <CloudImage
          src={item.image}
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
    <div className={styles.thumb} style={{ width: size, height: size }}>
      无图
    </div>
  )
}

export default function SortableImageList({
  value = [],
  onChange,
  uploadPrefix = 'projects/uploads',
  draggerTitle = '拖拽或点击添加图片',
  compact = false,
  multiple = true,
  showManualRow = true,
  layout = 'default',
  onUploaded
}: SortableImageListProps) {
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

  const savedItems = sortDetailImages(value)
  const displayItems: PendingRow[] = sortDetailImages([
    ...savedItems,
    ...pendingRows
  ] as MaterialDetailImageDTO[]) as PendingRow[]

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

  const move = (index: number, direction: -1 | 1) => {
    const next = [...displayItems]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const tmp = next[index].sort
    next[index] = { ...next[index], sort: next[target].sort }
    next[target] = { ...next[target], sort: tmp }
    splitAndApply(next)
  }

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const next = reorderRowsByIndex(displayItems, fromIndex, toIndex)
      splitAndApply(next)
      setPreviewIndex((current) => adjustActiveIndex(current, fromIndex, toIndex))
    },
    [displayItems]
  )

  const {
    dropTarget: carouselDropTarget,
    dragging: carouselDragging,
    getDropProps: getCarouselDropProps,
    getHandleProps: getCarouselHandleProps
  } = useThumbGridDrag(reorder, uploading)

  const splitAndApply = (rows: PendingRow[]) => {
    const saved = rows.filter((row) => !row.pendingFile)
    const pending = rows.filter((row) => row.pendingFile)
    emitChange(saved)
    setPendingRows(pending)
  }

  const patchItem = (index: number, patch: Partial<PendingRow>) => {
    const next = displayItems.map((item, i) => (i === index ? { ...item, ...patch } : item))
    splitAndApply(next)
  }

  const removeItem = (index: number) => {
    const row = displayItems[index]
    if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
    splitAndApply(displayItems.filter((_, i) => i !== index))
  }

  const appendUploaded = useCallback(
    (saved: MaterialDetailImageDTO[], fileID: string): MaterialDetailImageDTO[] => {
      const next = sortDetailImages([
        ...saved,
        { image: fileID, sort: nextSort(saved) }
      ])
      onChange?.(next)
      valueRef.current = next
      return next
    },
    [onChange]
  )

  const uploadOne = useCallback(
    async (item: PickedImagePayload, saved: MaterialDetailImageDTO[]): Promise<MediaFileDTO | null> => {
      try {
        const result = await uploadWebpBytes(item.webpBytes, item.file.name, uploadPrefix)
        appendUploaded(saved, result.fileID)
        onUploaded?.(result)
        message.success(`上传成功：${result.originalName}`)
        return result
      } catch {
        return null
      }
    },
    [appendUploaded, message, onUploaded, uploadPrefix]
  )

  const addPendingRows = useCallback((items: PickedImagePayload[]) => {
    setPendingRows((prev) => {
      const base = [...sortDetailImages(valueRef.current), ...prev]
      let sort = nextSort(base) - 1
      const added = items.map((item) => {
        sort += 1
        const copy = new Uint8Array(item.webpBytes)
        return {
          image: '',
          sort,
          pendingFile: item.file,
          pendingWebp: copy,
          previewUrl: URL.createObjectURL(new Blob([copy], { type: 'image/webp' }))
        }
      })
      return [...prev, ...added]
    })
  }, [])

  const handleFilesPicked = useCallback(
    async (items: PickedImagePayload[]) => {
      if (items.length === 0) return
      if (deferCtx) {
        addPendingRows(items)
        return
      }

      setUploading(true)
      const hide = message.loading('正在上传图片…', 0)
      try {
        let saved = sortDetailImages(valueRef.current)
        for (const item of items) {
          const result = await uploadOne(item, saved)
          if (result) {
            saved = valueRef.current
          }
        }
      } finally {
        hide()
        setUploading(false)
      }
    },
    [addPendingRows, deferCtx, message, uploadOne]
  )

  const flushPendingUploads = useCallback(async (): Promise<boolean> => {
    if (pendingRows.length === 0) return true

    const messageKey = 'material-detail-image-upload'
    setUploading(true)
    try {
      let saved = sortDetailImages(valueRef.current)
      const total = pendingRows.length

      for (const [index, row] of (sortDetailImages(pendingRows) as PendingRow[]).entries()) {
        if (!row.pendingFile || !row.pendingWebp) continue
        message.loading({
          key: messageKey,
          duration: 0,
          content: `正在上传图片（${index + 1}/${total}）…`
        })
        const result = await uploadWebpBytes(row.pendingWebp, row.pendingFile.name, uploadPrefix)
        saved = sortDetailImages([
          ...saved,
          { image: result.fileID, sort: row.sort }
        ])
        onChange?.(saved)
        valueRef.current = saved
        onUploaded?.(result)
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
  }, [message, onChange, onUploaded, pendingRows, uploadPrefix])

  useDeferredUploadTask(
    flushPendingUploads,
    () => pendingRows.some((row) => row.pendingFile),
    !!deferCtx
  )

  if (layout === 'carousel') {
    return (
      <div className={styles.carouselRoot}>
        <div className={styles.previewColumn}>
          <Typography.Text type='secondary' className={styles.sectionLabel}>
            小程序预览
          </Typography.Text>
          <ImageCarouselPreview
            items={displayItems}
            activeIndex={previewIndex}
            onActiveIndexChange={setPreviewIndex}
            carouselRef={carouselRef}
          />
        </div>

        <div className={styles.controlColumn}>
          <div className={styles.controlHeader}>
            <Typography.Text type='secondary' className={styles.sectionLabel}>
              配图列表（{displayItems.length}）
            </Typography.Text>
            {uploading ? <Spin size='small' tip='上传中' /> : null}
          </div>

          <Typography.Text type='secondary'>拖拽右上角把手排序</Typography.Text>

          <div className={styles.thumbGrid}>
            {displayItems.map((item, index) => (
              <div
                key={`${item.sort}-${item.image}-${index}`}
                className={[
                  styles.thumbCell,
                  index === previewIndex ? styles.thumbCellActive : '',
                  carouselDragging === index ? styles.thumbCellDragging : '',
                  carouselDropTarget === index ? styles.thumbCellDragOver : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setPreviewIndex(index)}
                {...getCarouselDropProps(index)}
              >
                <RowThumb item={item} size={72} />
                <span className={styles.thumbIndex}>{index + 1}</span>
                <span
                  className={styles.dragHandle}
                  title='拖拽排序'
                  {...getCarouselHandleProps(index)}
                >
                  <HolderOutlined />
                </span>
                {item.pendingFile ? (
                  <Tag color='processing' className={styles.pendingTag}>
                    待上传
                  </Tag>
                ) : null}
                <div className={styles.thumbActions}>
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

          <ImageUploadPicker
            trigger='plus'
            multiple={multiple}
            disabled={uploading}
            uploadPrefix={uploadPrefix}
            onFilesPicked={(items) => void handleFilesPicked(items)}
          />
        </div>
      </div>
    )
  }

  return (
    <Space direction='vertical' style={{ width: '100%' }} size={12}>
      <Space wrap align='start'>
        <ImageUploadPicker
          multiple={multiple}
          compact={compact}
          disabled={uploading}
          uploadPrefix={uploadPrefix}
          draggerTitle={draggerTitle}
          onFilesPicked={(items) => void handleFilesPicked(items)}
        />
        {showManualRow ? (
          <Button
            icon={<PlusOutlined />}
            disabled={uploading}
            onClick={() => {
              const sort = nextSort(displayItems)
              splitAndApply([...displayItems, { image: '', sort }])
            }}
          >
            手动添加一行
          </Button>
        ) : null}
      </Space>
      <Typography.Text type='secondary'>
        sort 越小越靠前，可用箭头调整顺序
        {deferCtx ? '；选图后自动压缩并加入列表，保存表单时上传' : ''}
      </Typography.Text>
      {displayItems.map((item, index) => (
        <Card key={`${item.sort}-${item.image}-${index}`} size='small'>
          <Space align='start' style={{ width: '100%' }}>
            {item.previewUrl ? (
              <Image
                src={item.previewUrl}
                width={72}
                height={72}
                style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                preview={{ mask: '预览' }}
              />
            ) : item.image ? (
              <CloudImage
                src={item.image}
                width={72}
                height={72}
                style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                preview={{ mask: '预览' }}
                fallbackLabel='无预览'
              />
            ) : null}
            <Space direction='vertical' style={{ flex: 1 }}>
              <Input
                value={item.image}
                placeholder={item.pendingFile ? '待上传' : 'fileID 或 URL'}
                disabled={!!item.pendingFile}
                onChange={(e) => patchItem(index, { image: e.target.value })}
              />
              <InputNumber
                value={item.sort}
                min={0}
                precision={0}
                addonBefore='sort'
                onChange={(sort) => patchItem(index, { sort: Number(sort ?? 0) })}
              />
            </Space>
            <Space direction='vertical'>
              <Button
                size='small'
                icon={<ArrowUpOutlined />}
                disabled={index === 0 || uploading}
                onClick={() => move(index, -1)}
              />
              <Button
                size='small'
                icon={<ArrowDownOutlined />}
                disabled={index === displayItems.length - 1 || uploading}
                onClick={() => move(index, 1)}
              />
              <Button
                size='small'
                danger
                icon={<DeleteOutlined />}
                disabled={uploading}
                onClick={() => removeItem(index)}
              />
            </Space>
          </Space>
        </Card>
      ))}
    </Space>
  )
}
