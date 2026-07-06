import { Image, ScrollView, Text, Video, View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { NoticeBar } from '@nutui/nutui-react-taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import HomeBootLoader from '../../components/home-boot-loader'
import HomeCategoryActions from '../../components/home-category-actions'
import HomeHeroCarousel from '../../components/home-hero-carousel'
import HomeHeroIntro, { HomeHeroPhase } from '../../components/home-hero-intro'
import HomeImageGallery from '../../components/home-image-gallery'
import PageShell from '../../components/page-shell'
import RouteTabbar from '../../components/route-tabbar'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getPortfolioHome } from '../../services/cloud/project'
import {
  CarouselVideoItem,
  HomeHeroMediaType,
  HomeImageItem,
  HomePrimaryCta
} from '../../types/project'
import './index.scss'
// 为空时显示文字；填入艺术字图片地址后显示图片（推荐放 src/assets/home/ 下）
import homeBrandArtImage from "@/assets/icons/font.svg"

type BrandLayout = 'centered' | 'below-video' | 'top'

export default function HomePage() {
  useMiniShare()

  const loadingRef = useRef(false)
  const loadedRef = useRef(false)
  const [heroMediaType, setHeroMediaType] = useState<HomeHeroMediaType>('video')
  const [carouselVideos, setCarouselVideos] = useState<CarouselVideoItem[]>([])
  const [heroImages, setHeroImages] = useState<HomeImageItem[]>([])
  const [heroInterval, setHeroInterval] = useState(4)
  const [homeImages, setHomeImages] = useState<HomeImageItem[]>([])
  const [primaryCta, setPrimaryCta] = useState<HomePrimaryCta | null>(null)
  const [showHero, setShowHero] = useState(false)
  const [heroCanPlay, setHeroCanPlay] = useState(false)
  const [preloadUrls, setPreloadUrls] = useState<string[]>([])
  const preloadedCountRef = useRef(0)
  const [brandLayout, setBrandLayout] = useState<BrandLayout>('centered')
  const [bootLoaderVisible, setBootLoaderVisible] = useState(true)
  const [homeLoaded, setHomeLoaded] = useState(false)
  const mediaPendingRef = useRef(0)
  const [error, setError] = useState('')
  const [brandArtFailed, setBrandArtFailed] = useState(false)

  const resetMediaTracker = useCallback((count: number) => {
    mediaPendingRef.current = count
  }, [])

  const markMediaLoaded = useCallback(() => {
    mediaPendingRef.current = Math.max(0, mediaPendingRef.current - 1)
  }, [])

  const logHome = useCallback((event: string, extra?: Record<string, unknown>) => {
    if (extra) {
      console.info('[home]', event, extra)
      return
    }
    console.info('[home]', event)
  }, [])

  const loadHome = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    logHome('load:start')
    setError('')
    try {
      const result = await getPortfolioHome()
      logHome('load:success', {
        traceId: result.traceId || result.data.traceId || '',
        message: result.message
      })
      const mediaType = result.data.heroMediaType
      setHeroMediaType(mediaType)
      const videos = result.data.carouselVideos.filter((item) => item.videoUrl?.trim())
      setCarouselVideos(videos)
      const heroImgs = sortByOrder(result.data.heroImages.filter((item) => item.imageUrl?.trim()))
      setHeroImages(heroImgs)
      setHeroInterval(result.data.heroCarouselInterval)
      const images = sortByOrder(result.data.homeImages.filter((item) => item.imageUrl?.trim()))
      setHomeImages(images)
      setPrimaryCta(result.data.primaryCta)

      let nextShowHero = false
      let nextHeroCanPlay = false
      let nextPreloadUrls: string[] = []

      if (mediaType === 'image') {
        // 图片轮播无需预加载门控，直接展示并揭示品牌区
        if (heroImgs.length > 0) {
          nextShowHero = true
          nextHeroCanPlay = true
          setBrandLayout('below-video')
        } else {
          setBrandLayout('top')
        }
      } else if (videos.length > 0) {
        nextShowHero = true
        nextHeroCanPlay = false
        preloadedCountRef.current = 0
        const targets = images.slice(0, 2).map((item) => item.imageUrl).filter(Boolean)
        nextPreloadUrls = targets
        if (targets.length === 0) {
          nextHeroCanPlay = true
        }
      } else {
        setBrandLayout('top')
      }

      setShowHero(nextShowHero)
      setHeroCanPlay(nextHeroCanPlay)
      setPreloadUrls(nextPreloadUrls)

      const mediaCount =
        (mediaType === 'video' ? videos.length : heroImgs.length) + images.length
      resetMediaTracker(mediaCount)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '加载失败'
      logHome('load:error', { message })
      setError(message)
      setShowHero(false)
      setBrandLayout('top')
      setBootLoaderVisible(false)
      resetMediaTracker(0)
    } finally {
      loadingRef.current = false
      setHomeLoaded(true)
    }
  }, [logHome, resetMediaTracker])

  const handleHeroPhaseChange = useCallback((phase: HomeHeroPhase) => {
    if (phase === 'playing') {
      setBrandLayout('below-video')
    }
  }, [])

  const handlePreloadDone = useCallback(() => {
    if (!showHero || heroCanPlay) return
    preloadedCountRef.current += 1
    if (preloadedCountRef.current >= preloadUrls.length) {
      setHeroCanPlay(true)
    }
  }, [heroCanPlay, preloadUrls.length, showHero])

  const handleBootRevealComplete = useCallback(() => {
    setBootLoaderVisible(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setBootLoaderVisible(false), 2200)
    return () => clearTimeout(timer)
  }, [])

  useDidShow(() => {
    logHome('page:didShow', { loaded: loadedRef.current })
    if (loadedRef.current) return
    loadedRef.current = true
    void loadHome()
  }, [loadHome, logHome])

  const hasContent = showHero || homeImages.length > 0
  const showBootLoader = bootLoaderVisible && !error

  return (
    <PageShell className='home-page'>
      <HomeBootLoader visible={showBootLoader} onRevealComplete={handleBootRevealComplete} />
      <ScrollView className='home-page__scroll' scrollY enhanced showScrollbar={false}>
        <View className='home-page__hero-stack'>
          <View className={`home-page__stage home-page__stage--${brandLayout}`}>
            {showHero && heroCanPlay ? (
              heroMediaType === 'image' ? (
                <HomeHeroCarousel
                  images={heroImages}
                  interval={heroInterval}
                />
              ) : (
                <HomeHeroIntro
                  videos={carouselVideos}
                  onPhaseChange={handleHeroPhaseChange}
                />
              )
            ) : null}
          </View>
        </View>

      {/* 预加载首屏图片：图片加载完再启动视频 */}
      {showHero && !heroCanPlay
        ? preloadUrls.map((url) => (
            <Image
              key={url}
              src={url}
              style={{ width: '1px', height: '1px', position: 'absolute', left: '-9999px', top: '-9999px' }}
              onLoad={handlePreloadDone}
              onError={handlePreloadDone}
            />
          ))
        : null}

      {/* 预加载顶部轮播图（图片模式） */}
      {heroMediaType === 'image'
        ? heroImages.map((item) => (
            <Image
              key={item.imageUrl}
              src={item.imageUrl}
              style={{ width: '1px', height: '1px', position: 'absolute', left: '-9999px', top: '-9999px' }}
              onLoad={markMediaLoaded}
              onError={markMediaLoaded}
            />
          ))
        : null}

      {/* 预加载顶部视频 */}
      {heroMediaType === 'video'
        ? carouselVideos.map((item) => (
            <Video
              key={item.videoUrl}
              src={item.videoUrl}
              style={{ width: '1px', height: '1px', position: 'absolute', left: '-9999px', top: '-9999px' }}
              onLoadedMetaData={markMediaLoaded}
              onError={markMediaLoaded}
            />
          ))
        : null}

      <View className={`home-page__reveal-panel home-page__reveal-panel--${brandLayout}`}>
        <View className='home-page__reveal-panel__inner'>
          {homeBrandArtImage && !brandArtFailed ? (
            <Image
              className='home-page__brand-art'
              src={homeBrandArtImage}
              mode='widthFix'
              onError={() => setBrandArtFailed(true)}
            />
          ) : (
            <Text className='home-page__brand'>NANJIA</Text>
          )}
          <HomeCategoryActions mode='overlay' primaryCta={primaryCta} />
        </View>
      </View>

      {!!error && (
        <NoticeBar closeable={false} color='danger' className='home-page__error'>
          {error}
        </NoticeBar>
      )}

      <HomeImageGallery items={homeImages} onMediaLoaded={markMediaLoaded} />

        {homeLoaded && !hasContent && !error ? (
          <View className='home-page__empty'>暂无展示内容</View>
        ) : null}
      </ScrollView>

      <RouteTabbar />
    </PageShell>
  )
}
