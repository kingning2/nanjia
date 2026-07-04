import { Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import React, { useEffect, useMemo, useState } from 'react'
import './index.scss'

interface LazyImageProps {
  src: string
  alt?: string
  className?: string
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix'
  /** width / height，用于占位比例，避免等高 */
  ratio?: number
  /** ScrollView 等滚动容器选择器，用于相对容器懒加载 */
  observeRoot?: string
}

export default function LazyImage({
  src,
  className = '',
  mode = 'aspectFill',
  ratio,
  observeRoot
}: LazyImageProps) {
  void React
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const observerId = useMemo(
    () => `lazy-image-${Math.random().toString(36).slice(2, 10)}`,
    []
  )

  useEffect(() => {
    if (visible) return
    setLoaded(false)

    if (typeof Taro.createIntersectionObserver !== 'function') {
      setVisible(true)
      return
    }

    const observer = (Taro.createIntersectionObserver as unknown as (options?: unknown) => any)()
    if (observeRoot) {
      observer.relativeTo(observeRoot, { bottom: 120 })
    } else {
      observer.relativeToViewport({ bottom: 100 })
    }
    observer.observe(`#${observerId}`, (res: { intersectionRatio?: number }) => {
      if ((res.intersectionRatio ?? 0) > 0) {
        setVisible(true)
        observer.disconnect()
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [observerId, visible, observeRoot])

  return (
    <View
      id={observerId}
      className={`lazy-image lazy-image--${mode} ${className}`}
    >
      {visible ? (
        <Image
          className={`lazy-image__img ${loaded ? 'lazy-image__img--loaded' : ''}`}
          src={src}
          mode={mode}
          lazyLoad
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : null}
      <View className={`lazy-image__placeholder ${loaded ? 'lazy-image__placeholder--hidden' : ''}`}>
        {mode === 'widthFix' && !loaded ? (
          <View
            className='lazy-image__sizer'
            style={{
              paddingTop: `${(1 / (ratio && ratio > 0 ? ratio : 1)) * 100}%`
            }}
          />
        ) : null}
      </View>
    </View>
  )
}
