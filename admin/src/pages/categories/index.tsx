import { PlusOutlined } from '@ant-design/icons'
import { PageContainer } from '@ant-design/pro-components'
import { Button } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CategoryDTO } from '@share/types/content'
import { sortByOrder } from '@share/types/content'
import ContentCard from '../../components/ContentCard'
import ContentCardList from '../../components/ContentCardList'
import { swapAdjacentSort } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import { deleteCategory, listCategories, saveCategory } from '../../services/content'

export default function CategoriesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<CategoryDTO[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listCategories()
      setItems(sortByOrder(data))
    } catch {
      // 错误已由 invoke 层 message 提示
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const moveItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      const pair = swapAdjacentSort(items, index, direction)
      if (!pair) return
      try {
        await saveCategory({ ...pair.current, sort: pair.neighbor.sort })
        await saveCategory({ ...pair.neighbor, sort: pair.current.sort })
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
      title='分类管理'
      subTitle='与小程序首页分类 Tab 同级，下方为项目图片'
      extra={
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() => navigate('/categories/new')}
        >
          新建分类
        </Button>
      }
    >
      <ContentCardList
        loading={loading}
        empty={!loading && items.length === 0}
        emptyDescription='还没有分类，点击右上角新建'
      >
        {sortedItems.map((item, index) => (
          <ContentCard
            key={item.id}
            title={item.name}
            showCover={false}
            desc={item.desc || '暂无描述'}
            sort={item.sort}
            published={item.published}
            enterLabel='进入项目'
            onEnter={() => navigate(`/categories/${item.id}/projects`)}
            onEdit={() => navigate(`/categories/${item.id}/edit`)}
            onDelete={async () => {
              try {
                await deleteCategory(item.id)
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
            deleteConfirmTitle='删除分类将级联删除下级内容'
          />
        ))}
      </ContentCardList>
    </PageContainer>
  )
}
