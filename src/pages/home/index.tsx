import { Image, Text, View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { NoticeBar } from '@nutui/nutui-react-taro'
import { useCallback, useMemo, useRef, useState } from 'react'
import { sortByOrder } from '@share/types/content'
import HomeCategoryActions from '../../components/home-category-actions'
import HomeHeroCarousel from '../../components/home-hero-carousel'
import HomeHeroIntro, { HomeHeroPhase } from '../../components/home-hero-intro'
import HomeImageGallery from '../../components/home-image-gallery'
import PageShell from '../../components/page-shell'
import RouteTabbar from '../../components/route-tabbar'
import { useDevDebug } from '../../hooks/useDevDebug'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getPortfolioHome } from '../../services/cloud/project'
import {
  CarouselVideoItem,
  HomeHeroMediaType,
  HomeImageItem,
  HomePrimaryCta
} from '../../types/project'
import './index.scss'

const heroTagline = 'Captured Moments, Timeless Elegance.'
// 为空时显示文字；填入艺术字图片地址后显示图片（推荐放 src/assets/home/ 下）
const homeBrandArtImage = ''

type BrandLayout = 'centered' | 'below-video' | 'top'

type HomeDebugState = {
  status: 'loading' | 'ok' | 'empty' | 'error'
  message: string
  traceId: string
  rawResponse: string
  videoCount: number
  imageCount: number
  showHero: boolean
  heroCanPlay: boolean
  error?: string
}

function formatDebugJson(value: unknown, maxLen = 2400): string {
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > maxLen ? `${text.slice(0, maxLen)}\n...(truncated)` : text
  } catch {
    return String(value)
  }
}

const initialDebug: HomeDebugState = {
  status: 'loading',
  message: '',
  traceId: '',
  rawResponse: '',
  videoCount: 0,
  imageCount: 0,
  showHero: false,
  heroCanPlay: false
}

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
  const [booting, setBooting] = useState(true)
  const [error, setError] = useState('')
  const [debug, setDebug] = useState<HomeDebugState>(initialDebug)

  const logHome = useCallback((event: string, extra?: Record<string, unknown>) => {
    if (extra) {
      console.info('[home]', event, extra)
      return
    }
    console.info('[home]', event)
  }, [])

  const debugEntries = useMemo(
    () => [
      { label: '状态', value: debug.status },
      { label: 'message', value: debug.message || '(空)' },
      { label: 'traceId', value: debug.traceId || '(空)' },
      { label: '视频数', value: String(debug.videoCount) },
      { label: '配图数', value: String(debug.imageCount) },
      { label: 'showHero', value: String(debug.showHero) },
      { label: 'heroCanPlay', value: String(debug.heroCanPlay) },
      { label: '接口返回', value: debug.rawResponse || '(空)' },
      ...(debug.error
        ? [{ label: '错误', value: debug.error, tone: 'error' as const }]
        : [])
    ],
    [debug]
  )

  useDevDebug('home', '首页 portfolioHome', debugEntries)

  const loadHome = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    logHome('load:start')
    setError('')
    setDebug(initialDebug)
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

      const heroCount = mediaType === 'image' ? heroImgs.length : videos.length

      setDebug({
        status: heroCount > 0 || images.length > 0 ? 'ok' : 'empty',
        message: result.message,
        traceId: result.traceId || result.data.traceId || '',
        rawResponse: formatDebugJson(result.raw),
        videoCount: videos.length,
        imageCount: mediaType === 'image' ? heroImgs.length : images.length,
        showHero: nextShowHero,
        heroCanPlay: nextHeroCanPlay
      })
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : '加载失败'
      logHome('load:error', { message })
      setError(message)
      setShowHero(false)
      setBrandLayout('top')
      setDebug({
        status: 'error',
        message: '',
        traceId: '',
        rawResponse: '',
        videoCount: 0,
        imageCount: 0,
        showHero: false,
        heroCanPlay: false,
        error: message
      })
    } finally {
      loadingRef.current = false
      setBooting(false)
    }
  }, [logHome])

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

  useDidShow(() => {
    logHome('page:didShow', { loaded: loadedRef.current })
    if (loadedRef.current) return
    loadedRef.current = true
    void loadHome()
  }, [loadHome, logHome])

  const hasContent = showHero || homeImages.length > 0

  return (
    <PageShell className='home-page'>
      <View className='home-page__hero-stack'>
        <View className={`home-page__stage home-page__stage--${brandLayout}`}>
          {showHero && heroCanPlay ? (
            heroMediaType === 'image' ? (
              <HomeHeroCarousel
                images={heroImages}
                interval={heroInterval}
                tagline={heroTagline}
              />
            ) : (
              <HomeHeroIntro
                videos={carouselVideos}
                tagline={heroTagline}
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

      <View className={`home-page__reveal-panel home-page__reveal-panel--${brandLayout}`}>
        <View className='home-page__reveal-panel__inner'>
          {homeBrandArtImage ? (
            <Image className='home-page__brand-art' src={homeBrandArtImage} mode='widthFix' />
          ) : (
            <Text className='home-page__brand'>南 嘉</Text>
          )}
          <HomeCategoryActions mode='overlay' primaryCta={primaryCta} />
        </View>
      </View>

      {!!error && (
        <NoticeBar closeable={false} color='danger' className='home-page__error'>
          {error}
        </NoticeBar>
      )}

      <HomeImageGallery items={homeImages} />

      {!booting && !hasContent && !error ? (
        <View className='home-page__empty'>暂无展示内容</View>
      ) : null}

      <RouteTabbar />
    </PageShell>
  )
}
