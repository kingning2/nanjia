import { Text, Video, View } from '@tarojs/components'
import { Animate } from '@nutui/nutui-react-taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import type { CarouselVideoItem } from '../../types/project'
import './index.scss'

/** ponytail: 微信 Video 的 onCanplay 常不触发，超时后仍进入 reveal 而非隐藏区块 */
const readyFallbackMs = 8000

export type HomeHeroPhase = 'intro' | 'playing'

interface HomeHeroIntroProps {
  videos: CarouselVideoItem[]
  tagline?: string
  onPhaseChange?: (phase: HomeHeroPhase) => void
}

type PlayerSlot = 'a' | 'b'

export default function HomeHeroIntro({
  videos,
  onPhaseChange
}: HomeHeroIntroProps) {
  const slides = useMemo(
    () => sortByOrder(videos.filter((item) => item.videoUrl?.trim())),
    [videos]
  )
  const slidesKey = useMemo(() => slides.map((item) => item.videoUrl).join('|'), [slides])
  const [phase, setPhase] = useState<HomeHeroPhase>('intro')
  const [index, setIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState<PlayerSlot>('a')
  const readyRef = useRef(false)

  const count = slides.length
  const currentUrl = slides[index]?.videoUrl ?? ''
  const preloadUrl = count > 1 ? slides[(index + 1) % count]?.videoUrl ?? '' : ''

  const beginReveal = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    setPhase('playing')
  }, [])

  const handleVideoReady = useCallback(() => {
    beginReveal()
  }, [beginReveal])

  const advance = useCallback(() => {
    if (count <= 1) return
    setIndex((prev) => (prev + 1) % count)
    setActiveSlot((prev) => (prev === 'a' ? 'b' : 'a'))
  }, [count])

  const handleVideoError = useCallback(() => {
    if (count > 1) advance()
  }, [advance, count])

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  // 仅视频列表变化时重置；轮播切下一支时不能重置 index
  useEffect(() => {
    readyRef.current = false
    setPhase('intro')
    setIndex(0)
    setActiveSlot('a')
  }, [slidesKey])

  useEffect(() => {
    if (!slides.length) return
    const timer = setTimeout(() => beginReveal(), readyFallbackMs)
    return () => clearTimeout(timer)
  }, [slidesKey, slides.length, beginReveal])

  if (!count || !currentUrl) {
    return null
  }

  const slotAUrl = activeSlot === 'a' ? currentUrl : preloadUrl
  const slotBUrl = activeSlot === 'b' ? currentUrl : preloadUrl
  const playing = phase === 'playing'

  return (
    <View className={`home-hero-intro home-hero-intro--${phase}`}>
      <View className='home-hero-intro__video-wrap'>
        <Video
          key={`a-${slotAUrl}`}
          className={`home-hero-intro__player home-hero-intro__player--${activeSlot === 'a' ? 'front' : 'back'}`}
          src={slotAUrl}
          autoplay={activeSlot === 'a'}
          loop={count === 1}
          muted
          controls={false}
          showCenterPlayBtn={false}
          showPlayBtn={false}
          objectFit='cover'
          enableProgressGesture={false}
          onPlay={activeSlot === 'a' ? handleVideoReady : undefined}
          onLoadedMetaData={activeSlot === 'a' ? handleVideoReady : undefined}
          onError={activeSlot === 'a' ? handleVideoError : undefined}
          onEnded={playing && activeSlot === 'a' ? advance : undefined}
        />
        {count > 1 ? (
          <Video
            key={`b-${slotBUrl}`}
            className={`home-hero-intro__player home-hero-intro__player--${activeSlot === 'b' ? 'front' : 'back'}`}
            src={slotBUrl}
            autoplay={activeSlot === 'b'}
            muted
            controls={false}
            showCenterPlayBtn={false}
            showPlayBtn={false}
            objectFit='cover'
            enableProgressGesture={false}
            onPlay={activeSlot === 'b' ? handleVideoReady : undefined}
            onLoadedMetaData={activeSlot === 'b' ? handleVideoReady : undefined}
            onError={activeSlot === 'b' ? handleVideoError : undefined}
            onEnded={playing && activeSlot === 'b' ? advance : undefined}
          />
        ) : null}
        <View className='home-hero-intro__shade' />
        <View className='home-hero-intro__feather' />
        {/* {phase !== 'intro' && tagline ? (
          <Animate type='slide-bottom' action='initial' loop={false}>
            <Text className='home-hero-intro__tagline'>{tagline}</Text>
          </Animate>
        ) : null} */}
      </View>
    </View>
  )
}
