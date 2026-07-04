import { Image, View } from '@tarojs/components'
import { Empty } from '@nutui/nutui-react-taro'
import type { ReactNode } from 'react'
import emptyIcon from '@/assets/icons/empty.svg'
import './index.scss'

interface AppEmptyProps {
  description?: ReactNode
  title?: ReactNode
  className?: string
  imageSize?: number | string
}

export default function AppEmpty({
  description,
  title,
  className,
  imageSize = 120
}: AppEmptyProps) {
  return (
    <Empty
      className={className ? `app-empty ${className}` : 'app-empty'}
      title={title}
      description={description}
      imageSize={imageSize}
      image={
        <View className='app-empty__icon-wrap'>
          <Image className='app-empty__icon' src={emptyIcon} mode='aspectFit' />
        </View>
      }
    />
  )
}
