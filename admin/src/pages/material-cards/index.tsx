import { PlusOutlined } from '@ant-design/icons'
import { PageContainer } from '@ant-design/pro-components'
import { Button } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { CategoryDTO, MaterialCardDTO, ProjectDTO } from '@share/types/content'
import { sortByOrder } from '@share/types/content'
import ContentCard from '../../components/ContentCard'
import ContentCardList from '../../components/ContentCardList'
import { swapAdjacentSort } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import {
  deleteMaterialCard,
  getCategory,
  getProject,
  listMaterialCards,
  saveMaterialCard
} from '../../services/content'

export default function MaterialCardsPage() {
  const { categoryId = '', projectId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [project, setProject] = useState<ProjectDTO | undefined>()
  const [items, setItems] = useState<MaterialCardDTO[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listMaterialCards(projectId)
      setItems(sortByOrder(data))
    } catch {
      // 错误已由 invoke 层 message 提示
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
    void getProject(projectId)
      .then(setProject)
      .catch(() => undefined)
  }, [categoryId, projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const moveItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      const pair = swapAdjacentSort(items, index, direction)
      if (!pair) return
      try {
        await saveMaterialCard({ ...pair.current, sort: pair.neighbor.sort })
        await saveMaterialCard({ ...pair.neighbor, sort: pair.current.sort })
        notifySuccess('排序已更新')
        await reload()
      } catch {
        // 错误已由 invoke 层 message 提示
      }
    },
    [items, reload]
  )

  const sortedItems = sortByOrder(items)

  return (
    <PageContainer
      title='素材卡片'
      subTitle={project ? `所属项目：${project.title}` : undefined}
      breadcrumb={{
        items: [
          { title: <Link to='/categories'>分类</Link> },
          {
            title: <Link to={`/categories/${categoryId}/projects`}>{category?.name ?? categoryId}</Link>
          },
          { title: project?.title ?? projectId }
        ]
      }}
      onBack={() => navigate(`/categories/${categoryId}/projects`)}
      extra={
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() =>
            navigate(`/categories/${categoryId}/projects/${projectId}/cards/new`)
          }
        >
          新建卡片
        </Button>
      }
    >
      <ContentCardList
        loading={loading}
        empty={!loading && items.length === 0}
        emptyDescription='这个项目暂时没有素材卡片'
      >
        {sortedItems.map((item, index) => (
          <ContentCard
            key={item.id}
            title={item.title}
            cover={item.cover}
            sort={item.sort}
            published={item.published}
            enterLabel='素材详情'
            onEnter={() =>
              navigate(
                `/categories/${categoryId}/projects/${projectId}/cards/${item.id}/details`
              )
            }
            onEdit={() =>
              navigate(
                `/categories/${categoryId}/projects/${projectId}/cards/${item.id}/edit`
              )
            }
            onDelete={async () => {
              try {
                await deleteMaterialCard(item.id)
                notifySuccess('已删除')
                await reload()
              } catch {
                // 错误已由 invoke 层 message 提示
              }
            }}
            onMoveUp={() => void moveItem(index, -1)}
            onMoveDown={() => void moveItem(index, 1)}
            disableMoveUp={index === 0}
            disableMoveDown={index === sortedItems.length - 1}
            deleteConfirmTitle='删除卡片将级联删除下级详情'
          />
        ))}
      </ContentCardList>
    </PageContainer>
  )
}
