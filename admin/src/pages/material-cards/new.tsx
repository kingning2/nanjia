import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { CategoryDTO, MaterialCardDTO, ProjectDTO } from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { nextSortValue } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import {
  getCategory,
  getProject,
  listMaterialCards,
  saveMaterialCard
} from '../../services/content'
import MaterialCardFields from './fields'

export default function MaterialCardNewPage() {
  const { categoryId = '', projectId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [project, setProject] = useState<ProjectDTO | undefined>()
  const [items, setItems] = useState<MaterialCardDTO[]>([])

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
    void getProject(projectId)
      .then(setProject)
      .catch(() => undefined)
    void listMaterialCards(projectId)
      .then(setItems)
      .catch(() => undefined)
  }, [categoryId, projectId])

  const back = useCallback(
    () => navigate(`/categories/${categoryId}/projects/${projectId}/cards`),
    [categoryId, navigate, projectId]
  )

  return (
    <ContentFormPage<MaterialCardDTO>
      title='新建素材卡片'
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
          { title: '新建卡片' }
        ]
      }}
      onBack={back}
      initialValues={{ published: true, cover: '' }}
      onFinish={async (values) => {
        try {
          await saveMaterialCard({
            projectId,
            title: values.title,
            cover: values.cover,
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
      <MaterialCardFields />
    </ContentFormPage>
  )
}
