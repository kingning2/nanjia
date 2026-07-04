import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type DevDebugEntry = {
  label: string
  value: string
  tone?: 'default' | 'error'
}

export type DevDebugSection = {
  id: string
  title: string
  entries: DevDebugEntry[]
}

type DevDebugContextValue = {
  sections: DevDebugSection[]
  setSection: (id: string, section: DevDebugSection | null) => void
}

const DevDebugContext = createContext<DevDebugContextValue | null>(null)

function isSameSection(a: DevDebugSection, b: DevDebugSection) {
  return a.title === b.title && JSON.stringify(a.entries) === JSON.stringify(b.entries)
}

export function DevDebugProvider({ children }: { children: React.ReactNode }) {
  const [sectionMap, setSectionMap] = useState<Record<string, DevDebugSection>>({})

  const setSection = useCallback((id: string, section: DevDebugSection | null) => {
    setSectionMap((prev) => {
      if (!section) {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      const existing = prev[id]
      if (existing && isSameSection(existing, section)) return prev
      return { ...prev, [id]: section }
    })
  }, [])

  const sections = useMemo(() => Object.values(sectionMap), [sectionMap])

  const value = useMemo(() => ({ sections, setSection }), [sections, setSection])

  return <DevDebugContext.Provider value={value}>{children}</DevDebugContext.Provider>
}

export function useDevDebugContext() {
  return useContext(DevDebugContext)
}
