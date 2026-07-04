import SortableImageList from '../SortableImageList'
import type { MaterialDetailImageDTO } from '@share/types/content'

interface SortableDetailImagesProps {
  value?: MaterialDetailImageDTO[]
  onChange?: (value: MaterialDetailImageDTO[]) => void
}

/** 素材详情配图：左轮播预览 + 右列表上传（弹窗内延迟上传） */
export default function SortableDetailImages({ value, onChange }: SortableDetailImagesProps) {
  return (
    <SortableImageList
      value={value}
      onChange={onChange}
      uploadPrefix='material-details/images'
      layout='carousel'
      multiple
      showManualRow={false}
    />
  )
}