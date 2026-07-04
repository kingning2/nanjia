import { Tabs as NutTabs } from '@nutui/nutui-react-taro'
import { TabItem } from '../../types/project'
import './index.scss'

interface TabsProps {
  value: string
  items: TabItem[]
  onChange: (value: string) => void
}

export default function Tabs({ value, items, onChange }: TabsProps) {
  return (
    <NutTabs value={value} onChange={(next) => onChange(String(next))}>
      {items.map((item) => (
        <NutTabs.TabPane title={item.name} paneKey={item.id} key={item.id} />
      ))}
    </NutTabs>
  )
}
