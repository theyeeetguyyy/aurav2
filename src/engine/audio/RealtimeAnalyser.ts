/** RealtimeAnalyser — Per-track Meyda-based real-time audio feature extractor.
 *
 *  Creates one Meyda analyser per registered track, connected to the track's
 *  audio node chain. Extracts RMS, spectral centroid, and 7-band energies
 *  at ~60 FPS via requestAnimationFrame, writing directly to AudioDataBus.
 *
 *  ZERO React state touched. */

import Meyda from 'meyda'
import { AudioDataBus, BusIndex } from './AudioDataBus'
import { MultiTrackRack } from './MultiTrackRack'
import type { ID } from '@/types/audio'

/** 7-band frequency boundaries in Hz, mapped to 512 FFT bins at 44.1kHz.
 *  Sub / Bass / Low-Mid / Mid / Upper-Mid / Presence / Brilliance */
const BAND_EDGES_HZ = [20, 60, 250, 500, 2000, 4000, 6000, 20000]

interface TrackAnalyser {
  analyser: ReturnType<typeof Meyda.createMeydaAnalyzer>
  splitterNode: AnalyserNode
}

class RealtimeAnalyserImpl {
  private analysers: Map<ID, TrackAnalyser> = new Map()
  private rafId: number | null = null
  private running = false

  /** Register a track for real-time analysis.
   *  Must be called AFTER the track is registered in MultiTrackRack. */
  register(trackId: ID): void {
    if (this.analysers.has(trackId)) return

    const rack = MultiTrackRack.getInstance()
    const ctx = rack.getContext()

    // Create an AnalyserNode tapped from the track's gain node
    const analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = 1024
    analyserNode.smoothingTimeConstant = 0.8

    // Connect track's gain → analyser (analysis tap, doesn't affect output)
    const node = rack.trackNodes.get(trackId)
    if (!node) {
      console.warn(`[RealtimeAnalyser] Track ${trackId} not found in MultiTrackRack`)
      return
    }
    node.gainNode.connect(analyserNode)

    // Allocate bus slot
    AudioDataBus.allocate(trackId)

    // Create Meyda analyser
    const meydaAnalyser = Meyda.createMeydaAnalyzer({
      audioContext: ctx,
      source: analyserNode,
      bufferSize: 512,
      featureExtractors: ['rms', 'spectralCentroid', 'amplitudeSpectrum'],
      callback: (features: Record<string, unknown>) => {
        // RMS
        const rms = (features.rms as number) ?? 0
        AudioDataBus.write(trackId, BusIndex.RMS, rms)

        // Spectral centroid (normalize to 0–1 range: divide by Nyquist)
        const nyquist = ctx.sampleRate / 2
        const centroid = ((features.spectralCentroid as number) ?? 0) / nyquist
        AudioDataBus.write(trackId, BusIndex.SPECTRAL_CENTROID, Math.min(1, centroid))

        // 7-band energy from amplitude spectrum
        const spectrum = features.amplitudeSpectrum as Float32Array | undefined
        if (spectrum) {
          const bands = this.computeBands(spectrum, ctx.sampleRate)
          AudioDataBus.writeBands(trackId, bands)
        }
      },
    })

    meydaAnalyser.start()

    this.analysers.set(trackId, {
      analyser: meydaAnalyser,
      splitterNode: analyserNode,
    })

    // Start the rAF loop if not already running
    if (!this.running) {
      this.start()
    }
  }

  /** Unregister a track from real-time analysis */
  unregister(trackId: ID): void {
    const entry = this.analysers.get(trackId)
    if (!entry) return

    entry.analyser.stop()
    entry.splitterNode.disconnect()
    this.analysers.delete(trackId)
    AudioDataBus.release(trackId)

    // Stop rAF if no tracks remain
    if (this.analysers.size === 0) {
      this.stop()
    }
  }

  /** Compute 7-band energies from a linear amplitude spectrum.
   *  Sums bin magnitudes within each frequency band and normalizes. */
  private computeBands(spectrum: Float32Array, sampleRate: number): number[] {
    const binCount = spectrum.length
    const nyquist = sampleRate / 2
    const bands = new Array<number>(7).fill(0)

    for (let band = 0; band < 7; band++) {
      const loHz = BAND_EDGES_HZ[band]
      const hiHz = BAND_EDGES_HZ[band + 1]

      const loBin = Math.floor((loHz / nyquist) * binCount)
      const hiBin = Math.min(Math.ceil((hiHz / nyquist) * binCount), binCount - 1)

      let sum = 0
      let count = 0
      for (let i = loBin; i <= hiBin; i++) {
        sum += spectrum[i]
        count++
      }
      // Average amplitude in this band, clamped to 0–1
      bands[band] = count > 0 ? Math.min(1, sum / count) : 0
    }

    return bands
  }

  private start(): void {
    if (this.running) return
    this.running = true
    // Meyda analysers run internally via ScriptProcessorNode / AudioWorklet.
    // We don't need our own rAF loop — Meyda's callback fires at the audio rate.
    // But we keep a lightweight heartbeat to ensure the bus stays warm.
    const heartbeat = () => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(heartbeat)
    }
    this.rafId = requestAnimationFrame(heartbeat)
  }

  private stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  /** Clean up all analysers */
  dispose(): void {
    for (const [id] of this.analysers) {
      this.unregister(id)
    }
    this.stop()
    AudioDataBus.dispose()
  }
}

/** Singleton instance */
export const RealtimeAnalyser = new RealtimeAnalyserImpl()
