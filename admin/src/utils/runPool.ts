/** ponytail: 轻量并发池；上限 6 路，避免大图并行把内存打满 */
const DEFAULT_MAX_CONCURRENCY = 6

export function getWorkConcurrency(max = DEFAULT_MAX_CONCURRENCY): number {
  const cores =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4
  return Math.max(1, Math.min(max, cores))
}

export function getWorkConcurrencyFor(count: number, max = DEFAULT_MAX_CONCURRENCY): number {
  if (count <= 0) return 1
  return Math.min(count, getWorkConcurrency(max))
}

export type RunPoolOptions = {
  concurrency?: number
  onProgress?: (completed: number, total: number) => void
}

/** 固定并发上限地处理 items，结果顺序与输入一致 */
export async function runPool<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options?: RunPoolOptions
): Promise<R[]> {
  if (items.length === 0) return []

  const total = items.length
  const concurrency = options?.concurrency ?? getWorkConcurrencyFor(total)
  const results = new Array<R>(total)
  let nextIndex = 0
  let completed = 0

  async function runWorker() {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= total) return

      results[index] = await worker(items[index], index)
      completed += 1
      options?.onProgress?.(completed, total)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
  return results
}
