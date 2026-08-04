/** Automation lanes — the editable modulation curve (Principle 10, §4.2).
 *
 *  **A lane normally belongs to a stem.** Every imported stem gets one, showing the curve
 *  the analyser derived from it, drawn under that stem's own waveform on that stem's own
 *  timeline. You can see exactly where the kick lands, reshape the curve where the
 *  analysis got it wrong, and wire the result.
 *
 *  That placement is the whole design. A free-floating lane on its own timeline is close
 *  to unusable — there is no visual cue for what moment you are drawing at, so you are
 *  drawing to a beat you cannot see. Detached lanes still exist for "I want a shape the
 *  music does not contain", but they are the exception, not the path.
 *
 *  A lane starts in `analysis` mode holding **no points at all**: it defers to the feature
 *  timeline, which is exact and costs nothing. The first edit snapshots that curve into
 *  points and the lane becomes `edited`. One-way, with a reset — so "what is this showing
 *  me" always has a simple answer.
 *
 *  Trivially satisfies HC-3 either way: a feature lookup and a point lookup are both pure
 *  functions of `t`. */

export interface AutomationPoint {
  /** Seconds into the project. */
  t: number
  /** 0–1. Same normalised domain every Field speaks. */
  v: number
}

export type LaneInterpolation = 'linear' | 'smooth' | 'step'

/** `analysis` defers to the feature timeline; `edited` uses the lane's own points. */
export type LaneMode = 'analysis' | 'edited'

/** Which stem and metric a lane is the curve *of*. Absent on a detached lane. */
export interface LaneSource {
  trackId: string
  /** A `FeatureKey` — kept as a string so `engine/automation` stays independent of the
   *  audio module's key union. */
  metric: string
}

/** The shape lane evaluation needs. Structural, so `engine/` never imports the store. */
export interface LaneData {
  points: AutomationPoint[]
  interpolation: LaneInterpolation
  mode: LaneMode
  source?: LaneSource
}

/** Value of a lane at a time. Points are kept sorted by `t`, so this is a binary search.
 *
 *  Outside the drawn range the lane holds its end value rather than falling to zero —
 *  a lane drawn over the chorus should not silently mute the parameter everywhere else.
 *  (Blender NLA calls this `hold`; it is the only sane default.) */
export function sampleLane(lane: LaneData, t: number): number {
  const points = lane.points
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

  switch (lane.interpolation) {
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
 *  `tolerance` is what makes freehand drawing usable: a pointer emits far more samples
 *  than the curve needs, and without collapsing near-coincident times a two-second drag
 *  produces hundreds of points that are indistinguishable from a dozen. */
export function writePoint(
  points: AutomationPoint[],
  t: number,
  v: number,
  tolerance = 0.01,
): AutomationPoint[] {
  const time = Math.max(0, t)
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

/** Snapshot a sampled signal into an editable curve.
 *
 *  Feature timelines run at 200 Hz — a four-minute stem is 48 000 values, which is not a
 *  curve anyone can edit. Decimating to a few hundred points keeps the shape legible and
 *  the drag handles reachable, and the error against the original is far below what a
 *  visual parameter can express.
 *
 *  Peak-preserving rather than averaging: a kick is one or two samples wide at this rate,
 *  and averaging would flatten exactly the transients the curve exists to capture. */
export function decimate(
  sample: (t: number) => number,
  duration: number,
  points = 320,
): AutomationPoint[] {
  if (duration <= 0 || points < 2) return []

  const out: AutomationPoint[] = []
  const step = duration / (points - 1)
  // Oversample within each bucket and keep the peak, so a transient between two output
  // points still shows up.
  const SUBSAMPLES = 8

  for (let i = 0; i < points; i++) {
    const t = i * step
    let peak = 0
    for (let j = 0; j < SUBSAMPLES; j++) {
      const value = sample(t + (j / SUBSAMPLES) * step)
      if (value > peak) peak = value
    }
    out.push({ t, v: Math.min(1, Math.max(0, peak)) })
  }
  return out
}

/** A flat lane at `value`, spanning the project. The starting point for "I want to draw
 *  on top of something" rather than an empty canvas. */
export function flatLane(duration: number, value = 0.5): AutomationPoint[] {
  return [
    { t: 0, v: value },
    { t: Math.max(0.001, duration), v: value },
  ]
}

/** One cycle-per-bar ramp, as a starting shape worth having. */
export function rampLane(duration: number, from = 0, to = 1): AutomationPoint[] {
  return [
    { t: 0, v: from },
    { t: Math.max(0.001, duration), v: to },
  ]
}
