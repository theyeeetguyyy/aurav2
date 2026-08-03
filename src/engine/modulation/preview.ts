import type { ModulationConnection } from '@/types/modulation'
import { SignalShaper } from './SignalShaper'
import { evaluateField, type FieldContext } from './fields'
import { evaluateCurve } from './curve'

/** Modulation preview — the actual curve a connection produces over time.
 *
 *  This is the "show me the LFO underneath" view. It is not an approximation or a
 *  visualisation of the settings: it runs the *real* `SignalShaper` over the *real*
 *  feature timeline, so what is drawn is exactly what the parameter will do.
 *
 *  Only possible because features are timelines rather than live taps (HC-3) and the
 *  chain is deterministic. A live-tap architecture could only ever draw the past. */

export interface PreviewResult {
  /** Final parameter values, including the base — what the number actually becomes. */
  values: Float32Array
  /** Raw field input 0–1 before shaping, for the ghost trace. */
  raw: Float32Array
  from: number
  to: number
  min: number
  max: number
}

/** Sample a connection's output across a time window.
 *
 *  Runs a fresh shaper forward from `from`, so attack/release are genuinely simulated
 *  rather than approximated — a slow Rise visibly lags the input in the drawn curve,
 *  which is the entire point of being able to see it. */
export function previewConnection(
  connection: ModulationConnection,
  baseValue: number,
  from: number,
  to: number,
  ctx: Omit<FieldContext, 'time'>,
  samples = 240,
): PreviewResult {
  const values = new Float32Array(samples)
  const raw = new Float32Array(samples)

  const span = Math.max(1e-6, to - from)
  const dt = span / (samples - 1)

  // A fresh shaper each time: the preview must not inherit playback's envelope state,
  // or scrubbing would change the drawn curve.
  const shaper = new SignalShaper()

  // Warm-up pass so the envelope is settled at the window's left edge instead of
  // ramping up from zero inside the visible range.
  const warmup = Math.min(60, samples)
  for (let i = warmup; i > 0; i--) {
    const t = from - i * dt
    shaper.process(evaluateField(connection.source, { ...ctx, time: t }), connection.chain, dt)
  }

  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < samples; i++) {
    const t = from + i * dt
    const input = evaluateField(connection.source, { ...ctx, time: t })
    const offset = shaper.process(input, connection.chain, dt)
    const value = baseValue + offset

    raw[i] = input
    values[i] = value
    if (value < min) min = value
    if (value > max) max = value
  }

  // A flat line still needs a drawable range.
  if (max - min < 1e-6) {
    min -= 0.5
    max += 0.5
  }

  return { values, raw, from, to, min, max }
}

/** The value range a connection can reach, in the target parameter's own units.
 *
 *  This is what the routing UI shows instead of an abstract 0–1: "Scale 1.00 → 2.00 ×"
 *  answers "what will this actually do" without pressing play. Accounts for weight,
 *  inversion, and where the curve's own output actually lands. */
export function connectionRange(
  connection: ModulationConnection,
  baseValue: number,
): { low: number; high: number } {
  const { min, max, weight } = connection.chain

  // Endpoints of the shaped 0–1 signal after the curve. Sampling rather than assuming
  // 0 and 1: a Band curve peaks in the middle and returns to zero at both ends, so its
  // reachable maximum is not at either endpoint.
  let curveLow = Infinity
  let curveHigh = -Infinity
  for (let i = 0; i <= 20; i++) {
    const y = shapedAt(connection, i / 20)
    if (y < curveLow) curveLow = y
    if (y > curveHigh) curveHigh = y
  }

  const a = (min + (max - min) * curveLow) * weight
  const b = (min + (max - min) * curveHigh) * weight

  return {
    low: baseValue + Math.min(a, b),
    high: baseValue + Math.max(a, b),
  }
}

function shapedAt(connection: ModulationConnection, input: number): number {
  const { curve, invert, gain } = connection.chain
  const gained = Math.min(1, Math.max(0, input * gain))
  const curved = curve ? evaluateCurve(curve, gained) : gained
  return invert ? 1 - curved : curved
}
