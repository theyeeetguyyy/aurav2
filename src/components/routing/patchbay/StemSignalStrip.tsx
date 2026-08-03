import { useEffect, useRef } from 'react'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { TransportClock } from '@/engine/time/TransportClock'
import type { FeatureKey } from '@/engine/audio/featureTypes'

interface StemSignalStripProps {
  trackId: string
  color: string
  metric?: FeatureKey
  height?: number
  /** Seconds either side of the playhead. */
  window?: number
}

/** The signal a stem is actually producing, drawn over time.
 *
 *  This is the stem's own "LFO" — the shape that everything wired from it inherits. Seeing
 *  it under the stem name is what makes a routing decision informed: you can tell at a
 *  glance whether a stem is a steady pad or a sparse percussive hit before wiring it to
 *  anything.
 *
 *  Drawn on the transport clock, imperatively (HC-1). Sampling is by time, not by tap, so
 *  it draws the FUTURE as well as the past — a live analyser could only ever draw
 *  backwards. */
export function StemSignalStrip({
  trackId,
  color,
  metric = 'envelope',
  height = 22,
  window: windowSeconds = 6,
}: StemSignalStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = (time: number) => {
      const width = Math.max(1, Math.floor(canvas.parentElement?.clientWidth ?? 200))
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      if (!AudioFeatures.has(trackId)) return

      const from = time - windowSeconds / 2
      const step = windowSeconds / width

      ctx.fillStyle = color
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (let x = 0; x < width; x++) {
        const value = AudioFeatures.sample(trackId, metric, from + x * step)
        ctx.lineTo(x, height - value * (height - 2))
      }
      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1

      // Playhead at centre. Everything to its right has not happened yet — which is
      // only drawable because features are timelines (HC-3).
      const centre = width / 2
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(centre, 0)
      ctx.lineTo(centre, height)
      ctx.stroke()
    }

    draw(TransportClock.time)
    return TransportClock.subscribe(draw)
  }, [trackId, color, metric, height, windowSeconds])

  return (
    <div className="px-2 pb-1">
      <canvas ref={canvasRef} className="w-full block rounded-sm bg-aura-void" style={{ height }} />
    </div>
  )
}
