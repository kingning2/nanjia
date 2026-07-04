import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MinusOutlined
} from '@ant-design/icons'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Space, Tag, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { ENV_TAG_COLORS, envLabel } from '../../constants/envLabels'
import { useActiveEnv } from '../../context/ActiveEnvContext'
import { getEnvBillingInfo } from '../../services/sync'
import type { EnvBillingDTO } from '@share/types/sync'
import AppLogo from '../AppLogo'
import styles from './index.module.css'

const APP_TITLE = '南嘉管理后台'

function formatBillingHint(billing: EnvBillingDTO | null) {
  if (!billing) return null
  if (billing.isAlwaysFree || billing.payMode === 'POSTPAID') {
    return '按量计费'
  }
  if (billing.daysRemaining == null) {
    return billing.expireTime ? `到期 ${billing.expireTime.slice(0, 10)}` : null
  }
  if (billing.daysRemaining < 0) {
    return '套餐已过期'
  }
  if (billing.daysRemaining === 0) {
    return '今日到期'
  }
  const renew = billing.isAutoRenew ? ' · 自动续费' : ''
  return `套餐剩余 ${billing.daysRemaining} 天${renew}`
}

export default function WindowTitleBar() {
  const { activeEnv } = useActiveEnv()
  const [maximized, setMaximized] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [billing, setBilling] = useState<EnvBillingDTO | null>(null)

  useEffect(() => {
    setDesktop(isTauri())
  }, [])

  const syncMaximized = useCallback(async () => {
    if (!isTauri()) return
    const maximizedNow = await getCurrentWindow().isMaximized()
    setMaximized(maximizedNow)
  }, [])

  useEffect(() => {
    if (!desktop) return
    document.title = APP_TITLE
    void syncMaximized()
    const win = getCurrentWindow()
    const unlistenPromise = win.onResized(() => {
      void syncMaximized()
    })
    return () => {
      void unlistenPromise.then((unlisten) => unlisten())
    }
  }, [desktop, syncMaximized])

  useEffect(() => {
    if (!activeEnv) {
      setBilling(null)
      return
    }
    let cancelled = false
    void getEnvBillingInfo()
      .then((info) => {
        if (!cancelled) setBilling(info)
      })
      .catch(() => {
        if (!cancelled) setBilling(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeEnv?.id])

  const minimize = () => {
    if (!isTauri()) return
    void getCurrentWindow().minimize()
  }

  const toggleMaximize = () => {
    if (!isTauri()) return
    void getCurrentWindow().toggleMaximize()
  }

  const close = () => {
    if (!isTauri()) return
    void getCurrentWindow().close()
  }

  const billingHint = formatBillingHint(billing)
  const envColor = activeEnv ? (ENV_TAG_COLORS[activeEnv.slug] ?? 'default') : 'default'

  return (
    <header className={styles.bar}>
      <div className={styles.drag} data-tauri-drag-region>
        <AppLogo size={20} className={styles.logo} />
        <h1 className={styles.title}>{APP_TITLE}</h1>
        {activeEnv ? (
          <Space size={8} className={styles.envMeta}>
            <Tag color={envColor} className={styles.envTag}>
              {envLabel(activeEnv.slug, activeEnv.name)}环境
            </Tag>
            {billingHint ? (
              <Typography.Text type='secondary' className={styles.billing}>
                {billingHint}
              </Typography.Text>
            ) : null}
          </Space>
        ) : null}
      </div>
      <div className={styles.controls}>
        <button
          type='button'
          className={styles.control}
          aria-label='最小化'
          onClick={minimize}
        >
          <MinusOutlined style={{ fontSize: 12 }} />
        </button>
        <button
          type='button'
          className={styles.control}
          aria-label={maximized ? '还原' : '最大化'}
          onClick={toggleMaximize}
        >
          {maximized ? (
            <FullscreenExitOutlined style={{ fontSize: 12 }} />
          ) : (
            <FullscreenOutlined style={{ fontSize: 12 }} />
          )}
        </button>
        <button
          type='button'
          className={`${styles.control} ${styles.controlClose}`}
          aria-label='关闭'
          onClick={close}
        >
          <CloseOutlined style={{ fontSize: 12 }} />
        </button>
      </div>
    </header>
  )
}
