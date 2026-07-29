import { type ReactNode } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { Splitter } from '@/components/common/Splitter'

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
          <Splitter onDrag={(x) => setLeftWidth(x)} onDoubleClick={toggleLeft} />
        </>
      )}

      {/* A section, not <main> — the app shell already owns the document's single
          <main>, and nesting them is invalid HTML. */}
      <section className="min-w-0 min-h-0 overflow-hidden">{center}</section>

      {showRight && (
        <>
          <Splitter onDrag={(x) => setRightWidth(window.innerWidth - x)} onDoubleClick={toggleRight} />
          <aside className="min-w-0 min-h-0 bg-aura-base overflow-hidden">{right}</aside>
        </>
      )}
    </div>
  )
}
