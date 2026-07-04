import { ArrowRightOutlined, CopyOutlined, ScanOutlined } from '@ant-design/icons'
import { PageContainer } from '@ant-design/pro-components'
import {
  App,
  Button,
  Card,
  Col,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MediaRedundancyReportDTO } from '@share/types/sync'
import { ENV_TAG_COLORS, VISIBLE_ENV_SLUGS, envLabel } from '../../constants/envLabels'
import { useActiveEnv } from '../../context/ActiveEnvContext'
import MediaRedundancyModal from '../../components/MediaRedundancyModal'
import {
  analyzeMediaRedundancy,
  deleteUnusedMedia,
  migrateEnv,
  syncEnvProfilesFromFiles
} from '../../services/sync'
import styles from './index.module.css'

const { Paragraph, Text, Title } = Typography

export default function SyncCenterPage() {
  const { modal, message } = App.useApp()
  const { profiles, activeEnv, switchEnv, refreshProfiles } = useActiveEnv()
  const [initializing, setInitializing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copyFrom, setCopyFrom] = useState<string>()
  const [copyTo, setCopyTo] = useState<string>()
  const [analyzing, setAnalyzing] = useState(false)
  const [deletingUnused, setDeletingUnused] = useState(false)
  const [mediaReport, setMediaReport] = useState<MediaRedundancyReportDTO | null>(null)
  const [mediaReportOpen, setMediaReportOpen] = useState(false)

  const profileBySlug = useMemo(() => {
    const map: Record<string, (typeof profiles)[0]> = {}
    for (const p of profiles) map[p.slug] = p
    return map
  }, [profiles])

  const envOptions = useMemo(
    () =>
      VISIBLE_ENV_SLUGS.filter((slug) => profileBySlug[slug]).map((slug) => ({
        value: profileBySlug[slug].id,
        label: envLabel(slug)
      })),
    [profileBySlug]
  )

  const showSyncErrors = useCallback(
    (title: string, errors: string[]) => {
      modal.warning({
        title,
        width: 720,
        content: (
          <div>
            <Paragraph type='secondary'>已迁移可处理的数据，以下项目需要修正后再重试。</Paragraph>
            <Space direction='vertical' size={8} style={{ width: '100%' }}>
              {errors.slice(0, 20).map((error, index) => (
                <Text key={`${index}-${error}`} code copyable>
                  {error}
                </Text>
              ))}
              {errors.length > 20 ? (
                <Text type='secondary'>还有 {errors.length - 20} 项未展示</Text>
              ) : null}
            </Space>
          </div>
        )
      })
    },
    [modal]
  )

  const selectedPair = useCallback(() => {
    if (!copyFrom || !copyTo) return null
    const source = profiles.find((p) => p.id === copyFrom)
    const target = profiles.find((p) => p.id === copyTo)
    if (!source || !target || source.id === target.id) return null
    return { source, target }
  }, [copyFrom, copyTo, profiles])

  useEffect(() => {
    void (async () => {
      try {
        await syncEnvProfilesFromFiles()
        await refreshProfiles()
      } catch {
        // 配置未就绪时静默
      } finally {
        setInitializing(false)
      }
    })()
  }, [refreshProfiles])

  useEffect(() => {
    if (!profiles.length) return
    const prod = profileBySlug.production?.id
    const test = profileBySlug.test?.id
    const dev = profileBySlug.development?.id
    const fallbackFrom = import.meta.env.PROD ? prod : prod ?? dev
    const fallbackTo = import.meta.env.PROD ? test : test ?? dev
    setCopyFrom((prev) => prev ?? fallbackFrom ?? profiles[0]?.id)
    setCopyTo((prev) => prev ?? fallbackTo ?? profiles[0]?.id)
  }, [profiles, profileBySlug])

  const runMediaAudit = async () => {
    if (!activeEnv) {
      message.warning('请先在顶部选择要检查的环境')
      return
    }
    setAnalyzing(true)
    try {
      const result = await analyzeMediaRedundancy(activeEnv.id)
      setMediaReport(result)
      setMediaReportOpen(true)
    } finally {
      setAnalyzing(false)
    }
  }

  const deleteUnusedMediaFiles = () => {
    if (!mediaReport || mediaReport.unusedCount === 0) return
    modal.confirm({
      title: '确认删除未使用的图片/视频？',
      content: `将永久删除 ${mediaReport.unusedCount} 个未被内容引用的文件（${mediaReport.unusedImageCount} 张图片、${mediaReport.unusedVideoCount} 个视频）。云存储空间将释放，无法恢复。同名重复文件和失效引用不会被删除。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeletingUnused(true)
        try {
          const result = await deleteUnusedMedia(mediaReport.profileId)
          if (result.failedCount > 0) {
            message.warning(`已删除 ${result.deletedCount} 个，${result.failedCount} 个失败`)
          } else if (result.deletedCount === 0) {
            message.info('没有可删除的未使用文件（可能已被清理）')
          } else {
            message.success(`已删除 ${result.deletedCount} 个未使用文件`)
          }
          const refreshed = await analyzeMediaRedundancy(mediaReport.profileId)
          setMediaReport(refreshed)
        } finally {
          setDeletingUnused(false)
        }
      }
    })
  }

  const migrateContent = () => {
    const pair = selectedPair()
    if (!pair) {
      message.warning('请选择两个不同的环境')
      return
    }
    const fromName = envLabel(pair.source.slug, pair.source.name)
    const toName = envLabel(pair.target.slug, pair.target.name)

    modal.confirm({
      title: `将「${fromName}」完整复制到「${toName}」？`,
      okText: '清空目标并迁移',
      okButtonProps: { danger: true },
      content: (
        <div>
          <p>
            将<strong>先清空目标环境</strong>的全部数据库文档与云存储文件，再从来源环境完整复制（含
            fileID 替换）。复制后目标应与来源一致。
          </p>
          <p>
            <Text type='danger'>目标环境现有内容将被永久删除，无法恢复。</Text>
          </p>
        </div>
      ),
      cancelText: '取消',
      onOk: async () => {
        setBusy(true)
        try {
          const result = await migrateEnv({
            sourceProfileId: pair.source.id,
            targetProfileId: pair.target.id
          })
          const seconds = (result.durationMs / 1000).toFixed(1)
          if (result.errors.length) {
            showSyncErrors(`迁移完成（${seconds}s），但有 ${result.errors.length} 项未成功`, result.errors)
          } else {
            const parts: string[] = []
            if (result.documentsDeleted) parts.push(`清空 ${result.documentsDeleted} 条文档`)
            if (result.storageObjectsDeleted) parts.push(`${result.storageObjectsDeleted} 个文件`)
            if (result.documentsProcessed > 0) parts.push(`写入 ${result.documentsProcessed} 条文档`)
            if (result.mediaUploaded > 0) parts.push(`上传 ${result.mediaUploaded} 个文件`)
            message.success(
              `已将「${fromName}」复制到「${toName}」（${seconds}s${parts.length ? `：${parts.join('，')}` : ''}）`
            )
          }
        } finally {
          setBusy(false)
        }
      }
    })
  }

  if (initializing) {
    return (
      <div className={styles.loadingWrap}>
        <Spin tip='正在加载环境…' />
      </div>
    )
  }

  return (
    <PageContainer
      header={{
        title: '内容同步',
        subTitle: '在云环境之间直接迁移数据库与云存储。日常改分类、项目请用顶部环境切换。'
      }}
    >
      <Space direction='vertical' size={20} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {VISIBLE_ENV_SLUGS.map((slug) => {
            const profile = profileBySlug[slug]
            const label = envLabel(slug)
            const isViewing = activeEnv?.slug === slug
            const tagColor = ENV_TAG_COLORS[slug] ?? 'default'

            return (
              <Col xs={24} sm={VISIBLE_ENV_SLUGS.length > 2 ? 8 : 12} key={slug}>
                <Card className={styles.envCard} bordered={isViewing}>
                  <Space direction='vertical' size={12} style={{ width: '100%' }}>
                    <div className={styles.envCardHead}>
                      <Title level={5} style={{ margin: 0 }}>
                        {label}
                      </Title>
                      {isViewing ? (
                        <Tag color={tagColor} style={{ color: slug === 'production' ? '#2a221c' : undefined }}>
                          正在查看
                        </Tag>
                      ) : null}
                    </div>
                    <Paragraph type='secondary' className={styles.envCardDesc}>
                      {profile ? profile.envId : '未配置'}
                    </Paragraph>
                    {profile && !isViewing ? (
                      <Button size='small' onClick={() => void switchEnv(profile.id)}>
                        切换查看
                      </Button>
                    ) : null}
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>

        <Card title='检查图片 / 视频是否冗余'>
          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            <Paragraph type='secondary' style={{ marginBottom: 0 }}>
              扫描<strong>顶部当前环境</strong>
              {activeEnv ? `（${envLabel(activeEnv.slug, activeEnv.name)}）` : ''}
              ：找出媒体库里没有被人用到的图片/视频，以及同名可能重复上传的文件。只检查，不会删除。
            </Paragraph>
            <Button
              icon={<ScanOutlined />}
              loading={analyzing}
              onClick={() => void runMediaAudit()}
              disabled={!activeEnv || busy}
            >
              开始检查
            </Button>
          </Space>
        </Card>

        <Card title='迁移内容到其他环境' className={styles.mainCard}>
          <Paragraph type='secondary'>
            {import.meta.env.PROD
              ? '常用：把正式环境完整复制到测试。会先清空目标环境的全部数据与云存储，再从来源复制，保证两边一致。'
              : '常用：把正式环境完整复制到测试或开发。会先清空目标环境的全部数据与云存储，再从来源复制，保证两边一致。'}
          </Paragraph>
          <div className={styles.copyRow}>
            <Text>将</Text>
            <Select
              className={styles.envSelect}
              placeholder='选择来源'
              options={envOptions}
              value={copyFrom}
              onChange={setCopyFrom}
              disabled={busy}
            />
            <ArrowRightOutlined className={styles.copyArrow} />
            <Text>复制到</Text>
            <Select
              className={styles.envSelect}
              placeholder='选择目标'
              options={envOptions}
              value={copyTo}
              onChange={setCopyTo}
              disabled={busy}
            />
            <Button
              type='primary'
              size='large'
              danger
              icon={<CopyOutlined />}
              loading={busy}
              onClick={migrateContent}
            >
              清空目标并迁移
            </Button>
          </div>
        </Card>
      </Space>

      <MediaRedundancyModal
        open={mediaReportOpen}
        report={mediaReport}
        deleting={deletingUnused}
        onClose={() => setMediaReportOpen(false)}
        onDeleteUnused={deleteUnusedMediaFiles}
      />
    </PageContainer>
  )
}
