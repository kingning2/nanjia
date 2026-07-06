import { PlusOutlined } from '@ant-design/icons'
import { PageContainer } from '@ant-design/pro-components'
import { Button, Tag } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  CategoryDTO,
  MaterialCardDTO,
  MaterialDetailDTO,
  ProjectDTO
} from '@share/types/content'
import { sortByOrder, sortDetailMedia } from '@share/types/content'
import ContentCard from '../../components/ContentCard'
import ContentCardList from '../../components/ContentCardList'
import { swapAdjacentSort } from '../../utils/contentSort'
import { notifySuccess } from '../../utils/feedback'
import {
  deleteMaterialDetail,
  getCategory,
  getMaterialCard,
  getProject,
  listMaterialDetails,
  saveMaterialDetail
} from '../../services/content'

function detailCover(detail: MaterialDetailDTO): string | undefined {
  const media = sortDetailMedia(detail.media ?? [])
  return media.find((item) => item.type === 'image')?.src
}

function detailMediaTags(detail: MaterialDetailDTO): string {
  const media = sortDetailMedia(detail.media ?? [])
  const images = media.filter((item) => item.type === 'image').length
  const videos = media.filter((item) => item.type === 'video').length
  const parts: string[] = []
  if (images > 0) parts.push(`配图 ${images}`)
  if (videos > 0) parts.push(`视频 ${videos}`)
  return parts.join(' · ') || '无媒体'
}

function detailDesc(detail: MaterialDetailDTO): string {
  const text = detail.content.trim()
  if (!text) return '暂无正文'
  return text.length > 120 ? `${text.slice(0, 120)}…` : text
}

export default function MaterialDetailsPage() {
  const { categoryId = '', projectId = '', cardId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<CategoryDTO | undefined>()
  const [project, setProject] = useState<ProjectDTO | undefined>()
  const [card, setCard] = useState<MaterialCardDTO | undefined>()
  const [items, setItems] = useState<MaterialDetailDTO[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listMaterialDetails(cardId)
      setItems(sortByOrder(data))
    } catch {
      // 错误已由 invoke 层 message 提示
    } finally {
      setLoading(false)
    }
  }, [cardId])

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
    void reload()
  }, [reload])

  const editPath = (detailId: string) =>
    `/categories/${categoryId}/projects/${projectId}/cards/${cardId}/details/${detailId}/edit`

  const moveItem = useCallback(
    async (index: number, direction: -1 | 1) => {
      const pair = swapAdjacentSort(items, index, direction)
      if (!pair) return
      try {
        await saveMaterialDetail({ ...pair.current, sort: pair.neighbor.sort })
        await saveMaterialDetail({ ...pair.neighbor, sort: pair.current.sort })
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
      title='素材详情'
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
          { title: card?.title ?? cardId }
        ]
      }}
      onBack={() =>
        navigate(`/categories/${categoryId}/projects/${projectId}/cards`)
      }
      extra={
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={() =>
            navigate(
              `/categories/${categoryId}/projects/${projectId}/cards/${cardId}/details/new`
            )
          }
        >
          新建详情
        </Button>
      }
    >
      <ContentCardList
        loading={loading}
        empty={!loading && items.length === 0}
        emptyDescription='这张卡片暂时没有详情条目'
      >
        {sortedItems.map((item, index) => (
          <ContentCard
            key={item.id}
            title={item.title}
            cover={detailCover(item)}
            desc={detailDesc(item)}
            sort={item.sort}
            tags={<Tag color='blue'>{detailMediaTags(item)}</Tag>}
            onClick={() => navigate(editPath(item.id))}
            onEdit={() => navigate(editPath(item.id))}
            onDelete={async () => {
              try {
                await deleteMaterialDetail(item.id)
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
            deleteConfirmTitle='确认删除该详情？'
          />
        ))}
      </ContentCardList>
    </PageContainer>
  )
}
