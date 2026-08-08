import { useEffect, useRef } from 'react'
import { previewConnection } from '@/engine/modulation/preview'
import { TransportClock } from '@/engine/time/TransportClock'
import { isTrackVisuallyActive } from '@/store/useAudioStore'
import { getGenerator } from '@/store/useGeneratorStore'
import { getLane, getPatterns } from '@/store/useAutomationStore'
import { getProcessor } from '@/store/useModulationStore'
import { readToken } from '@/utils/tokens'
import type { ModulationConnection } from '@/types/modulation'

interface ModulationGraphProps {
  connection: ModulationConnection
  baseValue: number
  /** Seconds either side of the playhead. */
  window?: number
  height?: number
  unit?: string
}

/** The modulation curve — what this connection actually does to the parameter, drawn
 *  over time.
 *
 *  This is the "show me the LFO underneath" view. It is not a diagram of the settings:
 *  it runs the real `SignalShaper` over the real feature timeline, so the drawn line is
 *  exactly the value the parameter will take. A slow Rise visibly lags the input here,
 *  because it genuinely does.
 *
 *  Redraws on the transport clock, imperatively, on a canvas — never through React
 *  state (HC-1). */
export function ModulationGraph({
  connection,
  baseValue,
  window: windowSeconds = 4,
  height = 92,
  unit,
}: ModulationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = (time: number) => {
      const parent = canvas.parentElement
      const width = Math.max(1, Math.floor(parent?.clientWidth ?? 240))
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const from = time - windowSeconds / 2
      const to = time + windowSeconds / 2
      const preview = previewConnection(connection, baseValue, from, to, {
        isTrackActive: isTrackVisuallyActive,
        getGenerator,
        getLane,
        getPatterns,
        getProcessor,
      })

      const span = preview.max - preview.min || 1
      const toY = (value: number) => height - ((value - preview.min) / span) * (height - 8) - 4
      const toX = (index: number) => (index / (preview.values.length - 1)) * width

      // Base value reference — the line the parameter sits on with no modulation.
      if (baseValue >= preview.min && baseValue <= preview.max) {
        ctx.strokeStyle = readToken('--color-aura-line', 'rgba(255,255,255,.07)')
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(0, toY(baseValue))
        ctx.lineTo(width, toY(baseValue))
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Ghost of the raw field, so you can see what the shaping did to it.
      ctx.strokeStyle = readToken('--color-aura-node-signal', '#f97316')
      ctx.globalAlpha = 0.28
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < preview.raw.length; i++) {
        const y = height - preview.raw[i] * (height - 8) - 4
        if (i === 0) ctx.moveTo(toX(i), y)
        else ctx.lineTo(toX(i), y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1

      // The real output.
      ctx.strokeStyle = readToken('--color-aura-accent', '#6366f1')
      ctx.lineWidth = 1.75
      ctx.beginPath()
      for (let i = 0; i < preview.values.length; i++) {
        const y = toY(preview.values[i])
        if (i === 0) ctx.moveTo(toX(i), y)
        else ctx.lineTo(toX(i), y)
      }
      ctx.stroke()

      // Playhead sits at the centre; the curve scrolls under it.
      const centre = width / 2
      ctx.strokeStyle = readToken('--color-aura-playhead', '#f1f5f9')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(centre, 0)
      ctx.lineTo(centre, height)
      ctx.stroke()

      const now = preview.values[Math.floor(preview.values.length / 2)]
      ctx.fillStyle = readToken('--color-aura-playhead', '#f1f5f9')
      ctx.beginPath()
      ctx.arc(centre, toY(now), 2.5, 0, Math.PI * 2)
      ctx.fill()

      if (labelRef.current) {
        labelRef.current.textContent = `${now.toFixed(2)}${unit ?? ''}`
      }
    }

    draw(TransportClock.time)
    return TransportClock.subscribe(draw)
  }, [connection, baseValue, windowSeconds, height, unit])

  return (
    <div className="relative w-full">
      <canvas ref={canvasRef} className="w-full block" style={{ height }} />
      <span
        ref={labelRef}
        className="absolute top-1 right-1 font-mono tabular-nums text-[10px] text-slate-300 px-1 rounded bg-aura-base/80"
      />
    </div>
  )
}
