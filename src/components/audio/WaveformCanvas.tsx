import { useEffect, useRef } from 'react'

interface WaveformCanvasProps {
  buffer: AudioBuffer
  color: string
  /** Current playhead position as a fraction 0–1 */
  progress?: number
  height?: number
}

/** Canvas-based waveform renderer.
 *  Draws downsampled peak data from an AudioBuffer.
 *  Uses a single offscreen draw + a progress overlay. */
export function WaveformCanvas({
  buffer,
  color,
  progress = 0,
  height = 48,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaksRef = useRef<Float32Array | null>(null)

  // Compute peaks once when buffer changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.parentElement?.clientWidth ?? 600
    canvas.width = width
    canvas.height = height

    const channelData = buffer.getChannelData(0)
    const samplesPerPeak = Math.floor(channelData.length / width)
    const peaks = new Float32Array(width)

    for (let i = 0; i < width; i++) {
      let max = 0
      const start = i * samplesPerPeak
      const end = Math.min(start + samplesPerPeak, channelData.length)
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j])
        if (abs > max) max = abs
      }
      peaks[i] = max
    }

    peaksRef.current = peaks
  }, [buffer, height])

  // Redraw on peaks change or progress change
  useEffect(() => {
    const canvas = canvasRef.current
    const peaks = peaksRef.current
    if (!canvas || !peaks) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const mid = h / 2

    ctx.clearRect(0, 0, w, h)

    // Waveform bars
    for (let i = 0; i < peaks.length; i++) {
      const barHeight = peaks[i] * mid * 0.9
      const isPast = i / w <= progress

      ctx.fillStyle = isPast ? color : `${color}44`
      ctx.fillRect(i, mid - barHeight, 1, barHeight * 2)
    }

    // Playhead line
    if (progress > 0 && progress < 1) {
      const x = Math.floor(progress * w)
      ctx.fillStyle = '#f1f5f9'
      ctx.fillRect(x, 0, 1, h)
    }
  }, [progress, color])

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{ height }}
    />
  )
}
