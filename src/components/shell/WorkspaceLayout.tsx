import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useUIStore } from '@/store/useUIStore'

interface WorkspaceLayoutProps {
  left?: ReactNode
  center: ReactNode
  right?: ReactNode
}

/** Shared dock layout for every workspace page (docs/05-DESIGN-SYSTEM.md §2).
 *
 *  Docked CSS Grid, never floating panels — no popup can obscure the centre viewport,
 *  and there are no z-index collisions to arbitrate. Splitters are 1px with a wider
 *  invisible hit area, so they are easy to grab without being visually loud. */
export function WorkspaceLayout({ left, center, right }: WorkspaceLayoutProps) {
  const leftWidth = useUIStore((s) => s.leftPanelWidth)
  const rightWidth = useUIStore((s) => s.rightPanelWidth)
  const leftCollapsed = useUIStore((s) => s.leftPanelCollapsed)
  const rightCollapsed = useUIStore((s) => s.rightPanelCollapsed)
  const setLeftWidth = useUIStore((s) => s.setLeftPanelWidth)
  const setRightWidth = useUIStore((s) => s.setRightPanelWidth)
  const toggleLeft = useUIStore((s) => s.toggleLeftPanel)
  const toggleRight = useUIStore((s) => s.toggleRightPanel)

  const showLeft = Boolean(left) && !leftCollapsed
  const showRight = Boolean(right) && !rightCollapsed

  const columns = [
    showLeft ? `${leftWidth}px` : null,
    showLeft ? '1px' : null,
    'minmax(0, 1fr)',
    showRight ? '1px' : null,
    showRight ? `${rightWidth}px` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="w-full h-full grid min-h-0" style={{ gridTemplateColumns: columns }}>
      {showLeft && (
        <>
          <aside className="min-w-0 min-h-0 bg-aura-base overflow-hidden">{left}</aside>
          <Splitter edge="left" onResize={setLeftWidth} onCollapse={toggleLeft} />
        </>
      )}

      {/* A section, not <main> — the app shell already owns the document's single
          <main>, and nesting them is invalid HTML. */}
      <section className="min-w-0 min-h-0 overflow-hidden">{center}</section>

      {showRight && (
        <>
          <Splitter edge="right" onResize={setRightWidth} onCollapse={toggleRight} />
          <aside className="min-w-0 min-h-0 bg-aura-base overflow-hidden">{right}</aside>
        </>
      )}
    </div>
  )
}

interface SplitterProps {
  edge: 'left' | 'right'
  onResize: (width: number) => void
  onCollapse: () => void
}

function Splitter({ edge, onResize, onCollapse }: SplitterProps) {
  const dragging = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    // Stops the drag from selecting page text or landing on the 3D canvas.
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragging.current) return
      // Width is measured from the window edge the dock is anchored to, so the panel
      // tracks the cursor exactly regardless of how the grid has reflowed.
      onResize(edge === 'left' ? e.clientX : window.innerWidth - e.clientX)
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
  }, [edge, onResize])

  return (
    <div
      onPointerDown={handlePointerDown}
      onDoubleClick={onCollapse}
      title="Drag to resize · double-click to collapse"
      className="relative bg-aura-line hover:bg-aura-accent transition-colors cursor-col-resize"
    >
      {/* Widen the hit area without widening the visible rule. */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
