import { Text } from '@tarojs/components'
import { ProductCategoryItem } from '../../types/product'

export function categoryTitleZh(category: ProductCategoryItem) {
  return category.titleZh || category.name
}

export default function CatalogSectionHead({ category }: { category: ProductCategoryItem }) {
  return (
    <>
      {category.titleEn ? (
        <Text className='catalog-section__title-en'>{category.titleEn}</Text>
      ) : null}
      <Text className='catalog-section__title-zh'>{categoryTitleZh(category)}</Text>
      {category.desc ? (
        <Text className='catalog-section__desc'>{category.desc}</Text>
      ) : null}
    </>
  )
}
