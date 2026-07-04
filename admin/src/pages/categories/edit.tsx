import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import type { CategoryDTO } from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { notifySuccess } from '../../utils/feedback'
import { getCategory, saveCategory } from '../../services/content'
import CategoryFields from './fields'

export default function CategoryEditPage() {
  const { categoryId = '' } = useParams()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<CategoryDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void getCategory(categoryId)
      .then((item) => setEditing(item ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [categoryId])

  const back = useCallback(() => navigate('/categories'), [navigate])

  if (loading || !editing) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip='加载中…' />
      </div>
    )
  }

  return (
    <ContentFormPage<CategoryDTO>
      title='编辑分类'
      breadcrumb={{
        items: [{ title: <Link to='/categories'>分类</Link> }, { title: editing.name }]
      }}
      onBack={back}
      initialValues={editing}
      onFinish={async (values) => {
        try {
          await saveCategory({
            id: editing.id,
            name: values.name,
            titleEn: values.titleEn,
            titleZh: values.titleZh,
            desc: values.desc,
            sort: editing.sort,
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
