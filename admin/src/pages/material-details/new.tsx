import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  CategoryDTO,
  MaterialCardDTO,
  MaterialDetailDTO,
  ProjectDTO
} from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { nextSortValue } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import {
  getCategory,
  getMaterialCard,
  getProject,
  listMaterialDetails,
  saveMaterialDetail
} from '../../services/content'
import MaterialDetailFields from './fields'

export default function MaterialDetailNewPage() {
  const { categoryId = '', projectId = '', cardId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [project, setProject] = useState<ProjectDTO | undefined>()
  const [card, setCard] = useState<MaterialCardDTO | undefined>()
  const [items, setItems] = useState<MaterialDetailDTO[]>([])

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
    void listMaterialDetails(cardId)
      .then(setItems)
      .catch(() => undefined)
  }, [categoryId, projectId, cardId])

  const back = useCallback(
    () => navigate(`/categories/${categoryId}/projects/${projectId}/cards/${cardId}/details`),
    [cardId, categoryId, navigate, projectId]
  )

  return (
    <ContentFormPage<MaterialDetailDTO>
      title='新建素材详情'
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
          { title: '新建详情' }
        ]
      }}
      onBack={back}
      initialValues={{ content: '', images: [] }}
      onFinish={async (values) => {
        try {
          await saveMaterialDetail({
            cardId,
            title: values.title,
            content: values.content,
            images: values.images ?? [],
            sort: nextSortValue(items)
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
