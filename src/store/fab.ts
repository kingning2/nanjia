import Taro from '@tarojs/taro'
import { scopedStorageKey } from '../utils/env'

export type FabPos = { x: number; y: number }

const STORAGE_KEY = scopedStorageKey('service-fab-pos')
export const SERVICE_FAB_SIZE = 72
const TABBAR_CLEARANCE = 136

let cachedPos: FabPos | null = null
const listeners = new Set<() => void>()

export function getDefaultServiceFabPos(): FabPos {
  const info = Taro.getWindowInfo()

  return {
    x: info.windowWidth - SERVICE_FAB_SIZE,
    y: info.windowHeight - SERVICE_FAB_SIZE - TABBAR_CLEARANCE
  }
}

function readStoredPos(): FabPos | null {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY) as FabPos | undefined
    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      return stored
    }
  } catch {
    // ignore
  }
  return null
}

export function clampServiceFabPos(pos: FabPos): FabPos {
  const info = Taro.getWindowInfo()
  const maxX = Math.max(0, info.windowWidth - SERVICE_FAB_SIZE)
  const maxY = Math.max(0, info.windowHeight - SERVICE_FAB_SIZE)

  return {
    x: Math.min(maxX, Math.max(0, pos.x)),
    y: Math.min(maxY, Math.max(0, pos.y))
  }
}

export function getServiceFabPos(): FabPos {
  if (cachedPos) return cachedPos
  const stored = readStoredPos()
  cachedPos = clampServiceFabPos(stored || getDefaultServiceFabPos())
  return cachedPos
}

export function setServiceFabPos(pos: FabPos) {
  cachedPos = clampServiceFabPos(pos)
  try {
    Taro.setStorageSync(STORAGE_KEY, cachedPos)
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener())
}

export function subscribeServiceFabPos(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
