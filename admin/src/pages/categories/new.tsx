import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { CategoryDTO } from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { nextSortValue } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import { listCategories, saveCategory } from '../../services/content'
import CategoryFields from './fields'

export default function CategoryNewPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<CategoryDTO[]>([])

  useEffect(() => {
    void listCategories()
      .then(setItems)
      .catch(() => undefined)
  }, [])

  const back = useCallback(() => navigate('/categories'), [navigate])

  return (
    <ContentFormPage<CategoryDTO>
      title='新建分类'
      breadcrumb={{
        items: [{ title: <Link to='/categories'>分类</Link> }, { title: '新建分类' }]
      }}
      onBack={back}
      initialValues={{ published: true }}
      onFinish={async (values) => {
        try {
          await saveCategory({
            name: values.name,
            titleEn: values.titleEn,
            titleZh: values.titleZh,
            desc: values.desc,
            sort: nextSortValue(items),
            published: values.published
          })
          notifySuccess('保存成功')
          back()
          return true
        } catch {
          return false
        }
      }}
    >
      <CategoryFields />
    </ContentFormPage>
  )
}
