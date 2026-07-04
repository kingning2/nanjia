import { CloudOutlined, SyncOutlined } from '@ant-design/icons'
import { Button, Segmented, Space, Spin, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VISIBLE_ENV_SEGMENTS } from '../../constants/envLabels'
import { BRAND } from '../../constants/theme'
import { useActiveEnv } from '../../context/ActiveEnvContext'
import { notifyError, notifySuccess } from '../../utils/feedback'
import styles from './index.module.css'

export default function EnvToolbar() {
  const navigate = useNavigate()
  const { activeEnv, loading, profiles, switchEnvBySlug } = useActiveEnv()
  const [switching, setSwitching] = useState(false)

  const activeSlug = activeEnv?.slug
  const missingSlugs = useMemo(
    () => VISIBLE_ENV_SEGMENTS.filter((item) => !profiles.some((p) => p.slug === item.value)),
    [profiles]
  )

  const handleChange = async (value: string | number) => {
    const slug = String(value)
    if (slug === activeSlug) return
    setSwitching(true)
    try {
      await switchEnvBySlug(slug)
      notifySuccess(`已切换到${VISIBLE_ENV_SEGMENTS.find((item) => item.value === slug)?.label ?? slug}环境`)
    } catch (error) {
      notifyError(error, '切换环境失败，请联系技术人员检查配置')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className={styles.bar}>
      <Space size={12} wrap>
        <CloudOutlined style={{ color: BRAND.primary }} />
        <Typography.Text type='secondary'>正在管理</Typography.Text>
        <Spin spinning={loading || switching} size='small'>
          <Segmented
            options={VISIBLE_ENV_SEGMENTS.map((item) => ({
              label: item.label,
              value: item.value,
              disabled: !profiles.some((p) => p.slug === item.value)
            }))}
            value={activeSlug}
            onChange={handleChange}
          />
        </Spin>
        {missingSlugs.length > 0 ? (
          <Typography.Text type='warning' style={{ fontSize: 12 }}>
            部分环境未就绪，请联系技术人员
          </Typography.Text>
        ) : null}
      </Space>
      <Button
        type='link'
        size='small'
        icon={<SyncOutlined />}
        onClick={() => navigate('/sync-center')}
      >
        内容同步
      </Button>
    </div>
  )
}
