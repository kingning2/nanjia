import { sortByOrder } from '@share/types/content'

export function nextSortValue<T extends { sort: number }>(items: T[]): number {
  return items.reduce((max, item) => Math.max(max, item.sort), -1) + 1
}

/** 交换相邻两项的 sort 值，返回新顺序（未持久化） */
export function swapAdjacentSort<T extends { sort: number }>(
  items: T[],
  index: number,
  direction: -1 | 1
): { current: T; neighbor: T } | null {
  const sorted = sortByOrder(items)
  const target = index + direction
  if (target < 0 || target >= sorted.length) return null
  const current = sorted[index]
  const neighbor = sorted[target]
  return { current, neighbor }
}
