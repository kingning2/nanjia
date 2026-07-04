import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import type { CategoryDTO, MaterialCardDTO, ProjectDTO } from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { notifySuccess } from '../../utils/feedback'
import {
  getCategory,
  getMaterialCard,
  getProject,
  saveMaterialCard
} from '../../services/content'
import MaterialCardFields from './fields'

export default function MaterialCardEditPage() {
  const { categoryId = '', projectId = '', cardId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [project, setProject] = useState<ProjectDTO | undefined>()
  const [editing, setEditing] = useState<MaterialCardDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
    void getProject(projectId)
      .then(setProject)
      .catch(() => undefined)
  }, [categoryId, projectId])

  useEffect(() => {
    setLoading(true)
    void getMaterialCard(cardId)
      .then((item) => setEditing(item ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [cardId])

  const back = useCallback(
    () => navigate(`/categories/${categoryId}/projects/${projectId}/cards`),
    [categoryId, navigate, projectId]
  )

  if (loading || !editing) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip='加载中…' />
      </div>
    )
  }

  return (
    <ContentFormPage<MaterialCardDTO>
      title='编辑素材卡片'
      subTitle={project ? `所属项目：${project.title}` : undefined}
      breadcrumb={{
        items: [
          { title: <Link to='/categories'>分类</Link> },
          {
            title: <Link to={`/categories/${categoryId}/projects`}>{category?.name ?? categoryId}</Link>
          },
          {
            title: (
              <Link to={`/categories/${categoryId}/projects/${projectId}/cards`}>
                {project?.title ?? projectId}
              </Link>
            )
          },
          { title: editing.title }
        ]
      }}
      onBack={back}
      initialValues={editing}
      onFinish={async (values) => {
        try {
          await saveMaterialCard({
            id: editing.id,
            projectId,
            title: values.title,
            cover: values.cover,
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
      <MaterialCardFields />
    </ContentFormPage>
  )
}
