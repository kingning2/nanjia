import { Image, View } from '@tarojs/components'
import { useMemo } from 'react'
import { sortByOrder } from '@share/types/content'
import type { HomeImageItem } from '../../types/project'
import './index.scss'

interface HomeImageGalleryProps {
  items?: HomeImageItem[]
  onMediaLoaded?: () => void
}

export default function HomeImageGallery({ items = [], onMediaLoaded }: HomeImageGalleryProps) {
  const images = useMemo(
    () => sortByOrder(items.filter((item) => item.imageUrl?.trim())),
    [items]
  )

  if (!images.length) {
    return null
  }

  return (
    <View className='home-image-gallery'>
      {images.map((item, index) => {
        const isLast = index === images.length - 1
        return (
          <View key={`${item.sort}-${item.imageUrl}-${index}`} className='home-image-gallery__row'>
            <Image
              className='home-image-gallery__item'
              src={item.imageUrl}
              mode='widthFix'
              onLoad={onMediaLoaded}
              onError={onMediaLoaded}
            />
            {!isLast ? (
              <View className='home-image-gallery__separator' aria-hidden>
                <View className='home-image-gallery__separator-line' />
                <View className='home-image-gallery__separator-ornament'>
                  <View className='home-image-gallery__separator-dot' />
                </View>
                <View className='home-image-gallery__separator-line' />
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
