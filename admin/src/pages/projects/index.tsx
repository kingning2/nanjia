import { PlusOutlined } from '@ant-design/icons'
import { PageContainer } from '@ant-design/pro-components'
import { Button } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { CategoryDTO, ProjectDTO } from '@share/types/content'
import { sortByOrder } from '@share/types/content'
import ContentCard from '../../components/ContentCard'
import ContentCardList from '../../components/ContentCardList'
import { swapAdjacentSort } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import { deleteProject, getCategory, listProjects, saveProject } from '../../services/content'

export default function ProjectsPage() {
  const { categoryId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [items, setItems] = useState<ProjectDTO[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listProjects(categoryId)
      setItems(sortByOrder(data))
    } catch {
      // 错误已由 invoke 层 message 提示
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    void getCategory(categoryId)
      .then(setCategory)
      .catch(() => undefined)
  }, [categoryId])

  useEffect(() => {
    void reload()
  }, [reload])

  const moveItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      const pair = swapAdjacentSort(items, index, direction)
      if (!pair) return
      try {
        await saveProject({ ...pair.current, sort: pair.neighbor.sort })
        await saveProject({ ...pair.neighbor, sort: pair.current.sort })
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
      title='项目管理'
      subTitle={category ? `所属分类：${category.name}` : undefined}
      breadcrumb={{
        items: [
          { title: <Link to='/categories'>分类</Link> },
          { title: category?.name ?? categoryId }
        ]
      }}
      onBack={() => navigate('/categories')}
      extra={
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() => navigate(`/categories/${categoryId}/projects/new`)}
        >
          新建项目
        </Button>
      }
    >
      <ContentCardList
        loading={loading}
        empty={!loading && items.length === 0}
        emptyDescription='这个分类暂时没有项目'
      >
        {sortedItems.map((item, index) => (
          <ContentCard
            key={item.id}
            title={item.title}
            cover={item.cover}
            desc={item.desc || '暂未提供项目描述'}
            sort={item.sort}
            published={item.published}
            enterLabel='素材卡片'
            onEnter={() => navigate(`/categories/${categoryId}/projects/${item.id}/cards`)}
            onEdit={() => navigate(`/categories/${categoryId}/projects/${item.id}/edit`)}
            onDelete={async () => {
              try {
                await deleteProject(item.id)
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
            deleteConfirmTitle='删除项目将级联删除下级内容'
          />
        ))}
      </ContentCardList>
    </PageContainer>
  )
}
