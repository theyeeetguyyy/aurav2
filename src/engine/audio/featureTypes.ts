/** Shared contract between the analysis worker and the main thread.
 *  Imports nothing — the worker must stay free of stores and DOM. */

/** Feature timelines are sampled at a fixed rate, independent of frame rate or
 *  audio callback rate. 200 Hz resolves a 5 ms transient, which is well below the
 *  ~20 ms at which a rhythmic event stops reading as "on the beat". */
export const FEATURE_RATE = 200

/** FFT window. 2048 @ 44.1 kHz ≈ 46 ms — enough low-frequency resolution to
 *  separate sub from bass (bin width ≈ 21 Hz). */
export const FFT_SIZE = 2048

/** Band edges in Hz: sub · bass · low-mid · mid · upper-mid · presence · brilliance */
export const BAND_EDGES_HZ = [20, 60, 250, 500, 2000, 4000, 6000, 20000]

export const BAND_KEYS = [
  'band-sub',
  'band-bass',
  'band-low-mid',
  'band-mid',
  'band-upper-mid',
  'band-presence',
  'band-brilliance',
] as const

export const FEATURE_KEYS = [
  'rms',
  'peak',
  'envelope',
  'spectral-centroid',
  'spectral-flux',
  'onset',
  ...BAND_KEYS,
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

/** One track's analysis result. Every timeline has `frameCount` entries, normalised
 *  to 0–1, sampled at FEATURE_RATE. */
export interface TrackFeatures {
  duration: number
  frameCount: number
  timelines: Record<FeatureKey, Float32Array>
  /** Detected onset times in seconds — the discrete-event source (Principle 4). */
  onsetTimes: number[]
  /** Estimated tempo, or null when detection is not confident. */
  bpm: number | null
  /** Beat times in seconds, derived from bpm + phase. Empty when bpm is null. */
  beatGrid: number[]
}

export interface AnalysisRequest {
  trackId: string
  /** Mono-summed sample data. Transferred, not copied. */
  samples: Float32Array
  sampleRate: number
}

export interface AnalysisResponse {
  trackId: string
  features: TrackFeatures
}
