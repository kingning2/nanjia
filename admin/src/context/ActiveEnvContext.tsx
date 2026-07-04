import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EnvProfileDTO } from '@share/types/sync'
import { clearStorageUrlCache } from '../services/cloud/storage'
import { listEnvProfiles, setActiveEnvProfile } from '../services/sync'

type ActiveEnvContextValue = {
  profiles: EnvProfileDTO[]
  activeEnv: EnvProfileDTO | null
  loading: boolean
  /** 切换当前云环境（后续 CRUD 直连对应 CloudBase 库） */
  switchEnv: (profileId: string) => Promise<void>
  /** 按 slug 切换：development / test / production */
  switchEnvBySlug: (slug: string) => Promise<void>
  refreshProfiles: () => Promise<void>
}

const ActiveEnvContext = createContext<ActiveEnvContextValue | null>(null)

export function ActiveEnvProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<EnvProfileDTO[]>([])
  const [activeEnv, setActiveEnv] = useState<EnvProfileDTO | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfiles = useCallback(async () => {
    try {
      const list = await listEnvProfiles()
      setProfiles(list)
      setActiveEnv(list.find((item) => item.isActive) ?? null)
    } catch {
      // 错误已由 invoke 层 message 提示
    }
  }, [])

  useEffect(() => {
    void refreshProfiles().finally(() => setLoading(false))
  }, [refreshProfiles])

  const switchEnv = useCallback(
    async (profileId: string) => {
      if (activeEnv?.id === profileId) return
      const updated = await setActiveEnvProfile(profileId)
      clearStorageUrlCache()
      setActiveEnv(updated)
      setProfiles((prev) =>
        prev.map((item) => ({ ...item, isActive: item.id === profileId }))
      )
      navigate('/categories')
    },
    [activeEnv?.id, navigate]
  )

  const switchEnvBySlug = useCallback(
    async (slug: string) => {
      const target = profiles.find((item) => item.slug === slug)
      if (!target) {
        throw new Error(`未找到环境「${slug}」，请先在同步中心从环境文件同步`)
      }
      await switchEnv(target.id)
    },
    [profiles, switchEnv]
  )

  const value = useMemo(
    () => ({
      profiles,
      activeEnv,
      loading,
      switchEnv,
      switchEnvBySlug,
      refreshProfiles
    }),
    [profiles, activeEnv, loading, switchEnv, switchEnvBySlug, refreshProfiles]
  )

  return <ActiveEnvContext.Provider value={value}>{children}</ActiveEnvContext.Provider>
}

export function useActiveEnv() {
  const ctx = useContext(ActiveEnvContext)
  if (!ctx) {
    throw new Error('useActiveEnv 须在 ActiveEnvProvider 内使用')
  }
  return ctx
}
