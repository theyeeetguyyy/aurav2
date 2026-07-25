/** Unique identifier type used across all entities */
export type ID = string

/** Audio track representing one imported stem */
export interface Track {
  id: ID
  name: string
  fileName: string
  /** Color from stem identity palette */
  color: string
  /** Decoded audio buffer — null until loaded */
  buffer: AudioBuffer | null
  /** Per-track gain (0–1) */
  volume: number
  /** Whether this track is soloed */
  solo: boolean
  /** Whether this track is muted */
  mute: boolean
  /** Trim start/end in seconds */
  trimBounds: TrimBounds
  /** Pre-computed analysis data from essentia.js */
  analysis: AnalysisData | null
}

export interface TrimBounds {
  start: number
  end: number
}

export interface AnalysisData {
  bpm: number
  onsetTimestamps: number[]
  beatGrid: number[]
  /** 7-band energy over time */
  bandEnergies: Float32Array[]
}

/** Real-time per-frame metrics written to refs (never React state) */
export interface StemMetrics {
  rms: number
  spectralCentroid: number
  bands: Float32Array
}
