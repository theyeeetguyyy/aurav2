import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { clipPhase } from '@/engine/automation/clips'
import { samplePoints } from '@/engine/automation/lane'
import { snapToGrid, SNAP_WINDOW_PIXELS } from '@/engine/timeline/StateResolver'
import { TransportClock } from '@/engine/time/TransportClock'
import { useAutomationStore, type AutomationLane } from '@/store/useAutomationStore'
import { readToken } from '@/utils/tokens'

/** The surface clips live on — one row, the whole project wide.
 *
 *  This is the piece that makes automation reusable instead of one-shot. A clip is a box you
 *  can grab: drag the body to move it, drag an edge to change its length, press the copy button
 *  to put another one straight after it. Its pattern is drawn *inside* it, repeated as many
 *  times as its repeat count says, so the shape you will hear is the shape you can see — the
 *  same arrangement FL Studio's playlist uses for automation clips.
 *
 *  Behind the clips, faintly, is the stem's analysed signal. That is the reference the whole
 *  design rests on: you are drawing against a kick you can see, and outside every clip that
 *  signal is what actually drives the parameter.
 *
 *  Two layers on purpose. A canvas draws the signal and the curves, because a repeated pattern
 *  at pixel resolution is thousands of samples and has no business being DOM. The clip boxes
 *  themselves are DOM, because they need pointer capture, edge handles and hover states, and
 *  hit-testing a canvas by hand to get those back would be the same code with more bugs. */

const TRACK_HEIGHT = 46
/** Default clip length when there is no tempo to derive a bar from. */
const DEFAULT_CLIP_SECONDS = 2

type Drag =
  | { kind: 'move'; clipId: string; grabOffset: number }
  | { kind: 'resize-start'; clipId: string }
  | { kind: 'resize-end'; clipId: string }

