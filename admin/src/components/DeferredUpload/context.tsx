import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode
} from 'react'

type FlushTask = () => Promise<boolean>

interface DeferredUploadContextValue {
  register: (task: FlushTask) => () => void
  registerPendingCheck: (check: () => boolean) => () => void
  flushAll: () => Promise<boolean>
  hasPending: () => boolean
}

const DeferredUploadContext = createContext<DeferredUploadContextValue | null>(null)

export function DeferredUploadProvider({ children }: { children: ReactNode }) {
  const tasksRef = useRef(new Set<FlushTask>())
  const pendingChecksRef = useRef(new Set<() => boolean>())

  const register = useCallback((task: FlushTask) => {
    tasksRef.current.add(task)
    return () => tasksRef.current.delete(task)
  }, [])

  const registerPendingCheck = useCallback((check: () => boolean) => {
    pendingChecksRef.current.add(check)
    return () => pendingChecksRef.current.delete(check)
  }, [])

  const hasPending = useCallback(() => {
    for (const check of pendingChecksRef.current) {
      if (check()) return true
    }
    return false
  }, [])

  const flushAll = useCallback(async (): Promise<boolean> => {
    for (const task of tasksRef.current) {
      try {
        if (!(await task())) return false
      } catch {
        return false
      }
    }
    return true
  }, [])

  const value = useMemo(
    () => ({ register, flushAll, hasPending, registerPendingCheck }),
    [register, flushAll, hasPending, registerPendingCheck]
  )

  return (
    <DeferredUploadContext.Provider value={value}>{children}</DeferredUploadContext.Provider>
  )
}

export function useDeferredUpload() {
  const ctx = useContext(DeferredUploadContext)
  if (!ctx) {
    throw new Error('useDeferredUpload 必须在 DeferredUploadProvider 内使用')
  }
  return ctx
}

export function useDeferredUploadOptional() {
  return useContext(DeferredUploadContext)
}

/** 注册弹窗确定前需执行的上传任务（如封面、配图） */
export function useDeferredUploadTask(
  task: FlushTask,
  hasPending: () => boolean,
  enabled = true
) {
  const ctx = useDeferredUploadOptional()
  const taskRef = useRef(task)
  const pendingRef = useRef(hasPending)
  taskRef.current = task
  pendingRef.current = hasPending

  useEffect(() => {
    if (!ctx || !enabled) return
    const unregisterTask = ctx.register(() => taskRef.current())
    const unregisterPending = ctx.registerPendingCheck(() => pendingRef.current())
    return () => {
      unregisterTask()
      unregisterPending()
    }
  }, [ctx, enabled])
}
