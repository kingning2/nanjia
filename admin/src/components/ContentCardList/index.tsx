import { Empty, Spin } from 'antd'
import type { ReactNode } from 'react'
import styles from './index.module.css'

interface ContentCardListProps {
  loading?: boolean
  empty?: boolean
  emptyDescription?: string
  children: ReactNode
}

export default function ContentCardList({
  loading = false,
  empty = false,
  emptyDescription = '暂无内容',
  children
}: ContentCardListProps) {
  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin tip='加载中…' />
      </div>
    )
  }

  if (empty) {
    return (
      <div className={styles.empty}>
        <Empty description={emptyDescription} />
      </div>
    )
  }

  return <div className={styles.list}>{children}</div>
}
