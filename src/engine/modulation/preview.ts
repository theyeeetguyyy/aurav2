import type { ModulationConnection } from '@/types/modulation'
import type { FieldRef } from '@/types/params'
import { SignalShaper } from './SignalShaper'
import { evaluateField, type FieldContext } from './fields'
import { evaluateCurve } from './curve'
import {
  applyProcessors,
  processorTimeOffset,
  type ModulationProcessor,
} from './processors'

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

  // The wire's shared processing stages, read the same way the matrix reads them. Without this
  // the graph would draw a smooth line for a quantised wire — a preview that disagrees with the
  // render is worse than no preview, because it is believed.
  const stages = (connection.processorIds ?? [])
    .map((id) => ctx.getProcessor?.(id) ?? null)
    .filter((processor): processor is ModulationProcessor => processor !== null)

  const sourceAt = (t: number) =>
    stages.length === 0
      ? evaluateField(connection.source, { ...ctx, time: t })
      : applyProcessors(
          stages,
          evaluateField(connection.source, { ...ctx, time: processorTimeOffset(stages, t) }),
        )

  // Warm-up pass so the envelope is settled at the window's left edge instead of
  // ramping up from zero inside the visible range.
  const warmup = Math.min(60, samples)
  for (let i = warmup; i > 0; i--) {
    const t = from - i * dt
    shaper.process(sourceAt(t), connection.chain, dt)
  }

  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < samples; i++) {
    const t = from + i * dt
    const input = sourceAt(t)
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

/** The range a connection ACTUALLY reaches, given the signal that actually exists.
 *
 *  `connectionRange` above answers a different question: it sweeps the declared 0–1 input
 *  domain and reports where the parameter *could* go. That is the right answer for a
 *  generator, whose output really does span 0–1, and the wrong one for a stem — whose
 *  envelope might only occupy 0.3–0.6 across a whole track. Reporting "0 → 16" for a
 *  parameter that never leaves 5 → 10 is the single most misleading number in the routing
 *  UI, because it reads as a promise about the visual.
 *
 *  Runs the real shaper over the real feature timeline, same as `previewConnection`.
 *  Returns null when the source produces nothing at all — no analysis yet, or a silent
 *  stem — so callers can fall back rather than draw a collapsed range. */
export function reachableRange(
  connection: ModulationConnection,
  baseValue: number,
  duration: number,
  ctx: Omit<FieldContext, 'time'>,
  samples = 300,
): { low: number; high: number } | null {
  if (duration <= 0) return null

  const dt = duration / (samples - 1)
  const shaper = new SignalShaper()

  let low = Infinity
  let high = -Infinity
  let sawSignal = false

  for (let i = 0; i < samples; i++) {
    const input = evaluateField(connection.source, { ...ctx, time: i * dt })
    if (input > 1e-4) sawSignal = true
    const value = baseValue + shaper.process(input, connection.chain, dt)
    if (value < low) low = value
    if (value > high) high = value
  }

  return sawSignal ? { low, high } : null
}

/** Measure what a Field's raw output actually does across the project.
 *
 *  Robust percentiles rather than min/max: one clipped transient would otherwise define
 *  the top of the range and squash everything else back into the bottom — which is the
 *  exact failure the offline analyser already avoids for the same reason (§4.1).
 *
 *  Returns null when the source produces nothing, so callers can say "no signal yet"
 *  instead of normalising to a flat line. */
export function measureField(
  field: FieldRef,
  duration: number,
  ctx: Omit<FieldContext, 'time'>,
  samples = 600,
): { low: number; high: number } | null {
  if (duration <= 0) return null

  const values: number[] = []
  const dt = duration / (samples - 1)
  let sawSignal = false

  for (let i = 0; i < samples; i++) {
    const value = evaluateField(field, { ...ctx, time: i * dt })
    if (value > 1e-4) sawSignal = true
    values.push(value)
  }
  if (!sawSignal) return null

  values.sort((a, b) => a - b)
  const low = values[Math.floor(values.length * 0.02)]
  const high = values[Math.min(values.length - 1, Math.floor(values.length * 0.98))]

  // A window narrower than this is not a signal, it is a constant — normalising to it
  // would amplify noise into the whole range.
  if (high - low < 1e-3) return null
  return { low, high }
}

function shapedAt(connection: ModulationConnection, input: number): number {
  const { curve, invert, gain, inputMin = 0, inputMax = 1 } = connection.chain
  const window = inputMax - inputMin
  const scaled = Math.abs(window) < 1e-6 ? 0 : Math.min(1, Math.max(0, (input - inputMin) / window))
  const gained = Math.min(1, Math.max(0, scaled * gain))
  const curved = curve ? evaluateCurve(curve, gained) : gained
  return invert ? 1 - curved : curved
}
