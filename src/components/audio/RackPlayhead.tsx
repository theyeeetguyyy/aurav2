import { useEffect, useRef } from 'react'
import { TransportClock } from '@/engine/time/TransportClock'
import { readToken } from '@/utils/tokens'

/** One playhead for the whole stem rack.
 *
 *  Previously each waveform drew its own, on its own time scale, so four stems of
 *  different lengths produced four markers at four different positions — which reads as
 *  four transports rather than one.
 *
 *  Positioned by measuring a real lane element rather than by hardcoding the width of the
 *  controls beside it, so the line stays aligned when a control is added or the panel is
 *  resized. Driven imperatively off `TransportClock` (HC-1). */
export function RackPlayhead({
  containerRef,
  duration,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  duration: number
}) {
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const line = lineRef.current
    const container = containerRef.current
    if (!line || !container) return

    let laneLeft = 0
    let laneWidth = 0
    let laneTop = 0
    let laneBottom = 0

    const measure = () => {
      const lanes = container.querySelectorAll<HTMLElement>('[data-stem-lane]')
      if (lanes.length === 0) {
        laneWidth = 0
        return
      }
      const box = container.getBoundingClientRect()
      const first = lanes[0].getBoundingClientRect()
      const last = lanes[lanes.length - 1].getBoundingClientRect()

      laneLeft = first.left - box.left
      laneWidth = first.width
      laneTop = first.top - box.top + container.scrollTop
      laneBottom = last.bottom - box.top + container.scrollTop
    }

    const apply = (time: number) => {
      if (laneWidth === 0) {
        line.style.opacity = '0'
        return
      }
      const progress = duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0
      line.style.transform = `translateX(${laneLeft + progress * laneWidth}px)`
      line.style.top = `${laneTop}px`
      line.style.height = `${Math.max(0, laneBottom - laneTop)}px`
      line.style.opacity = '1'
    }

    measure()
    apply(TransportClock.time)

    const observer = new ResizeObserver(() => {
      measure()
      apply(TransportClock.time)
    })
    observer.observe(container)

    const unsubscribe = TransportClock.subscribe(apply)
    return () => {
      observer.disconnect()
      unsubscribe()
    }
  }, [containerRef, duration])

  return (
    <div
      ref={lineRef}
      className="absolute left-0 w-px pointer-events-none opacity-0 z-10"
      style={{ backgroundColor: readToken('--color-aura-playhead', '#f1f5f9') }}
    />
  )
}
