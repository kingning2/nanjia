import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SplashVideo from '../../components/splash-video'
import PageShell from '../../components/page-shell'
import { useCountdown } from '../../hooks/useCountdown'
import { useDevDebug } from '../../hooks/useDevDebug'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getSplashConfig } from '../../services/cloud/splash'
import './index.scss'

const bootTimeoutMs = 8000

type SplashDebugState = {
  status: 'loading' | 'ok' | 'empty' | 'error'
  videoUrl: string
  skipSeconds: number
  error?: string
}

export default function SplashPage() {
  useMiniShare(() => ({ path: '/pages/home/index', query: '' }))

  const enteredRef = useRef(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [skipSeconds, setSkipSeconds] = useState(5)
  const [booting, setBooting] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const [debug, setDebug] = useState<SplashDebugState>({
    status: 'loading',
    videoUrl: '',
    skipSeconds: 5
  })

  const debugEntries = useMemo(
    () => [
      { label: '状态', value: debug.status },
      { label: 'skipSeconds', value: String(debug.skipSeconds) },
      { label: 'videoUrl', value: debug.videoUrl || '(空)' },
      { label: 'videoReady', value: String(videoReady) },
      ...(debug.error
        ? [{ label: '错误', value: debug.error, tone: 'error' as const }]
        : [])
    ],
    [debug, videoReady]
  )

  useDevDebug('splash', '启动页', debugEntries)

  const enterHome = useCallback(() => {
    if (enteredRef.current) return
    enteredRef.current = true
    Taro.reLaunch({
      url: '/pages/home/index'
    })
  }, [])

  const countdown = useCountdown(
    videoUrl && videoReady ? skipSeconds : 0,
    enterHome
  )

  const handleFirstPlay = useCallback(() => {
    setVideoReady(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    let bootTimer: ReturnType<typeof setTimeout> | undefined

    const clearBootTimer = () => {
      if (bootTimer) {
        clearTimeout(bootTimer)
        bootTimer = undefined
      }
    }

    bootTimer = setTimeout(() => {
      if (!cancelled) enterHome()
    }, bootTimeoutMs)

    void getSplashConfig()
      .then((config) => {
        if (cancelled) return
        if (!config.videoUrl) {
          setDebug({
            status: 'empty',
            videoUrl: '',
            skipSeconds: config.skipSeconds
          })
          enterHome()
          return
        }
        clearBootTimer()
        setVideoReady(false)
        setVideoUrl(config.videoUrl)
        setSkipSeconds(config.skipSeconds)
        setDebug({
          status: 'ok',
          videoUrl: config.videoUrl,
          skipSeconds: config.skipSeconds
        })
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setDebug({
          status: 'error',
          videoUrl: '',
          skipSeconds: 5,
          error: message
        })
        enterHome()
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })

    return () => {
      cancelled = true
      clearBootTimer()
    }
  }, [enterHome])

  return (
    <PageShell
      className='splash-page'
      showServiceFab={false}
    >
      <SplashVideo
        src={videoUrl}
        countdown={countdown}
        loading={booting}
        onFirstPlay={handleFirstPlay}
        onSkip={enterHome}
        onVideoError={enterHome}
      />
    </PageShell>
  )
}
