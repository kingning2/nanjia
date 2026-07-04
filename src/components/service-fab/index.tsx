import { Image, MovableArea, MovableView, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import headsetIcon from '@/assets/icons/headset.svg'
import { useServiceFabPos } from '../../hooks/useServiceFabPos'
import './index.scss'

/** 全局可拖动客服入口，位置跨页面共享 */
export default function ServiceFab() {
  const [pos, setPos] = useServiceFabPos()
  const [area, setArea] = useState({ width: 0, height: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const info = Taro.getWindowInfo()
    setArea({ width: info.windowWidth, height: info.windowHeight })
    setReady(true)
  }, [])

  const openContact = () => {
    Taro.navigateTo({ url: '/pages/contact/index' })
  }

  if (!ready) {
    return null
  }

  return (
    <MovableArea
      className='service-fab__area'
      style={{ width: `${area.width}px`, height: `${area.height}px` }}
    >
      <MovableView
        className='service-fab__movable'
        direction='all'
        x={pos.x}
        y={pos.y}
        onChange={(event) => {
          setPos({ x: event.detail.x, y: event.detail.y })
        }}
        onClick={openContact}
      >
        <View className='service-fab__btn'>
          <Image className='service-fab__icon' src={headsetIcon} mode='aspectFit' />
        </View>
      </MovableView>
    </MovableArea>
  )
}
