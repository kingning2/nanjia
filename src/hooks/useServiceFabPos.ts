import { useSyncExternalStore } from 'react'
import {
  FabPos,
  getDefaultServiceFabPos,
  getServiceFabPos,
  setServiceFabPos,
  subscribeServiceFabPos
} from '../store/fab'

export function useServiceFabPos(): [FabPos, (pos: FabPos) => void] {
  const pos = useSyncExternalStore(
    subscribeServiceFabPos,
    getServiceFabPos,
    getDefaultServiceFabPos
  )

  return [pos, setServiceFabPos]
}
