import Taro from '@tarojs/taro'
import { scopedStorageKey } from '../utils/env'

export type FabPos = { x: number; y: number }

const STORAGE_KEY = scopedStorageKey('service-fab-pos')
export const SERVICE_FAB_SIZE = 50
const EDGE_X = 8
const EDGE_Y = 24
const TABBAR_CLEARANCE = 140

let cachedPos: FabPos | null = null
const listeners = new Set<() => void>()

export function getDefaultServiceFabPos(): FabPos {
  const info = Taro.getWindowInfo()
  const safeBottom = info.screenHeight - (info.safeArea?.bottom ?? info.screenHeight)
  return {
    x: info.windowWidth - SERVICE_FAB_SIZE - EDGE_X,
    y: info.windowHeight - SERVICE_FAB_SIZE - EDGE_Y - TABBAR_CLEARANCE - safeBottom
  }
}

function readStoredPos(): FabPos | null {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY) as FabPos | undefined
    if (
      stored &&
      Number.isFinite(stored.x) &&
      Number.isFinite(stored.y)
    ) {
      return stored
    }
  } catch {
    // ignore
  }
  return null
}

export function getServiceFabPos(): FabPos {
  if (cachedPos) return cachedPos
  cachedPos = readStoredPos() || getDefaultServiceFabPos()
  return cachedPos
}

/** 永久持久化（无 TTL），按构建环境隔离 storage key */
export function setServiceFabPos(pos: FabPos) {
  cachedPos = pos
  try {
    Taro.setStorageSync(STORAGE_KEY, pos)
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener())
}

export function subscribeServiceFabPos(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
