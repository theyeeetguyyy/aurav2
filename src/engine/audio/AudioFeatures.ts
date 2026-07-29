import {
  FEATURE_RATE,
  type AnalysisRequest,
  type AnalysisResponse,
  type FeatureKey,
  type TrackFeatures,
} from './featureTypes'
import type { ID } from '@/types/audio'

/** AudioFeatures — the source of truth for audio-derived values
 *  (docs/03-ARCHITECTURE.md HC-3).
 *
 *  The contract is `sample(track, metric, t)` — a value AT A TIME, not "the value now".
 *  That distinction is the whole point:
 *
 *    - Preview samples at `TransportClock.time`
 *    - Export samples at `frameIndex / fps`, out of order and faster than real time
 *    - Scrubbing backwards returns exactly what forwards playback returned
 *
 *  A live analyser can serve only the first. Building the modulation matrix on live
 *  taps would mean preview and export produce different videos — discovered at Phase 8,
 *  after every consumer had been written against the wrong contract. */

type ProgressListener = (trackId: ID, state: 'started' | 'done' | 'failed') => void

class AudioFeaturesImpl {
  private readonly features = new Map<ID, TrackFeatures>()
  private readonly pending = new Map<ID, (features: TrackFeatures) => void>()
  private readonly listeners = new Set<ProgressListener>()
  private worker: Worker | null = null

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), {
        type: 'module',
      })
      this.worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
        const { trackId, features } = event.data
        this.features.set(trackId, features)
        this.pending.get(trackId)?.(features)
        this.pending.delete(trackId)
        this.emit(trackId, 'done')
      }
      this.worker.onerror = (event) => {
        console.error('[AudioFeatures] analysis worker failed:', event.message)
        for (const trackId of this.pending.keys()) this.emit(trackId, 'failed')
        this.pending.clear()
      }
    }
    return this.worker
  }

  /** Analyse a decoded buffer. Runs once per stem, on import. */
  analyse(trackId: ID, buffer: AudioBuffer): Promise<TrackFeatures> {
    this.emit(trackId, 'started')

    // Mono sum. Copying is mandatory: getChannelData returns a view into the
    // AudioBuffer's own storage, and transferring it would detach the buffer that
    // playback is about to use.
    const channels = buffer.numberOfChannels
    const length = buffer.length
    const samples = new Float32Array(length)

    if (channels === 1) {
      samples.set(buffer.getChannelData(0))
    } else {
      for (let channel = 0; channel < channels; channel++) {
        const data = buffer.getChannelData(channel)
        for (let i = 0; i < length; i++) samples[i] += data[i]
      }
      for (let i = 0; i < length; i++) samples[i] /= channels
    }

    const request: AnalysisRequest = { trackId, samples, sampleRate: buffer.sampleRate }

    return new Promise((resolve) => {
      this.pending.set(trackId, resolve)
      this.getWorker().postMessage(request, [samples.buffer])
    })
  }

  /** Value of a metric at time `t`, linearly interpolated between frames.
   *
   *  Deterministic: the same `t` always returns the same value, regardless of playback
   *  state, direction, or how many times it is called. */
  sample(trackId: ID, key: FeatureKey, t: number): number {
    const features = this.features.get(trackId)
    if (!features) return 0

    const timeline = features.timelines[key]
    if (!timeline || timeline.length === 0) return 0

    const position = t * FEATURE_RATE
    if (position <= 0) return timeline[0]
    if (position >= timeline.length - 1) return timeline[timeline.length - 1]

    const index = Math.floor(position)
    const fraction = position - index
    return timeline[index] * (1 - fraction) + timeline[index + 1] * fraction
  }

  /** Onsets in the half-open interval [from, to).
   *
   *  Discrete events are an INTERVAL QUERY, not a callback (Principle 4). The exporter
   *  steps frames at irregular wall-clock intervals, so "did a hit occur since the last
   *  frame" cannot be answered by anything that fires on a timer. */
  onsetsBetween(trackId: ID, from: number, to: number): number[] {
    const onsets = this.features.get(trackId)?.onsetTimes
    if (!onsets || to <= from) return []
    return onsets.filter((time) => time >= from && time < to)
  }

  /** Time of the most recent onset at or before `t`, or null if none.
   *
   *  The basis for stateless event triggers: an impulse's value is derived from the
   *  AGE of the last hit, not accumulated frame by frame. That keeps discrete events a
   *  pure function of time, so scrubbing backwards and rendering frames out of order
   *  both stay correct. Binary search — onsetTimes is sorted by construction. */
  lastOnsetAtOrBefore(trackId: ID, t: number): number | null {
    const onsets = this.features.get(trackId)?.onsetTimes
    if (!onsets || onsets.length === 0 || t < onsets[0]) return null

    let lo = 0
    let hi = onsets.length - 1
    let best = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (onsets[mid] <= t) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return best === -1 ? null : onsets[best]
  }

  /** Whether any onset falls in [from, to) — the common case, without allocating. */
  hasOnsetBetween(trackId: ID, from: number, to: number): boolean {
    const onsets = this.features.get(trackId)?.onsetTimes
    if (!onsets || to <= from) return false
    for (const time of onsets) {
      if (time >= from && time < to) return true
      if (time >= to) break
    }
    return false
  }

  get(trackId: ID): TrackFeatures | null {
    return this.features.get(trackId) ?? null
  }

  getBpm(trackId: ID): number | null {
    return this.features.get(trackId)?.bpm ?? null
  }

  getBeatGrid(trackId: ID): number[] {
    return this.features.get(trackId)?.beatGrid ?? []
  }

  has(trackId: ID): boolean {
    return this.features.has(trackId)
  }

  release(trackId: ID): void {
    this.features.delete(trackId)
    this.pending.delete(trackId)
  }

  /** Subscribe to analysis lifecycle, for import progress UI. */
  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.features.clear()
    this.pending.clear()
  }

  private emit(trackId: ID, state: 'started' | 'done' | 'failed'): void {
    for (const listener of this.listeners) listener(trackId, state)
  }
}

export const AudioFeatures = new AudioFeaturesImpl()
