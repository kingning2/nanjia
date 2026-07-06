import { Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import headsetIcon from '@/assets/icons/headset.svg'
import { useServiceFabPos } from '../../hooks/useServiceFabPos'
import { clampServiceFabPos, SERVICE_FAB_SIZE } from '../../store/fab'
import './index.scss'

type DragState = {
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

/** 全局可拖动客服入口，位置跨页面共享（Skyline 下用 touch + fixed left/top） */
export default function ServiceFab() {
  const [pos, setPos] = useServiceFabPos()
  const [ready, setReady] = useState(false)
  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    setReady(true)
  }, [])

  const openContact = useCallback(() => {
    Taro.navigateTo({ url: '/pages/contact/index' })
  }, [])

  const handleTouchStart = useCallback((event) => {
    const touch = event.touches?.[0]
    if (!touch) return
    dragRef.current = {
      startX: touch.pageX ?? touch.clientX,
      startY: touch.pageY ?? touch.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false
    }
  }, [pos.x, pos.y])

  const handleTouchMove = useCallback((event) => {
    const drag = dragRef.current
    const touch = event.touches?.[0]
    if (!drag || !touch) return

    const touchX = touch.pageX ?? touch.clientX
    const touchY = touch.pageY ?? touch.clientY
    const dx = touchX - drag.startX
    const dy = touchY - drag.startY

    if (!drag.moved) {
      if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return
      drag.moved = true
    }

    // 以按钮中心跟随手指，左右上下都能贴到屏幕边缘
    setPos(
      clampServiceFabPos({
        x: touchX - SERVICE_FAB_SIZE / 2,
        y: touchY - SERVICE_FAB_SIZE / 2
      })
    )
  }, [setPos])

  const handleTouchEnd = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.moved) {
      openContact()
    }
  }, [openContact])

  if (!ready) {
    return null
  }

  return (
    <View
      className='service-fab'
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <View className='service-fab__btn'>
        <Image className='service-fab__icon' src={headsetIcon} mode='aspectFit' />
      </View>
    </View>
  )
}
