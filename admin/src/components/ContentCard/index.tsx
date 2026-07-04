import { EditOutlined, ArrowDownOutlined, ArrowUpOutlined, RightOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Space, Tag, Typography } from 'antd'
import type { ReactNode } from 'react'
import CloudImage from '../CloudImage'
import styles from './index.module.css'

export interface ContentCardProps {
  title: string
  cover?: string
  showCover?: boolean
  desc?: string
  sort?: number
  published?: boolean
  tags?: ReactNode
  enterLabel?: string
  onEnter?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  disableMoveUp?: boolean
  disableMoveDown?: boolean
  deleteConfirmTitle?: string
  onClick?: () => void
}

export default function ContentCard({
  title,
  cover,
  showCover = true,
  desc,
  sort,
  published,
  tags,
  enterLabel,
  onEnter,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  deleteConfirmTitle = '确认删除？',
  onClick
}: ContentCardProps) {
  const clickable = Boolean(onClick ?? onEnter)
  const handleCardClick = onClick ?? onEnter

  const stop = (event: React.MouseEvent) => {
    event.stopPropagation()
  }

  return (
    <article
      className={`${styles.card} ${clickable ? styles.cardClickable : ''}`}
      onClick={clickable ? handleCardClick : undefined}
    >
      {showCover ? (
        <div className={styles.cover}>
          {cover ? (
            <CloudImage
              src={cover}
              alt={title}
              width='100%'
              height={160}
              style={{ objectFit: 'cover' }}
              preview={false}
            />
          ) : (
            <div className={styles.coverPlaceholder}>暂无封面</div>
          )}
        </div>
      ) : null}

      <div className={styles.body}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          {enterLabel && onEnter ? (
            <Typography.Link
              onClick={(event) => {
                event.stopPropagation()
                onEnter()
              }}
            >
              {enterLabel}
              <RightOutlined style={{ marginLeft: 4, fontSize: 12 }} />
            </Typography.Link>
          ) : null}
        </div>

        {desc ? <p className={styles.desc}>{desc}</p> : null}

        <div className={styles.meta}>
          {typeof sort === 'number' ? <Tag>排序 {sort}</Tag> : null}
          {typeof published === 'boolean' ? (
            <Tag color={published ? 'success' : 'default'}>
              {published ? '已展示' : '未展示'}
            </Tag>
          ) : null}
          {tags}
        </div>

        {(onMoveUp || onMoveDown || onEdit || onDelete) && (
          <div className={styles.actions} onClick={stop}>
            <Space size='middle' wrap>
              {onMoveUp || onMoveDown ? (
                <Space size={4}>
                  {onMoveUp ? (
                    <Button
                      size='small'
                      icon={<ArrowUpOutlined />}
                      disabled={disableMoveUp}
                      onClick={onMoveUp}
                    />
                  ) : null}
                  {onMoveDown ? (
                    <Button
                      size='small'
                      icon={<ArrowDownOutlined />}
                      disabled={disableMoveDown}
                      onClick={onMoveDown}
                    />
                  ) : null}
                </Space>
              ) : null}
              {onEdit ? (
                <Typography.Link onClick={onEdit}>
                  <EditOutlined /> 编辑
                </Typography.Link>
              ) : null}
              {onDelete ? (
                <Popconfirm title={deleteConfirmTitle} onConfirm={onDelete}>
                  <Typography.Link type='danger'>删除</Typography.Link>
                </Popconfirm>
              ) : null}
            </Space>
          </div>
        )}
      </div>
    </article>
  )
}
