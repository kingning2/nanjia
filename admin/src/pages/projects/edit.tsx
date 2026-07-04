import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import type { CategoryDTO, ProjectDTO } from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { notifySuccess } from '../../utils/feedback'
import { getCategory, getProject, saveProject } from '../../services/content'
import ProjectFields from './fields'

export default function ProjectEditPage() {
  const { categoryId = '', projectId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [editing, setEditing] = useState<ProjectDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
  }, [categoryId])

  useEffect(() => {
    setLoading(true)
    void getProject(projectId)
      .then((item) => setEditing(item ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [projectId])

  const back = useCallback(
    () => navigate(`/categories/${categoryId}/projects`),
    [categoryId, navigate]
  )

  if (loading || !editing) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip='加载中…' />
      </div>
    )
  }

  return (
    <ContentFormPage<ProjectDTO>
      title='编辑项目'
      subTitle={category ? `所属分类：${category.name}` : undefined}
      breadcrumb={{
        items: [
          { title: <Link to='/categories'>分类</Link> },
          {
            title: <Link to={`/categories/${categoryId}/projects`}>{category?.name ?? categoryId}</Link>
          },
          { title: editing.title }
        ]
      }}
      onBack={back}
      initialValues={editing}
      onFinish={async (values) => {
        try {
          await saveProject({
            id: editing.id,
            categoryId,
            title: values.title,
            cover: values.cover,
            images: values.images ?? [],
            desc: values.desc,
            price: values.price,
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
      <ProjectFields />
    </ContentFormPage>
  )
}
