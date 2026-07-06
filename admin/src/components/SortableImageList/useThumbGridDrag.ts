import { useCallback, useRef, useState, type DragEvent, type MouseEvent } from 'react'

export function reorderRowsByIndex<T extends { sort: number }>(
  rows: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= rows.length) {
    return rows
  }
  const next = [...rows]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next.map((item, index) => ({ ...item, sort: index }))
}

export function adjustActiveIndex(active: number, from: number, to: number): number {
  if (active === from) return to
  if (from < active && to >= active) return active - 1
  if (from > active && to <= active) return active + 1
  return active
}

export function useThumbGridDrag(
  onReorder: (fromIndex: number, toIndex: number) => void,
  disabled = false
) {
  const dragFrom = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const onDragEnd = useCallback(() => {
    dragFrom.current = null
    setDropTarget(null)
    setDragging(null)
  }, [])

  const getHandleProps = useCallback(
    (index: number) => ({
      draggable: !disabled,
      onDragStart: (e: DragEvent) => {
        if (disabled) return
        e.stopPropagation()
        dragFrom.current = index
        setDragging(index)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
      },
      onDragEnd,
      onClick: (e: MouseEvent) => e.stopPropagation()
    }),
    [disabled, onDragEnd]
  )

  const getDropProps = useCallback(
    (index: number) => ({
      onDragOver: (e: DragEvent) => {
        if (disabled || dragFrom.current === null) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropTarget(index)
      },
      onDragLeave: () => setDropTarget(null),
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const from = dragFrom.current ?? Number(e.dataTransfer.getData('text/plain'))
        dragFrom.current = null
        setDropTarget(null)
        setDragging(null)
        if (!Number.isNaN(from) && from !== index) onReorder(from, index)
      }
    }),
    [disabled, onReorder]
  )

  return { dropTarget, dragging, getDropProps, getHandleProps }
}
