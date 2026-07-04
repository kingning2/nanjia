import { Video, View } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'
import { useCallback, useRef } from 'react'
import './index.scss'

interface SplashVideoProps {
  src?: string
  countdown?: number
  loading?: boolean
  onSkip: () => void
  onVideoError?: () => void
  onFirstPlay?: () => void
}

export default function SplashVideo({
  src,
  countdown = 0,
  loading = false,
  onSkip,
  onVideoError,
  onFirstPlay
}: SplashVideoProps) {
  const readyRef = useRef(false)
  const showCover = !src

  const notifyPlay = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    onFirstPlay?.()
  }, [onFirstPlay])

  const skipLabel =
    countdown > 0 ? `跳过 ${countdown}s` : loading ? '进入首页' : '跳过'

  return (
    <View className='splash-video'>
      {src ? (
        <Video
          key={src}
          className='splash-video__player'
          src={src}
          autoplay
          loop
          muted
          controls={false}
          showCenterPlayBtn={false}
          showPlayBtn={false}
          objectFit='cover'
          onPlay={notifyPlay}
          onError={() => {
            readyRef.current = false
            onVideoError?.()
          }}
        />
      ) : null}
      {showCover ? <View className='splash-video__cover' /> : null}
      <View className='splash-video__actions'>
        <Button
          size='xlarge'
          type='primary'
          className='splash-video__skip'
          onClick={onSkip}
        >
          {skipLabel}
        </Button>
      </View>
    </View>
  )
}
