import { useCallback, useMemo, useRef, useState } from 'react'
import { evaluateCurve, normaliseCurve, type CurvePoint } from '@/engine/modulation/curve'

interface CurveEditorProps {
  points: CurvePoint[]
  onChange: (points: CurvePoint[]) => void
  height?: number
}

const PAD = 6

/** Response curve editor — the DAW envelope-shape control, applied to modulation.
 *
 *  X is the incoming signal (quiet → loud), Y is how much of the range it produces.
 *  A straight diagonal is "react proportionally"; bending it decides whether a stem's
 *  quiet detail matters or only its peaks do.
 *
 *  Interactions match what the audience already knows from FL/Ableton envelopes:
 *  drag a point, drag a segment to bend it, double-click to add, alt-click to remove. */
export function CurveEditor({ points, onChange, height = 120 }: CurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [tensionIndex, setTensionIndex] = useState<number | null>(null)
  const dragStart = useRef({ y: 0, tension: 0 })

  /** SVG coords → curve space (0–1, Y flipped so up means more). */
  const toCurve = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const box = svg.getBoundingClientRect()
      const w = box.width - PAD * 2
      const h = box.height - PAD * 2
      return {
        x: clamp01((clientX - box.left - PAD) / w),
        y: clamp01(1 - (clientY - box.top - PAD) / h),
      }
    },
    [],
  )

  const path = useMemo(() => buildPath(points), [points])

  const handlePointerDown = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Alt-click removes, but never the two endpoints — a curve needs both ends.
    if (e.altKey && index > 0 && index < points.length - 1) {
      onChange(points.filter((_, i) => i !== index))
      return
    }
    setDragIndex(index)
  }

  const handleSegmentDown = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setTensionIndex(index)
    dragStart.current = { y: e.clientY, tension: points[index].tension }
  }

  const handleMove = (e: React.PointerEvent) => {
    if (dragIndex !== null) {
      const { x, y } = toCurve(e.clientX, e.clientY)
      const next = points.map((p, i) => {
        if (i !== dragIndex) return p
        // Endpoints stay pinned horizontally, so the curve always spans the full input
        // range. Only their height is editable.
        const isEndpoint = i === 0 || i === points.length - 1
        return { ...p, x: isEndpoint ? p.x : x, y }
      })
      onChange(normaliseCurve(next))
      return
    }

    if (tensionIndex !== null) {
      // Vertical drag bends the segment. Inverted so dragging up bows the curve upward,
      // which is what the eye expects.
      const delta = (dragStart.current.y - e.clientY) / 60
      const tension = Math.max(-1, Math.min(1, dragStart.current.tension + delta))
      onChange(points.map((p, i) => (i === tensionIndex ? { ...p, tension } : p)))
    }
  }

  const handleUp = () => {
    setDragIndex(null)
    setTensionIndex(null)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x, y } = toCurve(e.clientX, e.clientY)
    const next = normaliseCurve([...points, { x, y, tension: 0 }])
    onChange(next)
  }

  return (
    <svg
      ref={svgRef}
      className="w-full block bg-aura-base border border-aura-line rounded cursor-crosshair select-none"
      style={{ height }}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onDoubleClick={handleDoubleClick}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* Reference diagonal — where a linear response would sit. */}
      <line x1={0} y1={100} x2={100} y2={0} stroke="currentColor" className="text-slate-800" strokeWidth={0.5} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      {[25, 50, 75].map((v) => (
        <g key={v} className="text-slate-800">
          <line x1={v} y1={0} x2={v} y2={100} stroke="currentColor" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={v} x2={100} y2={v} stroke="currentColor" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        </g>
      ))}

      <path d={path} fill="none" stroke="var(--color-aura-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />

      {/* Fat invisible strokes per segment give tension a grabbable target. */}
      {points.slice(0, -1).map((p, i) => (
        <path
          key={`seg-${i}`}
          d={buildSegment(p, points[i + 1])}
          fill="none"
          stroke="transparent"
          strokeWidth={10}
          vectorEffect="non-scaling-stroke"
          className="cursor-ns-resize"
          onPointerDown={handleSegmentDown(i)}
        />
      ))}

      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x * 100}
          cy={(1 - p.y) * 100}
          r={4}
          vectorEffect="non-scaling-stroke"
          className={
            i === dragIndex ? 'fill-white cursor-grabbing' : 'fill-aura-accent cursor-grab hover:fill-white'
          }
          onPointerDown={handlePointerDown(i)}
        />
      ))}
    </svg>
  )
}

/** Sample the curve densely rather than emitting bezier segments — tension is an
 *  exponential bend that has no exact cubic equivalent, and 60 points is visually smooth. */
function buildPath(points: CurvePoint[]): string {
  const steps = 60
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const x = i / steps
    const y = evaluateCurve(points, x)
    d += `${i === 0 ? 'M' : 'L'} ${x * 100} ${(1 - y) * 100} `
  }
  return d
}

function buildSegment(a: CurvePoint, b: CurvePoint): string {
  const steps = 16
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = a.x + (b.x - a.x) * t
    const y = evaluateCurve([a, b], x)
    d += `${i === 0 ? 'M' : 'L'} ${x * 100} ${(1 - y) * 100} `
  }
  return d
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
