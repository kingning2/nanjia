import { Image, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import homeActiveIcon from '@/assets/tabbar/home-active.svg'
import homeIcon from '@/assets/tabbar/home.svg'
import orderActiveIcon from '@/assets/tabbar/order-active.svg'
import orderIcon from '@/assets/tabbar/order.svg'
import xiaohongshuActiveIcon from '@/assets/tabbar/xiaohongshu-active.svg'
import xiaohongshuIcon from '@/assets/tabbar/xiaohongshu.svg'
import douyinActiveIcon from '@/assets/tabbar/douyin-active.svg'
import douyinIcon from '@/assets/tabbar/douyin.svg'
import './index.scss'

const ROUTES = [
  { path: 'pages/home/index', icon: homeIcon, activeIcon: homeActiveIcon },
  { path: 'pages/products/index', icon: orderIcon, activeIcon: orderActiveIcon },
  {
    path: 'pages/xiaohongshu/index',
    icon: xiaohongshuIcon,
    activeIcon: xiaohongshuActiveIcon
  },
  { path: 'pages/douyin/index', icon: douyinIcon, activeIcon: douyinActiveIcon }
] as const

function getActiveIndex(): number {
  const pages = Taro.getCurrentPages()
  const route = pages[pages.length - 1]?.route || ''
  const index = ROUTES.findIndex((item) => route.includes(item.path))
  return index >= 0 ? index : 0
}

export default function RouteTabbar() {
  const [selected, setSelected] = useState(getActiveIndex)

  useDidShow(() => {
    setSelected(getActiveIndex())
  })

  const switchTab = (index: number) => {
    const target = ROUTES[index]
    if (!target || index === selected) return
    setSelected(index)
    Taro.reLaunch({ url: `/${target.path}` })
  }

  return (
    <View className='route-tabbar'>
      <View className='route-tabbar__pill'>
        {ROUTES.map((item, index) => {
          const active = index === selected
          return (
            <View
              key={item.path}
              className={`route-tabbar__item${active ? ' route-tabbar__item--active' : ''}`}
              onClick={() => switchTab(index)}
            >
              <Image
                className='route-tabbar__icon'
                src={active ? item.activeIcon : item.icon}
                mode='aspectFit'
              />
            </View>
          )
        })}
      </View>
    </View>
  )
}
