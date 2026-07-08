import { DeleteOutlined, FileImageOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { Button, Modal, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  MediaRedundancyItemDTO,
  MediaRedundancyReportDTO
} from '@share/types/sync'

const { Paragraph, Text } = Typography

type Props = {
  open: boolean
  report: MediaRedundancyReportDTO | null
  deleting?: boolean
  onClose: () => void
  onDeleteUnused?: () => void
}

export default function MediaRedundancyModal({
  open,
  report,
  deleting = false,
  onClose,
  onDeleteUnused
}: Props) {
  const columns: ColumnsType<MediaRedundancyItemDTO> = [
    {
      title: '核实',
      width: 108,
      render: (_, row) =>
        row.safeToDelete ? (
          <Tag color='success'>可删除</Tag>
        ) : (
          <Tag color='warning'>需确认</Tag>
        )
    },
    {
      title: '类型',
      width: 72,
      render: (_, row) =>
        row.kind === 'video' ? (
          <Tag icon={<VideoCameraOutlined />}>视频</Tag>
        ) : (
          <Tag icon={<FileImageOutlined />}>图片</Tag>
        )
    },
    {
      title: '原始文件名',
      width: 160,
      ellipsis: true,
      render: (_, row) => {
        const name = row.originalName?.trim()
        return name ? <Text>{name}</Text> : <Text type='secondary'>未记录</Text>
      }
    },
    {
      title: '云存储路径',
      ellipsis: true,
      render: (_, row) => (
        <Text copyable={{ text: row.cloudPath }} style={{ fontSize: 13 }}>
          {row.cloudPath}
        </Text>
      )
    }
  ]

  const hasIssues =
    report && (report.unusedCount > 0 || report.staleReferenceCount > 0)

  const safeUnusedCount = report?.safeUnusedCount ?? 0
  const suspectUnusedCount = report?.suspectUnusedCount ?? 0

  return (
    <Modal
      title='图片 / 视频检查结果'
      open={open}
      onCancel={onClose}
      centered
      footer={
        report && report.unusedCount > 0 && onDeleteUnused ? (
          <Button
            danger
            type='primary'
            icon={<DeleteOutlined />}
            loading={deleting}
            onClick={onDeleteUnused}
            disabled={safeUnusedCount === 0}
          >
            删除可安全清理的文件（{safeUnusedCount}）
          </Button>
        ) : null
      }
      width={820}
      destroyOnHidden
      styles={{
        content: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden'
        },
        header: { flexShrink: 0 },
        body: {
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 4
        },
        footer: { flexShrink: 0 }
      }}
    >
      {!report ? null : (
        <Space direction='vertical' size={16} style={{ width: '100%' }}>
          <Paragraph type='secondary' style={{ marginBottom: 0 }}>
            已扫描「{report.envName}」环境全部数据库集合（media_files 除外）。仅分析媒体库里登记过、且云路径有效的文件。
          </Paragraph>

          <Space size={32} wrap>
            <Statistic title='内容正在使用' value={report.referencedCount} suffix='个' />
            <Statistic title='媒体库登记' value={report.libraryCount} suffix='个' />
            <Statistic
              title='未使用（可清理）'
              value={report.unusedCount}
              suffix='个'
              valueStyle={report.unusedCount > 0 ? { color: '#cf1322' } : undefined}
            />
          </Space>

          {!hasIssues ? (
            <AlertLike message='未发现可清理的未使用文件。' type='success' />
          ) : (
            <>
              {report.unusedCount > 0 ? (
                <div>
                  <Text strong>
                    未使用的文件（{report.unusedImageCount} 张图片、{report.unusedVideoCount}{' '}
                    个视频）
                  </Text>
                  <Paragraph type='secondary' style={{ fontSize: 13 }}>
                    在媒体库有登记、但数据库各集合中均未引用。标为「可删除」的条目还经过二次全文检索；「需确认」表示库里仍有疑似片段命中。
                  </Paragraph>
                  <Table
                    size='small'
                    rowKey='fileId'
                    columns={columns}
                    dataSource={report.unusedItems}
                    expandable={{
                      rowExpandable: (row) => row.referenceHits.length > 0,
                      expandedRowRender: (row) => (
                        <Text type='secondary' style={{ fontSize: 12 }}>
                          疑似引用：{row.referenceHits.join('、')}
                        </Text>
                      )
                    }}
                    pagination={report.unusedItems.length > 8 ? { pageSize: 8 } : false}
                  />
                  {safeUnusedCount > 0 && suspectUnusedCount === 0 ? (
                    <AlertLike
                      type='success'
                      message='未使用文件均已通过二次检索，通常可放心删除（多为重复上传的残留）。'
                    />
                  ) : null}
                  {suspectUnusedCount > 0 ? (
                    <AlertLike
                      type='warning'
                      message={`有 ${suspectUnusedCount} 个文件在数据库里仍有疑似片段命中，请展开查看后再决定是否删除。`}
                    />
                  ) : null}
                  {report.unusedCount > report.unusedItems.length ? (
                    <Text type='secondary' style={{ fontSize: 12 }}>
                      另有 {report.unusedCount - report.unusedItems.length} 个未列出
                    </Text>
                  ) : null}
                </div>
              ) : null}

              {report.staleReferenceCount > 0 ? (
                <AlertLike
                  type='warning'
                  message={`有 ${report.staleReferenceCount} 处内容引用了已不在媒体库中的文件，建议在内容管理里更换图片。`}
                />
              ) : null}
            </>
          )}
        </Space>
      )}
    </Modal>
  )
}

function AlertLike({
  message,
  type
}: {
  message: string
  type?: 'success' | 'warning'
}) {
  const bg = type === 'warning' ? '#fffbe6' : '#f6ffed'
  const border = type === 'warning' ? '#ffe58f' : '#b7eb8f'
  return (
    <div
      style={{
        padding: '12px 16px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        fontSize: 14
      }}
    >
      {message}
    </div>
  )
}
