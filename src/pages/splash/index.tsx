import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import SplashVideo from '../../components/splash-video'
import PageShell from '../../components/page-shell'
import { useCountdown } from '../../hooks/useCountdown'
import { useMiniShare } from '../../hooks/useMiniShare'
import { getSplashConfig } from '../../services/cloud/splash'
import './index.scss'

const bootTimeoutMs = 8000

export default function SplashPage() {
  useMiniShare(() => ({ path: '/pages/home/index', query: '' }))

  const enteredRef = useRef(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [skipSeconds, setSkipSeconds] = useState(5)
  const [booting, setBooting] = useState(true)
  const [videoReady, setVideoReady] = useState(false)

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
          enterHome()
          return
        }
        clearBootTimer()
        setVideoReady(false)
        setVideoUrl(config.videoUrl)
        setSkipSeconds(config.skipSeconds)
      })
      .catch(() => {
        if (cancelled) return
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
