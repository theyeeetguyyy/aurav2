import { useEffect, useRef } from 'react'
import { TransportClock } from '@/engine/time/TransportClock'

interface WaveformCanvasProps {
  buffer: AudioBuffer
  color: string
  height?: number
  /** Timeline span this waveform represents. Defaults to the buffer's own length.
   *
   *  In the rack this is the PROJECT duration, not the buffer's, so a 30-second stem
   *  occupies half the width of a 60-second one. Drawing each stem across its own length
   *  made every row a different time scale — which is what put four playheads at four
   *  different positions. */
  duration?: number
}

/** Peak waveform renderer.
 *
 *  Draws TWICE, statically: one canvas in the dim "unplayed" tint, one in the full
 *  "played" colour stacked above it. Playback progress then only adjusts a CSS
 *  clip-path and a transform — no pixels are ever redrawn during playback.
 *
 *  The previous implementation repainted every waveform bar on every frame purely to
 *  advance a 1px playhead line, driven by a React prop updated 60×/sec. With eight
 *  stems that was eight full canvas repaints plus a reconciliation pass per frame.
 *  Progress is now read imperatively from TransportClock (HC-1) and never enters
 *  React state at all. */
export function WaveformCanvas({ buffer, color, height = 48, duration }: WaveformCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const futureRef = useRef<HTMLCanvasElement>(null)
  const pastRef = useRef<HTMLCanvasElement>(null)

  const span = duration ?? buffer.duration
  // Fraction of the shared timeline this stem actually occupies.
  const extent = span > 0 ? Math.min(1, buffer.duration / span) : 1

  // ─── Static draw: peaks + both colour layers. Re-runs only on real changes. ───
  useEffect(() => {
    const container = containerRef.current
    const future = futureRef.current
    const past = pastRef.current
    if (!container || !future || !past) return

    const draw = () => {
      // The canvas covers only this stem's share of the row, so peaks stay on the
      // shared time scale instead of being stretched to fill it.
      const width = Math.max(1, Math.floor(container.clientWidth * extent))
      const dpr = window.devicePixelRatio || 1

      for (const canvas of [future, past]) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      const channel = buffer.getChannelData(0)
      const samplesPerPeak = Math.max(1, Math.floor(channel.length / width))
      const peaks = new Float32Array(width)

      for (let i = 0; i < width; i++) {
        let max = 0
        const start = i * samplesPerPeak
        const end = Math.min(start + samplesPerPeak, channel.length)
        for (let j = start; j < end; j++) {
          const abs = Math.abs(channel[j])
          if (abs > max) max = abs
        }
        peaks[i] = max
      }

      const mid = height / 2
      const paint = (canvas: HTMLCanvasElement, fill: string) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = fill
        for (let i = 0; i < width; i++) {
          const barHeight = peaks[i] * mid * 0.9
          ctx.fillRect(i, mid - barHeight, 1, barHeight * 2)
        }
      }

      paint(future, `${color}44`)
      paint(past, color)
    }

    draw()

    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [buffer, color, height, extent])

  // ─── Live progress: imperative, zero React renders. ───
  //
  // The playhead itself is NOT drawn here. One line for the whole rack is drawn by the
  // page, so it reads as a single transport position rather than as one marker per stem.
  useEffect(() => {
    const past = pastRef.current
    if (!past) return

    const apply = (time: number) => {
      const played = buffer.duration > 0 ? Math.min(Math.max(time / buffer.duration, 0), 1) : 0
      // Reveal the "played" layer left-to-right.
      past.style.clipPath = `inset(0 ${(1 - played) * 100}% 0 0)`
    }

    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [buffer])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${extent * 100}%` }}
      >
        <canvas ref={futureRef} className="absolute inset-0 w-full h-full block" />
        <canvas ref={pastRef} className="absolute inset-0 w-full h-full block" />
      </div>
    </div>
  )
}
