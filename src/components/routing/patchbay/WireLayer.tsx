import { useEffect, useRef, useState, type RefObject } from 'react'
import { useModulationStore } from '@/store/useModulationStore'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { TransportClock } from '@/engine/time/TransportClock'
import { formatAddress } from '@/types/params'
import { measureAnchor, sourceAnchorId, subscribeAnchors, targetAnchorId } from './anchors'
import { getDrag, subscribeDrag } from './dragState'

const KIND_COLOR: Record<string, string> = {
  audio: 'var(--color-aura-node-signal)',
  rhythm: 'var(--color-aura-node-processor)',
  generative: 'var(--color-aura-node-parameter)',
}

interface Wire {
  id: string
  d: string
  color: string
  width: number
  dashed: boolean
  enabled: boolean
  /** Address key, so the pulse animation can look up the live value. */
  addressKey: string
}

interface WireLayerProps {
  containerRef: RefObject<HTMLDivElement | null>
  selectedId: string | null
  onSelect: (id: string | null) => void
}

/** The wires.
 *
 *  Geometry is measured from real DOM anchors and recomputed only when something moves —
 *  a scroll, a resize, a connection change. The *pulse* is separate: it animates every
 *  frame off TransportClock by writing SVG attributes directly, never through React
 *  (HC-1). A wire that visibly throbs on each kick answers "is this working?" without
 *  pressing play and squinting at a shape. */
export function WireLayer({ containerRef, selectedId, onSelect }: WireLayerProps) {
  const connections = useModulationStore((s) => s.connections)
  const triggers = useModulationStore((s) => s.triggers)
  const [wires, setWires] = useState<Wire[]>([])
  const [dragPath, setDragPath] = useState<string | null>(null)

  const pathRefs = useRef(new Map<string, SVGPathElement>())

  // ─── Geometry: measure on demand ───
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frame = 0
    const measure = () => {
      frame = 0
      const box = container.getBoundingClientRect()
      const next: Wire[] = []

      const push = (
        id: string,
        source: { kind: string; key: string; sourceId?: string },
        target: { objectId: string; effectId?: string; paramKey: string },
        options: { dashed: boolean; enabled: boolean; width: number },
      ) => {
        const from = measureAnchor(sourceAnchorId(source as never), box, 'right')
        const to = measureAnchor(targetAnchorId(target), box, 'left')
        if (!from || !to) return

        next.push({
          id,
          d: bezier(from.x, from.y, to.x, to.y),
          color: KIND_COLOR[source.kind] ?? 'var(--color-aura-accent)',
          ...options,
          addressKey: formatAddress(target),
        })
      }

      for (const c of connections) {
        push(c.id, c.source, c.target, {
          dashed: false,
          enabled: c.enabled,
          // Weight reads as thickness — a glance tells you which routing dominates.
          width: 1 + Math.min(3, c.chain.weight * 1.5),
        })
      }
      for (const t of triggers) {
        push(t.id, t.source, t.target, { dashed: true, enabled: t.enabled, width: 1.5 })
      }

      setWires(next)
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    measure()

    const unsubscribe = subscribeAnchors(schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    // Both columns scroll independently, and either moves the endpoints.
    container.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)

    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
      observer.disconnect()
      container.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [containerRef, connections, triggers])

  // ─── Pulse: per-frame, imperative ───
  useEffect(() => {
    const apply = () => {
      for (const wire of wires) {
        const path = pathRefs.current.get(wire.id)
        if (!path) continue
        if (!wire.enabled) {
          path.setAttribute('opacity', '0.15')
          continue
        }
        // Live signal on this target. Normalised loosely — the point is visible motion,
        // not a calibrated meter.
        const level = Math.min(1, Math.abs(ModulationMatrix.getOffset(wire.addressKey)))
        path.setAttribute('opacity', String(0.35 + level * 0.65))
        path.setAttribute('stroke-width', String(wire.width + level * 2))
      }
    }
    apply()
    return TransportClock.subscribe(apply)
  }, [wires])

  // ─── Cursor wire while dragging ───
  useEffect(() => {
    let frame = 0

    const tick = () => {
      const drag = getDrag()
      const container = containerRef.current
      if (!drag || !container) {
        setDragPath(null)
        return
      }
      const box = container.getBoundingClientRect()
      const from = measureAnchor(drag.sourceAnchorId, box, 'right')
      setDragPath(from ? bezier(from.x, from.y, drag.x, drag.y) : null)
      frame = requestAnimationFrame(tick)
    }

    return subscribeDrag((active) => {
      if (active) frame = requestAnimationFrame(tick)
      else {
        cancelAnimationFrame(frame)
        setDragPath(null)
      }
    })
  }, [containerRef])

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      {wires.map((wire) => (
        <g key={wire.id}>
          {/* Invisible fat stroke so a 2px wire is still clickable. */}
          <path
            d={wire.d}
            stroke="transparent"
            strokeWidth={12}
            fill="none"
            className="pointer-events-auto cursor-pointer"
            onClick={() => onSelect(wire.id === selectedId ? null : wire.id)}
          />
          <path
            ref={(el) => {
              if (el) pathRefs.current.set(wire.id, el)
              else pathRefs.current.delete(wire.id)
            }}
            d={wire.d}
            stroke={wire.color}
            strokeWidth={wire.width}
            strokeDasharray={wire.dashed ? '4 3' : undefined}
            fill="none"
            strokeLinecap="round"
            className="pointer-events-none"
          />
          {wire.id === selectedId && (
            <path
              d={wire.d}
              stroke="white"
              strokeWidth={wire.width + 3}
              fill="none"
              opacity={0.25}
              strokeLinecap="round"
              className="pointer-events-none"
            />
          )}
        </g>
      ))}

      {dragPath && (
        <path
          d={dragPath}
          stroke="var(--color-aura-accent)"
          strokeWidth={2}
          strokeDasharray="5 4"
          fill="none"
          strokeLinecap="round"
          className="pointer-events-none"
        />
      )}
    </svg>
  )
}

/** Horizontal cubic bezier. Control points scale with distance so short hops stay tight
 *  and long ones bow out instead of cutting across the middle column. */
function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const reach = Math.max(30, Math.min(140, Math.abs(x2 - x1) * 0.55))
  return `M ${x1} ${y1} C ${x1 + reach} ${y1}, ${x2 - reach} ${y2}, ${x2} ${y2}`
}
