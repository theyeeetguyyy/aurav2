import { useCallback, useEffect, useRef } from 'react'
import { sampleLane, writePoint, type AutomationPoint, type LaneData } from '@/engine/automation/lane'
import { TransportClock } from '@/engine/time/TransportClock'
import { readToken } from '@/utils/tokens'

/** Draw a signal by hand.
 *
 *  The gesture is FL's: press and drag to paint, and the curve follows the pointer.
 *  Painting *replaces* whatever was under the stroke rather than overlaying it, which is
 *  the behaviour that makes a second pass a correction instead of a mess.
 *
 *  Canvas rather than SVG, and the playhead is drawn imperatively from `TransportClock`
 *  (HC-1): a lane can be several hundred points and the playhead moves every frame, so
 *  neither belongs in React's render path. */
export function LaneEditor({
  lane,
  duration,
  color,
  onChange,
  ghost,
  height = 120,
}: {
  lane: LaneData
  duration: number
  color: string
  onChange: (points: AutomationPoint[]) => void
  /** The signal this curve started from, drawn faintly behind it. Shows an edit as a
   *  departure from what the analyser heard rather than as an unanchored shape. */
  ghost?: (t: number) => number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)

  // The stroke in progress. A ref, because a paint gesture emits far more moves than
  // React should ever see.
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

    // Reference lines at 0, ½ and 1 — a drawn curve is meaningless without knowing
    // where the middle is.
    ctx.strokeStyle = readToken('--color-aura-line', 'rgba(255,255,255,.07)')
    ctx.lineWidth = 1
    for (const fraction of [0, 0.5, 1]) {
      const y = height - fraction * height
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(width, y + 0.5)
      ctx.stroke()
    }

    const span = Math.max(1e-6, duration)
    const live = stroke.current ? { ...lane, points: stroke.current.points } : lane

    if (ghost) {
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const y = height - Math.min(1, Math.max(0, ghost((x / width) * span))) * height
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `${color}55`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Sample per pixel rather than joining the points: the drawn line then matches the
    // value the engine will actually read, including the interpolation mode.
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const value = sampleLane(live, (x / width) * span)
      const y = height - value * height
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
    for (const point of live.points) {
      const x = (point.t / span) * width
      const y = height - point.v * height
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [lane, duration, color, height, ghost])

  useEffect(() => {
    draw()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Playhead, imperative. Lets you draw against what you are hearing.
  useEffect(() => {
    const line = playheadRef.current
    const container = containerRef.current
    if (!line || !container) return

    const apply = (time: number) => {
      const progress = duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0
      line.style.transform = `translateX(${progress * container.clientWidth}px)`
    }
    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [duration])

  const pointFromEvent = (event: React.PointerEvent | PointerEvent): AutomationPoint => {
    const container = containerRef.current!
    const box = container.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - box.left, 0), box.width)
    const y = Math.min(Math.max(event.clientY - box.top, 0), box.height)
    return {
      t: (x / Math.max(1, box.width)) * Math.max(1e-6, duration),
      v: 1 - y / Math.max(1, box.height),
    }
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointFromEvent(event)
    stroke.current = { points: writePoint(lane.points, point.t, point.v), lastT: point.t }
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

    active.points = writePoint(kept, point.t, point.v)
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
        style={{ backgroundColor: readToken('--color-aura-playhead', '#f1f5f9') }}
      />
    </div>
  )
}
