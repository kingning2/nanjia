import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spin } from 'antd'
import type {
  CategoryDTO,
  MaterialCardDTO,
  MaterialDetailDTO,
  ProjectDTO
} from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { notifySuccess } from '../../utils/feedback'
import {
  getCategory,
  getMaterialCard,
  getMaterialDetail,
  getProject,
  saveMaterialDetail
} from '../../services/content'
import MaterialDetailFields from './fields'

export default function MaterialDetailEditPage() {
  const {
    categoryId = '',
    projectId = '',
    cardId = '',
    detailId = ''
  } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [project, setProject] = useState<ProjectDTO | undefined>()
  const [card, setCard] = useState<MaterialCardDTO | undefined>()
  const [editing, setEditing] = useState<MaterialDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
    void getProject(projectId)
      .then(setProject)
      .catch(() => undefined)
    void getMaterialCard(cardId)
      .then(setCard)
      .catch(() => undefined)
  }, [categoryId, projectId, cardId])

  useEffect(() => {
    setLoading(true)
    void getMaterialDetail(detailId)
      .then((item) => setEditing(item ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [detailId])

  const back = useCallback(
    () => navigate(`/categories/${categoryId}/projects/${projectId}/cards/${cardId}/details`),
    [cardId, categoryId, navigate, projectId]
  )

  if (loading || !editing) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin tip='加载中…' />
      </div>
    )
  }

  return (
    <ContentFormPage<MaterialDetailDTO>
      title='编辑素材详情'
      subTitle={card ? `所属卡片：${card.title}` : undefined}
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
          {
            title: (
              <Link
                to={`/categories/${categoryId}/projects/${projectId}/cards/${cardId}/details`}
              >
                {card?.title ?? cardId}
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
          await saveMaterialDetail({
            id: editing.id,
            cardId,
            title: values.title,
            content: values.content,
            media: values.media ?? [],
            sort: editing.sort
          })
          notifySuccess('保存成功')
          back()
          return true
        } catch {
          return false
        }
      }}
    >
      <MaterialDetailFields />
    </ContentFormPage>
  )
}
