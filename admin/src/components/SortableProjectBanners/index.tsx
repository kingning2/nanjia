import SortableImageList from '../SortableImageList'
import type { MaterialDetailImageDTO } from '@share/types/content'

interface SortableProjectBannersProps {
  value?: MaterialDetailImageDTO[]
  onChange?: (value: MaterialDetailImageDTO[]) => void
}

/** 项目详情页顶部广告轮播：左预览 + 右列表 */
export default function SortableProjectBanners({ value, onChange }: SortableProjectBannersProps) {
  return (
    <SortableImageList
      value={value}
      onChange={onChange}
      uploadPrefix='projects/banners'
      layout='carousel'
      multiple
      showManualRow={false}
      draggerTitle='添加广告图'
    />
  )
}
