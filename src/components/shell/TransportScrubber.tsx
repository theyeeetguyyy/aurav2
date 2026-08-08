import { useCallback, useEffect, useRef } from 'react'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { TransportClock } from '@/engine/time/TransportClock'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { projectDuration, useAudioStore } from '@/store/useAudioStore'
import { useProjectStore } from '@/store/useProjectStore'
import { readToken } from '@/utils/tokens'

/** The always-there scrub bar, in the transport strip.
 *
 *  Every page needs to move the playhead. Before this, only the two pages that happened to
 *  draw a timeline could — so listening to a specific moment while editing a material meant
 *  switching tabs, scrubbing, and switching back.
 *
 *  Drawn imperatively from `TransportClock` (HC-1): the playhead moves every frame, and a
 *  component that re-rendered for it would re-render the whole shell sixty times a second.
 *
 *  It also carries the section markers, which makes it a map rather than just a slider — the
 *  one place on every page that tells you where the drop is. */
export function TransportScrubber() {
  const tracks = useAudioStore((s) => s.tracks)
  const markers = useProjectStore((s) => s.project.markers)
  const duration = projectDuration(tracks)

  const trackRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const seekTo = useCallback(
    (clientX: number) => {
      const box = trackRef.current?.getBoundingClientRect()
      if (!box || box.width === 0 || duration <= 0) return
      const fraction = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
      MultiTrackRack.getInstance().seek(fraction * duration)
    },
    [duration],
  )

  // Imperative playhead. `scaleX` rather than `width` so it never triggers layout.
  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return
    const apply = (time: number) => {
      const progress = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0
      fill.style.transform = `scaleX(${progress})`
      // Percentage, so the handle tracks the track's real width without measuring it.
      if (handleRef.current) handleRef.current.style.left = `${progress * 100}%`
    }
    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [duration])

  // Drag on the window, not the element: the pointer leaves the 6px-tall bar constantly, and
  // a listener on the bar would drop the gesture the moment it did.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragging.current) seekTo(e.clientX)
    }
    const onUp = () => {
      dragging.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [seekTo])

  const empty = duration <= 0

  /** Beat ticks, but only while they stay legible. A four-minute track at 128 BPM is 512
   *  beats across maybe 500 pixels — drawn, that is a solid bar that says nothing. */
  const beats = (() => {
    if (empty) return []
    for (const track of tracks) {
      const grid = AudioFeatures.getBeatGrid(track.id)
      if (grid.length > 0 && grid.length <= 96) return grid
    }
    return []
  })()

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        if (empty) return
        dragging.current = true
        seekTo(e.clientX)
      }}
      title={empty ? 'Import stems to give the project a length' : 'Click or drag to seek'}
      role="slider"
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, duration)}
      aria-valuenow={TransportClock.time}
      tabIndex={empty ? -1 : 0}
      onKeyDown={(e) => {
        if (empty) return
        // Arrow keys nudge a second, which is the granularity someone reaching for a keyboard
        // rather than a pointer is after.
        const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        if (delta === 0) return
        e.preventDefault()
        MultiTrackRack.getInstance().seek(
          Math.min(duration, Math.max(0, TransportClock.time + delta)),
        )
      }}
      className={`group relative h-6 flex-1 min-w-[160px] max-w-[640px] flex items-center outline-none ${
        empty ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* The track. Thin, but the hit area above is a full 24px — the reason this felt
          un-draggable was a six-pixel target, not a missing listener. */}
      <div className="relative w-full h-1.5 rounded-full bg-aura-surface overflow-hidden">
        {beats.map((time, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-aura-line"
            style={{ left: `${(time / duration) * 100}%` }}
          />
        ))}

        {markers.map((marker) => (
          <span
            key={marker.id}
            title={marker.label}
            className="absolute top-0 bottom-0 w-[2px]"
            style={{
              left: `${Math.min(100, (marker.time / duration) * 100)}%`,
              backgroundColor: readToken('--color-aura-state-solo', '#f59e0b'),
            }}
          />
        ))}

        <div
          ref={fillRef}
          className="absolute inset-0 origin-left bg-aura-accent/70 pointer-events-none"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      {/* The handle. What makes it look like something you can take hold of, and what your
          pointer is actually aiming at. */}
      {!empty && (
        <div
          ref={handleRef}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-aura-accent ring-2 ring-aura-base pointer-events-none transition-transform group-hover:scale-125"
        />
      )}
    </div>
  )
}
