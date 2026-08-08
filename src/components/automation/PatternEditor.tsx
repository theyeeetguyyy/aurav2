import { useCallback, useEffect, useRef } from 'react'
import {
  samplePoints,
  writePoint,
  type AutomationPoint,
  type LaneInterpolation,
} from '@/engine/automation/lane'
import { TransportClock } from '@/engine/time/TransportClock'
import { readToken } from '@/utils/tokens'

/** Draw a pattern by hand.
 *
 *  The gesture is FL's: press and drag to paint, and the curve follows the pointer. Painting
 *  *replaces* whatever was under the stroke rather than overlaying it, which is what makes a
 *  second pass a correction instead of a mess.
 *
 *  The domain is **0–1**, not seconds. A pattern has no length of its own — the clip that
 *  places it decides that — so this editor draws one cycle and the clip track shows what it
 *  looks like stretched and repeated. It replaces an editor that worked in absolute project
 *  time, which could only ever describe one placement.
 *
 *  Canvas rather than SVG, and the playhead is drawn imperatively from `TransportClock`
 *  (HC-1): a pattern can be several hundred points and the playhead moves every frame, so
 *  neither belongs in React's render path. */
export function PatternEditor({
  points,
  interpolation,
  color,
  onChange,
  ghost,
  phaseAt,
  height = 120,
}: {
  points: AutomationPoint[]
  interpolation: LaneInterpolation
  color: string
  onChange: (points: AutomationPoint[]) => void
  /** The signal this pattern started from, drawn faintly behind it, in pattern time. Shows an
   *  edit as a departure from what the analyser heard rather than as an unanchored shape. */
  ghost?: (phase: number) => number
  /** Where in the pattern the transport currently is, 0–1, or null when it is outside the clip.
   *  This is what makes drawing against the music possible: the playhead tracks the *cycle*,
   *  so a pattern repeated eight times still shows you which pass you are hearing. */
  phaseAt?: (time: number) => number | null
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)

  // The stroke in progress. A ref, because a paint gesture emits far more moves than React
  // should ever see.
  const stroke = useRef<{ points: AutomationPoint[]; lastT: number } | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const width = Math.max(1, Math.floor(container.clientWidth))
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // Reference lines at 0, ½ and 1 — a drawn curve is meaningless without knowing where the
    // middle is.
    ctx.strokeStyle = readToken('--color-aura-line', 'rgba(255,255,255,.07)')
    ctx.lineWidth = 1
    for (const fraction of [0, 0.5, 1]) {
      const y = height - fraction * height
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(width, y + 0.5)
      ctx.stroke()
    }

    const live = stroke.current ? stroke.current.points : points

    if (ghost) {
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const y = height - Math.min(1, Math.max(0, ghost(x / width))) * height
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `${color}55`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Sample per pixel rather than joining the points: the drawn line then matches the value
    // the engine will actually read, including the interpolation mode.
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const y = height - samplePoints(live, interpolation, x / width) * height
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = `${color}22`
    ctx.fill()

    // Points, so it is obvious the curve is editable and where its anchors are.
    ctx.fillStyle = color
    for (const point of live) {
      ctx.beginPath()
      ctx.arc(point.t * width, height - point.v * height, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [points, interpolation, color, height, ghost])

  useEffect(() => {
    draw()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Playhead, imperative, in pattern phase.
  useEffect(() => {
    const line = playheadRef.current
    const container = containerRef.current
    if (!line || !container) return

    const apply = (time: number) => {
      const phase = phaseAt?.(time) ?? null
      line.style.opacity = phase === null ? '0' : '1'
      if (phase !== null) {
        line.style.transform = `translateX(${phase * container.clientWidth}px)`
      }
    }
    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [phaseAt])

  const pointFromEvent = (event: React.PointerEvent): AutomationPoint => {
    const box = containerRef.current!.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - box.left, 0), box.width)
    const y = Math.min(Math.max(event.clientY - box.top, 0), box.height)
    return {
      t: x / Math.max(1, box.width),
      v: 1 - y / Math.max(1, box.height),
    }
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    stroke.current = { points: writePoint(points, point.t, point.v, 0.01, 1), lastT: point.t }
    draw()
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const active = stroke.current
    if (!active) return
    const point = pointFromEvent(event)

    // Clear everything between the last sample and this one before writing, so dragging
    // right-to-left over existing points replaces them instead of leaving a comb.
    const low = Math.min(active.lastT, point.t)
    const high = Math.max(active.lastT, point.t)
    const kept = active.points.filter((p) => p.t < low - 1e-6 || p.t > high + 1e-6)

    active.points = writePoint(kept, point.t, point.v, 0.01, 1)
    active.lastT = point.t
    draw()
  }

  const handlePointerUp = (event: React.PointerEvent) => {
    const active = stroke.current
    stroke.current = null
    if (!active) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    onChange(active.points)
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-crosshair select-none touch-none"
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      <div
        ref={playheadRef}
        className="absolute top-0 bottom-0 left-0 w-px pointer-events-none"
        style={{ backgroundColor: readToken('--color-aura-playhead', '#f1f5f9'), opacity: 0 }}
      />
    </div>
  )
}
