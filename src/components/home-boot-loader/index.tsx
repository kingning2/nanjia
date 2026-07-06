import { useEffect } from 'react'
import { Text, View } from '@tarojs/components'
import './index.scss'

/** 线条 1.4s + 文字延迟 0.5s/时长 1s */
const REVEAL_MS = 1500

interface HomeBootLoaderProps {
  visible: boolean
  onRevealComplete?: () => void
}

export default function HomeBootLoader({ visible, onRevealComplete }: HomeBootLoaderProps) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => onRevealComplete?.(), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [visible, onRevealComplete])

  if (!visible) return null

  return (
    <View className='home-boot-loader'>
      <View className='home-boot-loader__line-slot'>
        <View className='home-boot-loader__line-reveal'>
          <View className='home-boot-loader__line-track' />
        </View>
      </View>
      <View className='home-boot-loader__brand-slot'>
        <View className='home-boot-loader__brand-reveal'>
          <View className='home-boot-loader__brand-row'>
            <Text className='home-boot-loader__brand-en'>NANJIA</Text>
            <Text className='home-boot-loader__brand-zh'>南嘉婚礼</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
