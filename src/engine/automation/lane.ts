/** Automation lanes — hand-drawn signals (Principle 10, docs/04-ENGINE-SPECS.md §4.2).
 *
 *  The gap this closes: until now every signal came from somewhere else. A stem's
 *  envelope is whatever the analyser produced, and the tools for reshaping it — gain and
 *  a response curve — can only remap values, never decide *when* something happens. So
 *  "this bass barely moves" had no answer, and neither did "I want it to swell here and
 *  drop out there".
 *
 *  A lane is a curve drawn over project time. It is a Field like any other (Principle 12),
 *  which means it wires to anything, blends with stems through the same weighted N:1 sum,
 *  and needs no special case anywhere downstream.
 *
 *  Trivially satisfies HC-3: a lookup by `t` is already a pure function of time. */

export interface AutomationPoint {
  /** Seconds into the project. */
  t: number
  /** 0–1. Same normalised domain every Field speaks. */
  v: number
}

export type LaneInterpolation = 'linear' | 'smooth' | 'step'

/** The shape lane evaluation needs. Structural, so `engine/` never imports the store. */
export interface LaneData {
  points: AutomationPoint[]
  interpolation: LaneInterpolation
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
