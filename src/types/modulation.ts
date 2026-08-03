import type { ID } from './audio'
import type { FieldRef, ParamAddress } from './params'
import type { CurvePoint } from '@/engine/modulation/curve'
import { LINEAR_CURVE } from '@/engine/modulation/curve'

/** Modulation: routing Fields onto parameters (docs/04-ENGINE-SPECS.md §4.2).
 *
 *  Both ends are now abstract — a FieldRef source and a ParamAddress target — rather
 *  than closed string unions of "the audio metrics" and "the shape parameters". That
 *  is what lets an LFO drive a light's intensity, or one object answer another,
 *  without touching this file. */

/** Continuous modulation. Weighted N:1 — many connections may target one parameter,
 *  which is the product's headline mechanic ("50% guns + 25% drums + 25% atmosphere"). */
export interface ModulationConnection {
  id: ID
  source: FieldRef
  target: ParamAddress
  chain: SignalChain
  enabled: boolean
}

/** Per-connection signal chain, in evaluation order (Principle 8, from Ableton's
 *  Envelope Follower):
 *
 *      Gain → Rise/Fall → Min/Max → Weight
 *
 *  Raw audio mapped straight onto a parameter looks jittery and amateurish. Rise/Fall
 *  is the single most-missed feature by people prototyping this kind of tool. */
export interface SignalChain {
  /** Input window, in the SOURCE's normalised 0–1 domain. The incoming signal is
   *  rescaled from [inputMin, inputMax] onto 0–1 before anything else runs.
   *
   *  This is the answer to "the stem barely moves". Percentile normalisation makes each
   *  stem use the full 0–1 range across the WHOLE FILE, but within any given bar its
   *  envelope may only occupy 0.3–0.6 — so the parameter only ever travels a third of
   *  the range the settings promise. Gain cannot fix that: it scales, so it pushes the
   *  top into clipping long before it lifts the bottom off the floor.
   *
   *  `Normalise` measures the source's real distribution and writes these two numbers. */
  inputMin: number
  inputMax: number
  /** Input amplification, after the input window. */
  gain: number
  /** Attack smoothing, milliseconds. 0 = instant. */
  rise: number
  /** Release smoothing, milliseconds. 0 = instant. */
  fall: number
  /** Output offset range, in the TARGET PARAMETER'S units — not normalised.
   *  A shaped 0–1 signal maps onto [min, max] and is added to the base value. */
  min: number
  max: number
  /** Final mix weight. */
  weight: number
  /** Flip the shaped signal (1 - x) before ranging — "quieter means bigger". */
  invert: boolean
  /** Response curve: how the incoming 0–1 signal maps to 0–1 before smoothing.
   *  Gain and Min/Max control how much; this controls the *shape* of the reaction. */
  curve: CurvePoint[]
}

export const DEFAULT_SIGNAL_CHAIN: SignalChain = {
  inputMin: 0,
  inputMax: 1,
  gain: 1,
  rise: 10,
  fall: 120,
  min: 0,
  max: 1,
  weight: 1,
  invert: false,
  curve: LINEAR_CURVE,
}

/** Discrete event trigger (Principle 4).
 *
 *  Percussion forced through continuous blending reads mushy — a kick needs
 *  fire-once, not an ongoing blend. Rather than four hardcoded actions
 *  (explode / flash / pulse / snap), a trigger is a generic decaying impulse into any
 *  parameter address. That is both simpler and strictly more capable: "explode" is an
 *  impulse into a deformer's strength, "flash" is an impulse into emissive intensity.
 *
 *  Evaluated as a pure function of time — the impulse value is derived from the age of
 *  the most recent onset at or before `t`, never accumulated frame by frame. That
 *  keeps scrubbing backwards and out-of-order export rendering correct. */
export interface EventTrigger {
  id: ID
  /** Must be an 'audio' field; `key` selects which onset stream. */
  source: FieldRef
  target: ParamAddress
  /** Peak offset added at the moment of the hit, in target parameter units. */
  amount: number
  /** Exponential decay time constant, seconds. */
  decay: number
  enabled: boolean
}

export const DEFAULT_EVENT_TRIGGER: Omit<EventTrigger, 'id' | 'source' | 'target'> = {
  amount: 1,
  decay: 0.18,
  enabled: true,
}
