/** Response curves — the transfer function between a Field and a parameter.
 *
 *  The signal chain's Gain/Rise/Fall/Min/Max control *how much* and *how fast*. The curve
 *  controls *shape*: whether a stem's loudness maps to scale linearly, or slams open and
 *  eases off, or ignores everything below half volume.
 *
 *  Point-based with per-segment tension, which is the model FL Studio, Ableton and every
 *  DAW envelope editor already use — the audience knows it. */

export interface CurvePoint {
  /** Input, 0–1. Points are kept sorted by this. */
  x: number
  /** Output, 0–1. */
  y: number
  /** Bend of the segment LEAVING this point. 0 linear, >0 fast-then-slow, <0 slow-then-fast. */
  tension: number
}

export const LINEAR_CURVE: CurvePoint[] = [
  { x: 0, y: 0, tension: 0 },
  { x: 1, y: 1, tension: 0 },
]

/** Named starting points. A curve is easier to adjust than to invent. */
export const CURVE_PRESETS: { id: string; label: string; hint: string; points: CurvePoint[] }[] = [
  {
    id: 'linear',
    label: 'Linear',
    hint: 'Straight through.',
    points: LINEAR_CURVE,
  },
  {
    id: 'ease-in',
    label: 'Ease In',
    hint: 'Ignores quiet detail, reacts hard when loud. Good for kicks.',
    points: [
      { x: 0, y: 0, tension: 0.7 },
      { x: 1, y: 1, tension: 0 },
    ],
  },
  {
    id: 'ease-out',
    label: 'Ease Out',
    hint: 'Reacts immediately then saturates. Good for pads and atmosphere.',
    points: [
      { x: 0, y: 0, tension: -0.7 },
      { x: 1, y: 1, tension: 0 },
    ],
  },
  {
    id: 'gate',
    label: 'Gate',
    hint: 'Nothing until the signal crosses a threshold, then full.',
    points: [
      { x: 0, y: 0, tension: 0 },
      { x: 0.45, y: 0, tension: 0 },
      { x: 0.55, y: 1, tension: 0 },
      { x: 1, y: 1, tension: 0 },
    ],
  },
  {
    id: 'band',
    label: 'Band',
    hint: 'Peaks in the middle of the range and falls away at both ends.',
    points: [
      { x: 0, y: 0, tension: 0 },
      { x: 0.5, y: 1, tension: 0 },
      { x: 1, y: 0, tension: 0 },
    ],
  },
  {
    id: 'invert',
    label: 'Inverted',
    hint: 'Louder means smaller.',
    points: [
      { x: 0, y: 1, tension: 0 },
      { x: 1, y: 0, tension: 0 },
    ],
  },
]

/** Exponential bend of a 0–1 segment parameter.
 *
 *  Chosen over a power curve because it stays smooth and well-behaved through zero, so
 *  dragging tension across the midpoint does not visibly kink. */
function bend(u: number, tension: number): number {
  if (Math.abs(tension) < 1e-4) return u
  const k = tension * 5
  return (Math.exp(k * u) - 1) / (Math.exp(k) - 1)
}

/** Evaluate a curve at input `x` (0–1). Allocation-free — this runs per frame per
 *  connection, and during preview rendering it runs hundreds of times. */
export function evaluateCurve(points: CurvePoint[], x: number): number {
  if (points.length === 0) return x
  if (points.length === 1) return points[0].y

  const input = x < 0 ? 0 : x > 1 ? 1 : x

  if (input <= points[0].x) return points[0].y
  const last = points[points.length - 1]
  if (input >= last.x) return last.y

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (input < a.x || input > b.x) continue

    const span = b.x - a.x
    if (span <= 1e-9) return b.y

    const u = (input - a.x) / span
    return a.y + (b.y - a.y) * bend(u, a.tension)
  }

  return last.y
}

/** Keep a curve well-formed: sorted, in range, endpoints intact. */
export function normaliseCurve(points: CurvePoint[]): CurvePoint[] {
  const clamped = points.map((p) => ({
    x: clamp01(p.x),
    y: clamp01(p.y),
    tension: Math.max(-1, Math.min(1, p.tension)),
  }))
  clamped.sort((a, b) => a.x - b.x)
  return clamped
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Is this curve the identity? Lets the UI show "Linear" and the shaper skip the work. */
export function isLinear(points: CurvePoint[]): boolean {
  return (
    points.length === 2 &&
    points[0].x === 0 &&
    points[0].y === 0 &&
    points[1].x === 1 &&
    points[1].y === 1 &&
    Math.abs(points[0].tension) < 1e-4
  )
}
