import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { App, Button, Carousel, Space, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomeCarouselVideoDTO } from '@share/types/content'
import { sortByOrder } from '@share/types/content'
import { deleteStorageFile, resolveStorageUrl } from '../../services/cloud/storage'
import VideoUploadPicker from '../VideoUploadPicker'
import styles from './index.module.css'

interface SortableCarouselVideosProps {
  value?: HomeCarouselVideoDTO[]
  onChange?: (value: HomeCarouselVideoDTO[]) => void
  uploadPrefix?: string
}

function nextSort(rows: Array<{ sort: number }>): number {
  return rows.reduce((max, item) => Math.max(max, item.sort), -1) + 1
}

function CloudVideo({
  src,
  active = false,
  className,
  placeholder = '加载中…',
  preload
}: {
  src: string
  active?: boolean
  className?: string
  placeholder?: string
  preload?: 'auto' | 'metadata' | 'none'
}) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const resolvedPreload = preload ?? (active ? 'auto' : 'none')

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

  useEffect(() => {
    const el = videoRef.current
    if (!el || !url) return
    if (active) {
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [active, url])

  if (failed) {
    return (
      <div className={`${className ?? ''} ${styles.thumbPlaceholder}`}>视频加载失败</div>
    )
  }

  if (!url) {
    return (
      <div className={`${className ?? ''} ${styles.thumbPlaceholder}`}>{placeholder}</div>
    )
  }

  return (
    <video
      ref={videoRef}
      className={className}
      src={url}
      muted
      loop
      playsInline
      preload={resolvedPreload}
    />
  )
}

/** 列表缩略图：只拉元数据展示首帧，不循环播放 */
function VideoThumb({ src }: { src: string }) {
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

  if (failed || !url) {
    return <div className={`${styles.thumb} ${styles.thumbPlaceholder}`}>预览</div>
  }

  return (
    <video
      className={styles.thumb}
      src={url}
      muted
      playsInline
      preload='metadata'
    />
  )
}

function CarouselPreview({ items }: { items: HomeCarouselVideoDTO[] }) {
  const [current, setCurrent] = useState(0)
  const slides = sortByOrder(items).filter((item) => item.video?.trim())

  useEffect(() => {
    if (current >= slides.length) {
      setCurrent(Math.max(0, slides.length - 1))
    }
  }, [current, slides.length])

  if (!slides.length) {
    return (
      <div className={`${styles.carouselFrame} ${styles.carouselEmpty}`}>
        暂无轮播视频，右侧点击「添加视频」
      </div>
    )
  }

  return (
    <div className={styles.carouselFrame}>
      <Carousel
        key={slides.map((item) => `${item.sort}-${item.video}`).join('|')}
        dots={slides.length > 1}
        slidesToShow={1}
        afterChange={setCurrent}
        draggable
      >
        {slides.map((item, index) => (
          <div key={`${item.sort}-${item.video}`}>
            <div className={styles.carouselSlide}>
              {index === current ? (
                <CloudVideo
                  src={item.video}
                  active
                  preload='auto'
                  className={styles.carouselVideo}
                />
              ) : (
                <div className={styles.carouselSlideIdle} />
              )}
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}

export default function SortableCarouselVideos({
  value = [],
  onChange,
  uploadPrefix = 'home-settings/videos'
}: SortableCarouselVideosProps) {
  const { message, modal } = App.useApp()
  const valueRef = useRef(value)
  valueRef.current = value

  const items = sortByOrder(value)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const emitChange = useCallback(
    (next: HomeCarouselVideoDTO[]) => {
      onChange?.(sortByOrder(next))
    },
    [onChange]
  )

  const move = (index: number, direction: -1 | 1) => {
    const next = [...items]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const tmp = next[index].sort
    next[index] = { ...next[index], sort: next[target].sort }
    next[target] = { ...next[target], sort: tmp }
    emitChange(next)
  }

  const removeItem = (index: number) => {
    const item = items[index]
    if (!item) return

    modal.confirm({
      title: '删除轮播视频',
      content: '将从云存储中删除该视频文件，此操作不可恢复。确定继续？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeletingKey(item.video)
        try {
          await deleteStorageFile(item.video)
          emitChange(items.filter((_, i) => i !== index))
          message.success('视频已删除')
        } catch {
          // invoke 层已提示
        } finally {
          setDeletingKey(null)
        }
      }
    })
  }

  const appendUploaded = useCallback(
    (fileID: string) => {
      const saved = valueRef.current
      emitChange([...saved, { video: fileID, sort: nextSort(saved) }])
    },
    [emitChange]
  )

  return (
    <div className={styles.root}>
      <div className={styles.previewColumn}>
        <Typography.Text type='secondary' className={styles.sectionLabel}>
          小程序预览
        </Typography.Text>
        <CarouselPreview items={items} />
      </div>

      <div className={styles.controlColumn}>
        <Typography.Text type='secondary' className={styles.sectionLabel}>
          轮播列表
        </Typography.Text>

        {items.map((item, index) => (
          <div key={`${item.sort}-${item.video}`} className={styles.videoRow}>
            <VideoThumb src={item.video} />
            <div className={styles.rowMeta}>
              <Typography.Text type='secondary'>第 {index + 1} 项</Typography.Text>
              <br />
              <Typography.Text type='secondary' style={{ fontSize: 12 }}>
                sort: {item.sort}
              </Typography.Text>
            </div>
            <Space className={styles.rowActions} size={4}>
              <Button
                size='small'
                icon={<ArrowUpOutlined />}
                disabled={index === 0 || deletingKey === item.video}
                onClick={() => move(index, -1)}
              />
              <Button
                size='small'
                icon={<ArrowDownOutlined />}
                disabled={index === items.length - 1 || deletingKey === item.video}
                onClick={() => move(index, 1)}
              />
              <Button
                size='small'
                danger
                icon={<DeleteOutlined />}
                loading={deletingKey === item.video}
                onClick={() => removeItem(index)}
              />
            </Space>
          </div>
        ))}

        <VideoUploadPicker
          trigger='plus'
          uploadPrefix={uploadPrefix}
          onUploaded={(fileID) => appendUploaded(fileID)}
          disabled={!!deletingKey}
        />
      </div>
    </div>
  )
}
