import { useCallback, useEffect, useRef } from 'react'

interface SplitterProps {
  /** Called with the live cursor X while dragging. The caller converts it to a width,
   *  because "how far from what edge" differs per use — window edge for the app docks,
   *  container edge for the patchbay columns. */
  onDrag: (clientX: number) => void
  onDoubleClick?: () => void
  title?: string
}

/** A 1px draggable divider.
 *
 *  Absolute-position based rather than delta-accumulating: the caller always derives the
 *  width from the current cursor position, so the divider can never drift away from the
 *  pointer during a fast drag or after hitting a min/max clamp. */
export function Splitter({
  onDrag,
  onDoubleClick,
  title = 'Drag to resize · double-click to collapse',
}: SplitterProps) {
  const dragging = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    // Without this a drag selects page text, and over the canvas it starts an orbit.
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (dragging.current) onDrag(e.clientX)
    }
    const handleUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [onDrag])

  return (
    <div
      onPointerDown={handlePointerDown}
      onDoubleClick={onDoubleClick}
      title={title}
      className="relative bg-aura-line hover:bg-aura-accent transition-colors cursor-col-resize z-20"
    >
      {/* Widen the hit area without widening the visible rule. */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
