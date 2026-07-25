import { useCallback, useRef, useState } from 'react'
import type { TrimBounds } from '@/types/audio'

interface TrimHandlesProps {
  /** Total duration of the track in seconds */
  duration: number
  /** Current trim bounds */
  trimBounds: TrimBounds
  /** Called when trim bounds change */
  onTrimChange: (bounds: TrimBounds) => void
  /** Track color for the trimmed region highlight */
  color: string
  /** Height of the handles overlay */
  height?: number
}

type DragTarget = 'start' | 'end' | null

/** Draggable trim handles overlay for waveform tracks.
 *  Renders transparent dimming on trimmed-out regions and
 *  two vertical drag handles at the trim in/out points. */
export function TrimHandles({
  duration,
  trimBounds,
  onTrimChange,
  color,
  height = 32,
}: TrimHandlesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<DragTarget>(null)

  /** Convert a mouse/pointer X position to a time value */
  const xToTime = useCallback(
    (clientX: number): number => {
      const el = containerRef.current
      if (!el || duration <= 0) return 0
      const rect = el.getBoundingClientRect()
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return fraction * duration
    },
    [duration],
  )

  const handlePointerDown = useCallback(
    (target: DragTarget) => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(target)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return
      const time = xToTime(e.clientX)
      const MIN_REGION = 0.05 // minimum 50ms trim region

      if (dragging === 'start') {
        onTrimChange({
          start: Math.min(time, trimBounds.end - MIN_REGION),
          end: trimBounds.end,
        })
      } else if (dragging === 'end') {
        onTrimChange({
          start: trimBounds.start,
          end: Math.max(time, trimBounds.start + MIN_REGION),
        })
      }
    },
    [dragging, xToTime, onTrimChange, trimBounds],
  )

  const handlePointerUp = useCallback(() => {
    setDragging(null)
  }, [])

  const startFrac = duration > 0 ? trimBounds.start / duration : 0
  const endFrac = duration > 0 ? trimBounds.end / duration : 1

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ height }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Dimmed out region — before trim start */}
      {startFrac > 0 && (
        <div
          className="absolute top-0 bottom-0 bg-black/60"
          style={{ left: 0, width: `${startFrac * 100}%` }}
        />
      )}

      {/* Dimmed out region — after trim end */}
      {endFrac < 1 && (
        <div
          className="absolute top-0 bottom-0 bg-black/60"
          style={{ left: `${endFrac * 100}%`, right: 0 }}
        />
      )}

      {/* Start handle */}
      <div
        onPointerDown={handlePointerDown('start')}
        className="absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:w-2 transition-all group/handle z-10"
        style={{ left: `${startFrac * 100}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="w-full h-full rounded-sm opacity-80 group-hover/handle:opacity-100 transition-opacity"
          style={{ backgroundColor: color }}
        />
      </div>

      {/* End handle */}
      <div
        onPointerDown={handlePointerDown('end')}
        className="absolute top-0 bottom-0 w-1.5 cursor-col-resize hover:w-2 transition-all group/handle z-10"
        style={{ left: `${endFrac * 100}%`, transform: 'translateX(-50%)' }}
      >
        <div
          className="w-full h-full rounded-sm opacity-80 group-hover/handle:opacity-100 transition-opacity"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}
