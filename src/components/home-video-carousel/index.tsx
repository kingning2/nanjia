import { Text, Video, View } from '@tarojs/components'
import { Loading } from '@nutui/nutui-react-taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import type { CarouselVideoItem } from '../../types/project'
import './index.scss'

interface HomeVideoCarouselProps {
  items?: CarouselVideoItem[]
  loading?: boolean
  tagline?: string
}

type PlayerSlot = 'a' | 'b'

export default function HomeVideoCarousel({
  items = [],
  loading = false,
  tagline = 'Captured Moments, Timeless Elegance.'
}: HomeVideoCarouselProps) {
  const slides = useMemo(
    () => sortByOrder(items.filter((item) => item.videoUrl?.trim())),
    [items]
  )
  const [index, setIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<PlayerSlot>('a')

  useEffect(() => {
    setIndex(0)
    setActiveSlot('a')
  }, [slides])

  const count = slides.length
  const currentUrl = slides[index]?.videoUrl ?? ''
  const preloadUrl = count > 1 ? slides[(index + 1) % count]?.videoUrl ?? '' : ''

  const advance = useCallback(() => {
    if (count <= 1) return
    setIndex((prev) => (prev + 1) % count)
    setActiveSlot((prev) => (prev === 'a' ? 'b' : 'a'))
  }, [count])

  const handleVideoError = useCallback(() => {
    if (count > 1) advance()
  }, [advance, count])

  if (loading) {
    return (
      <View className='home-video-carousel home-video-carousel--loading'>
        <Loading type='circular' />
      </View>
    )
  }

  if (!count) {
    return (
      <View className='home-video-carousel home-video-carousel--empty'>
        {tagline ? <Text className='home-video-carousel__tagline'>{tagline}</Text> : null}
      </View>
    )
  }

  const slotAUrl = activeSlot === 'a' ? currentUrl : preloadUrl
  const slotBUrl = activeSlot === 'b' ? currentUrl : preloadUrl

  return (
    <View className='home-video-carousel'>
      <Video
        className={`home-video-carousel__player home-video-carousel__player--${activeSlot === 'a' ? 'front' : 'back'}`}
        src={slotAUrl}
        autoplay={activeSlot === 'a'}
        loop={count === 1}
        muted
        controls={false}
        showCenterPlayBtn={false}
        showPlayBtn={false}
        objectFit='cover'
        enableProgressGesture={false}
        onError={activeSlot === 'a' ? handleVideoError : undefined}
        onEnded={activeSlot === 'a' ? advance : undefined}
      />
      {count > 1 ? (
        <Video
          className={`home-video-carousel__player home-video-carousel__player--${activeSlot === 'b' ? 'front' : 'back'}`}
          src={slotBUrl}
          autoplay={activeSlot === 'b'}
          muted
          controls={false}
          showCenterPlayBtn={false}
          showPlayBtn={false}
          objectFit='cover'
          enableProgressGesture={false}
          onError={activeSlot === 'b' ? handleVideoError : undefined}
          onEnded={activeSlot === 'b' ? advance : undefined}
        />
      ) : null}
      <View className='home-video-carousel__shade' />
      {tagline ? <Text className='home-video-carousel__tagline'>{tagline}</Text> : null}
    </View>
  )
}
