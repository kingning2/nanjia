import SortableImageList from '../SortableImageList'
import type { MaterialDetailImageDTO } from '@share/types/content'

interface SortableHomeImagesProps {
  value?: MaterialDetailImageDTO[]
  onChange?: (value: MaterialDetailImageDTO[]) => void
  uploadPrefix?: string
  draggerTitle?: string
}

/** 首页展示配图：无数量上限，左预览 + 右列表 */
export default function SortableHomeImages({
  value,
  onChange,
  uploadPrefix = 'home-settings/images',
  draggerTitle = '添加首页配图'
}: SortableHomeImagesProps) {
  return (
    <SortableImageList
      value={value}
      onChange={onChange}
      uploadPrefix={uploadPrefix}
      layout='carousel'
      multiple
      showManualRow={false}
      draggerTitle={draggerTitle}
    />
  )
}
