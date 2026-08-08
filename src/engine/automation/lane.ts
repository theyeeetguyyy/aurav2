import type { AutomationClip } from './clips'

/** Automation lanes — a row that automation clips sit on (Principle 10, §4.2).
 *
 *  **A lane normally belongs to a stem.** Every imported stem gets one, and with nothing on it
 *  the lane *is* that stem's analysed signal — exact, free, and with no separate curve to keep
 *  in sync. Placing a clip overrides that signal for the span the clip covers, and only there:
 *  outside it the analysis resumes. So "the kick drives this, except during the drop where I
 *  want my own shape" is two objects and no modes.
 *
 *  That placement under the stem's own waveform is the whole design. A free-floating lane on
 *  its own timeline is close to unusable — there is no visual cue for what moment you are
 *  drawing at, so you are drawing to a beat you cannot see. Detached lanes still exist for "I
 *  want a shape the music does not contain", but they are the exception, not the path.
 *
 *  **There is no `mode` any more.** A lane used to carry `analysis | edited`, a flag that had
 *  to agree with whether it held points — and a flag that can disagree with the data it
 *  describes is a bug waiting for a reason. `clips.length === 0` says the same thing and cannot
 *  be wrong.
 *
 *  Trivially satisfies HC-3: a feature lookup, a clip lookup and a point lookup are all pure
 *  functions of `t`. */

export interface AutomationPoint {
  /** Time. **Seconds** in a raw curve; **0–1** inside a pattern. Whoever holds the array
   *  knows which, and the two never mix in one array. */
  t: number
  /** 0–1. Same normalised domain every Field speaks. */
  v: number
}

export type LaneInterpolation = 'linear' | 'smooth' | 'step'

/** Which stem and metric a lane is the curve *of*. Absent on a detached lane. */
export interface LaneSource {
  trackId: string
  /** A `FeatureKey` — kept as a string so `engine/automation` stays independent of the
   *  audio module's key union. */
  metric: string
}

/** The shape lane evaluation needs. Structural, so `engine/` never imports the store. */
export interface LaneData {
  /** Clips placed on this lane, in creation order. Later ones win an overlap. */
  clips: AutomationClip[]
  source?: LaneSource
}

/** Value of a point curve at `t`, in whatever domain the points use.
 *
 *  The one interpolator in the system: patterns, migrations and previews all read through it,
 *  so a curve drawn on screen is arithmetically the curve that runs. Points are kept sorted,
 *  so this is a binary search.
 *
 *  Outside the range it holds the end value rather than falling to zero — a curve that stops
 *  should not silently mute its parameter. (Blender NLA calls this `hold`.) */
export function samplePoints(
  points: readonly AutomationPoint[],
  interpolation: LaneInterpolation,
  t: number,
): number {
  if (points.length === 0) return 0
  if (points.length === 1) return points[0].v
  if (t <= points[0].t) return points[0].v

  const last = points[points.length - 1]
  if (t >= last.t) return last.v

  let low = 0
  let high = points.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (points[mid].t <= t) low = mid
    else high = mid
  }

  const a = points[low]
  const b = points[high]
  const span = b.t - a.t
  if (span <= 0) return b.v

  const x = (t - a.t) / span

  switch (interpolation) {
    case 'step':
      return a.v
    case 'smooth':
      // Hermite smoothstep: flat entering and leaving each point, so a hand-drawn curve
      // reads as eased rather than as a series of ramps.
      return a.v + (b.v - a.v) * (x * x * (3 - 2 * x))
    default:
      return a.v + (b.v - a.v) * x
  }
}

/** Insert or replace a point, keeping the array sorted and free of duplicates.
 *
 *  `tolerance` is what makes freehand drawing usable: a pointer emits far more samples than
 *  the curve needs, and without collapsing near-coincident times a two-second drag produces
 *  hundreds of points that are indistinguishable from a dozen.
 *
 *  `max` clamps the time domain — 1 for a pattern, the project duration for a raw curve.
 *  Without it, drawing at the right edge of a pattern writes points past 1 that nothing will
 *  ever sample. */
export function writePoint(
  points: AutomationPoint[],
  t: number,
  v: number,
  tolerance = 0.01,
  max = Number.POSITIVE_INFINITY,
): AutomationPoint[] {
  const time = Math.min(max, Math.max(0, t))
  const value = Math.min(1, Math.max(0, v))

  const next = points.filter((p) => Math.abs(p.t - time) > tolerance)
  next.push({ t: time, v: value })
  next.sort((a, b) => a.t - b.t)
  return next
}

/** Remove every point inside a time window. Used by the eraser and by re-drawing over an
 *  existing section, which must replace rather than overlay. */
export function clearRange(
  points: AutomationPoint[],
  from: number,
  to: number,
): AutomationPoint[] {
  const low = Math.min(from, to)
  const high = Math.max(from, to)
  return points.filter((p) => p.t < low || p.t > high)
}

/** Snapshot a sampled signal into an editable curve, normalised to 0–1 time.
 *
 *  Feature timelines run at 200 Hz — a four-minute stem is 48 000 values, which is not a curve
 *  anyone can edit. Decimating to a few hundred points keeps the shape legible and the drag
 *  handles reachable, and the error against the original is far below what a visual parameter
 *  can express.
 *
 *  Peak-preserving rather than averaging: a kick is one or two samples wide at this rate, and
 *  averaging would flatten exactly the transients the curve exists to capture. */
export function decimate(
  sample: (t: number) => number,
  duration: number,
  points = 320,
): AutomationPoint[] {
  if (duration <= 0 || points < 2) return []

  const out: AutomationPoint[] = []
  const step = duration / (points - 1)
  // Oversample within each bucket and keep the peak, so a transient between two output points
  // still shows up.
  const SUBSAMPLES = 8

  for (let i = 0; i < points; i++) {
    const t = i * step
    let peak = 0
    for (let j = 0; j < SUBSAMPLES; j++) {
      const value = sample(t + (j / SUBSAMPLES) * step)
      if (value > peak) peak = value
    }
    out.push({ t: i / (points - 1), v: Math.min(1, Math.max(0, peak)) })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Starting shapes. All in pattern time (0–1), because a pattern is what you draw on.
// ─────────────────────────────────────────────────────────────────────────────

/** Flat, for drawing on top of rather than into an empty canvas. */
export function flatPattern(value = 0.5): AutomationPoint[] {
  return [
    { t: 0, v: value },
    { t: 1, v: value },
  ]
}

/** A rise. The shape a build-up wants, and the one people reach for first. */
export function rampPattern(from = 0, to = 1): AutomationPoint[] {
  return [
    { t: 0, v: from },
    { t: 1, v: to },
  ]
}

/** A hit: full immediately, then decaying. The shape of a kick, and the reason `repeat`
 *  exists — one of these on a one-beat clip repeated across a bar is a pumping parameter. */
export function stabPattern(): AutomationPoint[] {
  return [
    { t: 0, v: 1 },
    { t: 0.25, v: 0.35 },
    { t: 0.6, v: 0.08 },
    { t: 1, v: 0 },
  ]
}
