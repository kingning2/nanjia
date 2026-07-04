import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { CategoryDTO, ProjectDTO } from '@share/types/content'
import ContentFormPage from '../../components/ContentFormPage'
import { nextSortValue } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import { getCategory, listProjects, saveProject } from '../../services/content'
import ProjectFields from './fields'

export default function ProjectNewPage() {
  const { categoryId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [items, setItems] = useState<ProjectDTO[]>([])

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
    void listProjects(categoryId)
      .then(setItems)
      .catch(() => undefined)
  }, [categoryId])

  const back = useCallback(
    () => navigate(`/categories/${categoryId}/projects`),
    [categoryId, navigate]
  )

  return (
    <ContentFormPage<ProjectDTO>
      title='新建项目'
      subTitle={category ? `所属分类：${category.name}` : undefined}
      breadcrumb={{
        items: [
          { title: <Link to='/categories'>分类</Link> },
          {
            title: <Link to={`/categories/${categoryId}/projects`}>{category?.name ?? categoryId}</Link>
          },
          { title: '新建项目' }
        ]
      }}
      onBack={back}
      initialValues={{ published: true, cover: '', images: [] }}
      onFinish={async (values) => {
        try {
          await saveProject({
            categoryId,
            title: values.title,
            cover: values.cover,
            images: values.images ?? [],
            desc: values.desc,
            price: values.price,
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
      <ProjectFields />
    </ContentFormPage>
  )
}
