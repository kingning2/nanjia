import { Text, View } from '@tarojs/components'
import { Tag } from '@nutui/nutui-react-taro'
import { ProjectCardItem } from '../../types/project'
import LazyImage from '../lazy-image'
import './index.scss'

interface CardProps {
  item: ProjectCardItem
  onClick?: (id: string) => void
}

export default function Card({ item, onClick }: CardProps) {
  return (
    <View className='card' onClick={() => onClick?.(item.id)}>
      <View className='card__cover'>
        <LazyImage src={item.cover} alt={item.title} />
      </View>
      <View className='card__content'>
        <Text className='card__title'>{item.title}</Text>
        <Text className='card__desc'>{item.desc}</Text>
        <View className='card__tags'>
          {item.tags.map((tag) => (
            <Tag key={tag} plain type='primary'>
              {tag}
            </Tag>
          ))}
        </View>
      </View>
    </View>
  )
}
