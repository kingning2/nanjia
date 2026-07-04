import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import { useMemo } from 'react'
import { sortByOrder } from '@share/types/content'
import type { HomeImageItem } from '../../types/project'
import './index.scss'

interface HomeHeroCarouselProps {
  images: HomeImageItem[]
  /** 自动切换间隔（秒） */
  interval?: number
  tagline?: string
}

/** 首页顶部图片轮播（可滑动 + 自动切换），与视频模式二选一 */
export default function HomeHeroCarousel({
  images,
  interval = 4,
}: HomeHeroCarouselProps) {
  const slides = useMemo(
    () => sortByOrder(images.filter((item) => item.imageUrl?.trim())),
    [images]
  )

  if (!slides.length) return null

  const intervalMs = Math.max(1, interval) * 1000
  const multiple = slides.length > 1

  return (
    <View className='home-hero-carousel'>
      <Swiper
        className='home-hero-carousel__swiper'
        circular={multiple}
        autoplay={multiple}
        interval={intervalMs}
        indicatorDots={multiple}
        indicatorColor='rgba(250, 247, 242, 0.35)'
        indicatorActiveColor='rgba(250, 247, 242, 0.92)'
      >
        {slides.map((item, index) => (
          <SwiperItem key={`${item.sort}-${item.imageUrl}-${index}`}>
            <Image className='home-hero-carousel__image' src={item.imageUrl} mode='aspectFill' />
          </SwiperItem>
        ))}
      </Swiper>
      <View className='home-hero-carousel__shade' />
      <View className='home-hero-carousel__feather' />
    </View>
  )
}
