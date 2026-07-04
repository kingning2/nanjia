import { Tabs as NutTabs } from '@nutui/nutui-react-taro'
import { View } from '@tarojs/components'
import { TabItem } from '../../types/project'
import './index.scss'

interface HomeLevelTabsProps {
  categories: TabItem[]
  activeCategoryId: string
  onCategoryChange: (id: string) => void
  projects: TabItem[]
  activeProjectId: string
  onProjectChange: (id: string) => void
}

export default function HomeLevelTabs({
  categories,
  activeCategoryId,
  onCategoryChange,
  projects,
  activeProjectId,
  onProjectChange
}: HomeLevelTabsProps) {
  if (!categories.length) {
    return null
  }

  return (
    <View className='home-level-tabs'>
      <NutTabs
        className='home-level-tabs__l1'
        value={activeCategoryId}
        activeType='line'
        onChange={(next) => onCategoryChange(String(next))}
      >
        {categories.map((item) => (
          <NutTabs.TabPane title={item.name} paneKey={item.id} key={item.id} />
        ))}
      </NutTabs>
      {projects.length > 0 ? (
        <NutTabs
          className='home-level-tabs__l2'
          value={activeProjectId}
          activeType='button'
          onChange={(next) => onProjectChange(String(next))}
        >
          {projects.map((item) => (
            <NutTabs.TabPane title={item.name} paneKey={item.id} key={item.id} />
          ))}
        </NutTabs>
      ) : null}
    </View>
  )
}
