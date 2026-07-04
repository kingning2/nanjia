import { View } from '@tarojs/components'
import { Loading } from '@nutui/nutui-react-taro'
import { ProjectCardItem } from '../../types/project'
import AppEmpty from '../app-empty'
import LazyImage from '../lazy-image'
import './index.scss'

interface CardListProps {
  list: ProjectCardItem[]
  loading: boolean
  hasMore: boolean
  onCardClick: (id: string) => void
}

export default function CardList({
  list,
  loading,
  hasMore,
  onCardClick
}: CardListProps) {
  if (!loading && list.length === 0) {
    return (
      <View className='card-list card-list--empty'>
        <AppEmpty description='这个分类暂时没有素材' />
      </View>
    )
  }

  return (
    <View className='card-list'>
      <View className='card-list__grid'>
        {list.map((item) => (
          <View
            key={item.id}
            className='card-list__item'
            onClick={() => onCardClick(item.id)}
          >
            <LazyImage
              src={item.cover}
              alt={item.title}
              className='card-list__image'
              mode='aspectFill'
            />
          </View>
        ))}
      </View>
      <View className='card-list__footer'>
        {loading && <Loading type='circular'>加载中...</Loading>}
        {!loading && !hasMore && list.length > 0 && <View>已经到底了</View>}
      </View>
    </View>
  )
}
