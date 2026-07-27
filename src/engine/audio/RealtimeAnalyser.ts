/** RealtimeAnalyser — per-track live audio feature extraction via Meyda.
 *
 *  Taps each track PRE-FADER (docs/03-ARCHITECTURE.md HC-11) so volume and mute
 *  never affect visuals, and writes straight into AudioDataBus. Zero React state.
 *
 *  SCOPE (HC-3): this is the *live* path. It answers "what is happening now" and is
 *  correct for preview only. Offline export renders frames out of order and faster
 *  than real time, which a live analyser structurally cannot serve. Phase 2G adds
 *  AudioFeatures — dense feature timelines computed once on import by an essentia.js
 *  worker and sampled by time — which becomes the source of truth for both preview
 *  and export. This module then survives only for live-microphone input. */

import Meyda from 'meyda'
import { AudioDataBus, BusIndex, BAND_COUNT } from './AudioDataBus'
import { MultiTrackRack } from './MultiTrackRack'
import type { ID } from '@/types/audio'

/** Band edges in Hz: sub · bass · low-mid · mid · upper-mid · presence · brilliance */
const BAND_EDGES_HZ = [20, 60, 250, 500, 2000, 4000, 6000, 20000]

const FFT_SIZE = 1024
const BUFFER_SIZE = 512

/** Per-band adaptive gain. Each band tracks its own slowly-decaying peak and
 *  normalises against it.
 *
 *  Why adaptive rather than fixed constants: the bands span wildly unequal bin
 *  counts — `sub` (20–60 Hz) covers roughly one FFT bin while `brilliance`
 *  (6–20 kHz) covers over 150. Any fixed scaling leaves sub pinned high and
 *  brilliance pinned near zero, which a user experiences as "nothing reacts to
 *  my hats". Adaptive per-band gain makes every band responsive regardless of
 *  bin count or source material. */
const PEAK_DECAY = 0.999
const MIN_PEAK = 1e-4

interface TrackAnalyser {
  meyda: ReturnType<typeof Meyda.createMeydaAnalyzer>
  analyserNode: AnalyserNode
  tapSource: AudioNode
  /** Rolling per-band peaks for adaptive normalisation. */
  bandPeaks: Float32Array
}

class RealtimeAnalyserImpl {
  private readonly analysers = new Map<ID, TrackAnalyser>()
  private readonly bandScratch = new Float32Array(BAND_COUNT)

  /** Register a track for live analysis. Must run after MultiTrackRack.registerTrack. */
  register(trackId: ID): void {
    if (this.analysers.has(trackId)) return

    const rack = MultiTrackRack.getInstance()
    const ctx = rack.getContext()

    const tapSource = rack.getAnalysisNode(trackId)
    if (!tapSource) {
      console.warn(`[RealtimeAnalyser] Track ${trackId} not registered in MultiTrackRack`)
      return
    }

    const analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = FFT_SIZE
    analyserNode.smoothingTimeConstant = 0.8
    tapSource.connect(analyserNode)

    AudioDataBus.allocate(trackId)

    const bandPeaks = new Float32Array(BAND_COUNT).fill(MIN_PEAK)

    const meyda = Meyda.createMeydaAnalyzer({
      audioContext: ctx,
      source: analyserNode,
      bufferSize: BUFFER_SIZE,
      featureExtractors: ['rms', 'spectralCentroid', 'amplitudeSpectrum'],
      callback: (features: Record<string, unknown>) => {
        AudioDataBus.write(trackId, BusIndex.RMS, (features.rms as number) ?? 0)

        const spectrum = features.amplitudeSpectrum as Float32Array | undefined
        if (!spectrum || spectrum.length === 0) return

        // Meyda's spectralCentroid returns a *bin index*, not a frequency — it is
        // sum(k·|A[k]|) / sum(|A[k]|) over bin index k. Normalising by the Nyquist
        // frequency (the previous behaviour) pinned it near 0.005 permanently.
        // The correct normaliser is the bin count.
        const centroidBin = (features.spectralCentroid as number) ?? 0
        AudioDataBus.write(
          trackId,
          BusIndex.SPECTRAL_CENTROID,
          clamp01(centroidBin / spectrum.length),
        )

        this.computeBands(spectrum, ctx.sampleRate, bandPeaks)
        AudioDataBus.writeBands(trackId, this.bandScratch)
      },
    })

    meyda.start()
    this.analysers.set(trackId, { meyda, analyserNode, tapSource, bandPeaks })
  }

  unregister(trackId: ID): void {
    const entry = this.analysers.get(trackId)
    if (!entry) return

    entry.meyda.stop()
    try {
      entry.tapSource.disconnect(entry.analyserNode)
    } catch {
      // Already disconnected — safe to ignore.
    }
    entry.analyserNode.disconnect()
    this.analysers.delete(trackId)
    AudioDataBus.release(trackId)
  }

  dispose(): void {
    for (const id of [...this.analysers.keys()]) this.unregister(id)
    AudioDataBus.dispose()
  }

  /** Compute seven normalised band energies into `this.bandScratch`.
   *
   *  Sums *power* (amplitude²) rather than raw amplitude, takes the per-bin mean so
   *  wide bands are not inflated by bin count alone, converts to an RMS magnitude,
   *  then divides by a slowly-decaying per-band peak. Allocation-free. */
  private computeBands(spectrum: Float32Array, sampleRate: number, peaks: Float32Array): void {
    const binCount = spectrum.length
    const nyquist = sampleRate / 2

    for (let band = 0; band < BAND_COUNT; band++) {
      const loBin = Math.floor((BAND_EDGES_HZ[band] / nyquist) * binCount)
      const hiBin = Math.min(Math.ceil((BAND_EDGES_HZ[band + 1] / nyquist) * binCount), binCount - 1)

      let power = 0
      let bins = 0
      for (let i = loBin; i <= hiBin; i++) {
        power += spectrum[i] * spectrum[i]
        bins++
      }

      const magnitude = bins > 0 ? Math.sqrt(power / bins) : 0

      // Adaptive normalisation: rise instantly to a new peak, decay slowly.
      const decayed = Math.max(peaks[band] * PEAK_DECAY, MIN_PEAK)
      peaks[band] = Math.max(decayed, magnitude)

      this.bandScratch[band] = clamp01(magnitude / peaks[band])
    }
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export const RealtimeAnalyser = new RealtimeAnalyserImpl()