export function ClipTrack({
  lane,
  duration,
  signal,
  beatGrid,
}: {
  lane: AutomationLane
  duration: number
  /** The stem's analysed signal, drawn behind the clips. Absent on a drawn lane. */
  signal?: (t: number) => number
  /** Beat times, for snapping. */
  beatGrid: readonly number[]
}) {
  const patterns = useAutomationStore((s) => s.patterns)
  const selectedClipId = useAutomationStore((s) => s.selectedClipId)
  const selectClip = useAutomationStore((s) => s.selectClip)
  const addClip = useAutomationStore((s) => s.addClip)
  const moveClip = useAutomationStore((s) => s.moveClip)
  const resizeClipEdge = useAutomationStore((s) => s.resizeClipEdge)
  const duplicateClip = useAutomationStore((s) => s.duplicateClip)
  const removeClip = useAutomationStore((s) => s.removeClip)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  const span = Math.max(1e-6, duration)

  /** One bar if we know the tempo, else a plain two seconds. A bar is the unit people think in,
   *  and a clip that lands on a musical length needs no adjusting afterwards. */
  const defaultLength = useMemo(() => {
    if (beatGrid.length < 2) return DEFAULT_CLIP_SECONDS
    const beat = beatGrid[1] - beatGrid[0]
    return beat > 0 ? beat * 4 : DEFAULT_CLIP_SECONDS
  }, [beatGrid])

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const box = containerRef.current?.getBoundingClientRect()
      if (!box || box.width === 0) return 0
      return Math.max(0, ((clientX - box.left) / box.width) * span)
    },
    [span],
  )

  const snap = useCallback(
    (time: number) => {
      const width = containerRef.current?.clientWidth ?? 1
      // Tolerance in pixels, converted through the current scale, so snapping feels the same
      // on a narrow row as on a wide one.
      return snapToGrid(time, beatGrid, (SNAP_WINDOW_PIXELS / Math.max(1, width)) * span)
    },
    [beatGrid, span],
  )

  // ─── Canvas: the analysed signal, and each clip's pattern where it will actually run ───
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const width = Math.max(1, Math.floor(container.clientWidth))
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = TRACK_HEIGHT * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, TRACK_HEIGHT)

    const midline = readToken('--color-aura-line', 'rgba(255,255,255,.07)')
    ctx.strokeStyle = midline
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, TRACK_HEIGHT / 2 + 0.5)
    ctx.lineTo(width, TRACK_HEIGHT / 2 + 0.5)
    ctx.stroke()

    // The analysed signal, behind everything. Faint, because it is context and not content —
    // except where no clip covers it, which is where it IS the content.
    if (signal) {
      ctx.beginPath()
      for (let x = 0; x < width; x++) {
        const value = Math.min(1, Math.max(0, signal((x / width) * span)))
        const y = TRACK_HEIGHT - value * TRACK_HEIGHT
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `${lane.color}44`
      ctx.stroke()
    }

    // Each clip's pattern, sampled per pixel through the same phase function the engine uses.
    for (const clip of lane.clips) {
      const pattern = patterns[clip.patternId]
      if (!pattern) continue

      const x0 = Math.round((clip.startTime / span) * width)
      const x1 = Math.round(((clip.startTime + clip.duration) / span) * width)
      if (x1 <= x0) continue

      ctx.beginPath()
      for (let x = x0; x <= x1; x++) {
        const t = (x / width) * span
        const value = samplePoints(pattern.points, pattern.interpolation, clipPhase(clip, t))
        const y = TRACK_HEIGHT - Math.min(1, Math.max(0, value)) * TRACK_HEIGHT
        if (x === x0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = pattern.color
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.lineTo(x1, TRACK_HEIGHT)
      ctx.lineTo(x0, TRACK_HEIGHT)
      ctx.closePath()
      ctx.fillStyle = `${pattern.color}2a`
      ctx.fill()
    }
  }, [lane.clips, lane.color, patterns, signal, span])

  useEffect(() => {
    draw()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Playhead, imperative.
  useEffect(() => {
    const line = playheadRef.current
    const container = containerRef.current
    if (!line || !container) return
    const apply = (time: number) => {
      line.style.transform = `translateX(${Math.min(1, time / span) * container.clientWidth}px)`
    }
    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [span])

  // Drag on the window: the pointer leaves a 46px row constantly, and a listener on the clip
  // would drop the gesture the moment it did.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const active = drag.current
      if (!active) return
      const time = snap(timeFromClientX(event.clientX))

      if (active.kind === 'move') {
        moveClip(lane.id, active.clipId, Math.max(0, time - active.grabOffset))
      } else {
        resizeClipEdge(
          lane.id,
          active.clipId,
          active.kind === 'resize-start' ? 'start' : 'end',
          time,
        )
      }
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [lane.id, moveClip, resizeClipEdge, snap, timeFromClientX])

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none touch-none"
      style={{ height: TRACK_HEIGHT }}
      onDoubleClick={(e) => {
        // Double-click empty track to place a clip. A single click would fight selection, and
        // a button would need somewhere to put the clip that is not where you pointed.
        const start = snap(timeFromClientX(e.clientX))
        addClip(lane.id, start, Math.min(defaultLength, Math.max(0.25, span - start)))
      }}
      title={lane.clips.length === 0 ? 'Double-click to place a clip' : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {lane.clips.map((clip) => {
        const pattern = patterns[clip.patternId]
        const selected = selectedClipId === clip.id
        const left = (clip.startTime / span) * 100
        const width = (clip.duration / span) * 100

        return (
          <div
            key={clip.id}
            onPointerDown={(e) => {
              e.stopPropagation()
              selectClip(clip.id)
              const box = e.currentTarget.getBoundingClientRect()
              drag.current = {
                kind: 'move',
                clipId: clip.id,
                grabOffset: ((e.clientX - box.left) / Math.max(1, box.width)) * clip.duration,
              }
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute top-0 bottom-0 rounded-sm cursor-grab active:cursor-grabbing group/clip"
            style={{
              left: `${left}%`,
              width: `${Math.max(0.4, width)}%`,
              border: `1px solid ${
                selected ? readToken('--color-aura-accent', '#6366f1') : (pattern?.color ?? '#888')
              }`,
              backgroundColor: selected ? 'rgba(99,102,241,0.08)' : 'transparent',
            }}
            title={`${pattern?.name ?? 'Clip'} · ${clip.duration.toFixed(2)}s${
              clip.repeat > 1 ? ` × ${clip.repeat}` : ''
            }`}
          >
            {/* Cycle divisions, so a repeat count is visible as structure rather than only as a
                number in a field. */}
            {clip.repeat > 1 &&
              Array.from({ length: clip.repeat - 1 }, (_, i) => (
                <span
                  key={i}
                  className="absolute top-0 bottom-0 w-px opacity-30"
                  style={{
                    left: `${((i + 1) / clip.repeat) * 100}%`,
                    backgroundColor: pattern?.color ?? '#888',
                  }}
                />
              ))}

            <span className="absolute left-1.5 top-0.5 right-8 text-[9px] leading-tight text-slate-300 pointer-events-none truncate">
              {pattern?.name}
              {clip.repeat > 1 ? ` ×${clip.repeat}` : ''}
            </span>

            {/* Edge handles. Wide enough to hit, narrow enough not to swallow a short clip. */}
            <span
              onPointerDown={(e) => {
                e.stopPropagation()
                selectClip(clip.id)
                drag.current = { kind: 'resize-start', clipId: clip.id }
              }}
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/25"
            />
            <span
              onPointerDown={(e) => {
                e.stopPropagation()
                selectClip(clip.id)
                drag.current = { kind: 'resize-end', clipId: clip.id }
              }}
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/25"
            />

            {selected && (
              <div className="absolute top-0.5 right-2 flex items-center gap-1">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => duplicateClip(lane.id, clip.id)}
                  title="Place another straight after — same pattern, so editing either changes both"
                  className="text-slate-400 hover:text-aura-accent transition-colors"
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeClip(lane.id, clip.id)}
                  title="Delete this clip. The pattern is kept, so it can be placed again"
                  className="text-slate-400 hover:text-aura-hot transition-colors"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      <div
        ref={playheadRef}
        className="absolute top-0 bottom-0 left-0 w-px pointer-events-none"
        style={{ backgroundColor: readToken('--color-aura-playhead', '#f1f5f9') }}
      />
    </div>
  )
}
