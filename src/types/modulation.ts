import type { ID } from './audio'

/** A modulation connection wires an audio source metric to a visual parameter
 *  through a signal-shaping chain. */
export interface ModulationConnection {
  id: ID
  /** Source track ID */
  sourceTrackId: ID
  /** Which metric from the source to use */
  sourceMetric: SourceMetric
  /** Target shape ID */
  targetShapeId: ID
  /** Which parameter on the target to drive */
  targetParam: TargetParam
  /** Signal shaping chain */
  signalChain: SignalChain
  /** Whether this connection is active */
  enabled: boolean
}

/** Available source metrics from audio analysis */
export type SourceMetric =
  | 'rms'
  | 'spectral-centroid'
  | 'onset'
  | 'band-sub'        // ~20-60Hz
  | 'band-bass'       // ~60-250Hz
  | 'band-low-mid'    // ~250-500Hz
  | 'band-mid'        // ~500-2kHz
  | 'band-upper-mid'  // ~2-4kHz
  | 'band-presence'   // ~4-6kHz
  | 'band-brilliance' // ~6-20kHz

/** Available target parameters on shapes */
export type TargetParam =
  | 'position-x' | 'position-y' | 'position-z'
  | 'rotation-x' | 'rotation-y' | 'rotation-z'
  | 'scale-uniform' | 'scale-x' | 'scale-y' | 'scale-z'
  | 'color-hue' | 'color-saturation' | 'color-lightness'
  | 'roughness' | 'metalness'
  | 'deformer-strength'
  | 'morph-ratio'
  | 'bloom-intensity'

/** Signal shaping chain: Gain → Rise/Fall → Min/Max → Weight */
export interface SignalChain {
  gain: number
  /** Attack smoothing in ms */
  rise: number
  /** Release smoothing in ms */
  fall: number
  /** Output range clamp */
  min: number
  max: number
  /** Final mix weight 0–1 */
  weight: number
}

/** Discrete event trigger (onset-driven one-shot, not continuous) */
export interface EventTrigger {
  id: ID
  sourceTrackId: ID
  /** Onset threshold (0–1) */
  threshold: number
  /** Target action to fire */
  targetAction: EventAction
  targetShapeId: ID
  enabled: boolean
}

export type EventAction =
  | 'explode'
  | 'color-flash'
  | 'scale-pulse'
  | 'morph-snap'
