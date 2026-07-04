import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PropsWithChildren, useMemo } from 'react'
import backIcon from '@/assets/icons/back.svg'
import './index.scss'

const BAR_HEIGHT_COMPACT = 44

export const CUSTOM_HEADER_BAR_HEIGHT = BAR_HEIGHT_COMPACT

/** 固定导航栏总高度（状态栏 + 标题栏），供粘性区块 top 偏移 */
export function useCustomHeaderInset() {
  return useMemo(() => {
    try {
      const statusBar = Taro.getSystemInfoSync().statusBarHeight || 0
      return statusBar + BAR_HEIGHT_COMPACT
    } catch {
      return BAR_HEIGHT_COMPACT
    }
  }, [])
}

type CustomHeaderProps = {
  title: string
  iconSrc?: string
  /** Tab 根页面不展示返回按钮 */
  showBack?: boolean
  /** Tab 根页面用更矮的标题栏，减少头部占位 */
  compact?: boolean
  /** 透明浮层，用于详情页大图/轮播顶部 */
  overlay?: boolean
}

export default function CustomHeader({
  title,
  iconSrc,
  showBack = true,
  compact = false,
  overlay = false
}: PropsWithChildren<CustomHeaderProps>) {
  const statusBarHeight = useMemo(() => {
    try {
      return Taro.getSystemInfoSync().statusBarHeight || 0
    } catch {
      return 0
    }
  }, [])

  const barHeight = BAR_HEIGHT_COMPACT
  const totalHeight = statusBarHeight + barHeight

  return (
    <>
      <View
        className={`custom-header${compact ? ' custom-header--compact' : ''}${
          overlay ? ' custom-header--overlay' : ''
        }`}
        style={{ paddingTop: `${statusBarHeight}px` }}
      >
        <View className='custom-header__bar' style={{ height: `${barHeight}px` }}>
          <View
            className={`custom-header__left${showBack ? '' : ' custom-header__left--placeholder'}`}
            onClick={showBack ? () => Taro.navigateBack() : undefined}
          >
            {showBack ? (
              <View className='custom-header__back-btn'>
                <Image className='custom-header__back-icon' src={backIcon} mode='aspectFit' />
              </View>
            ) : null}
          </View>
          <View className='custom-header__center'>
            {iconSrc ? <Image className='custom-header__icon' src={iconSrc} mode='aspectFit' /> : null}
            <Text className='custom-header__title'>{title}</Text>
          </View>
          <View className='custom-header__right' />
        </View>
      </View>
      {!overlay ? (
        <View className='custom-header__spacer' style={{ height: `${totalHeight}px` }} />
      ) : null}
    </>
  )
}

