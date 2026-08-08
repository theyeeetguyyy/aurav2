import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  AIM_LOOKAHEAD,
  MIN_PATH_WAYPOINTS,
  buildPath,
  pathLength,
  samplePath,
  samplePathAhead,
  type CameraWaypoint,
} from './cameraPath'

function waypoints(...positions: [number, number, number][]): CameraWaypoint[] {
  return positions.map((position, i) => ({ id: `w${i}`, position }))
}

/** A straight line along X, so distances are readable by eye. */
const line = waypoints([0, 0, 0], [10, 0, 0], [20, 0, 0], [30, 0, 0])

describe('buildPath', () => {
  it('needs at least two waypoints', () => {
    expect(buildPath([])).toBeNull()
    expect(buildPath(waypoints([0, 0, 0]))).toBeNull()
    expect(buildPath(waypoints([0, 0, 0], [1, 0, 0]))).not.toBeNull()
    expect(MIN_PATH_WAYPOINTS).toBe(2)
  })

  it('passes through its waypoints, which is why it is Catmull-Rom', () => {
    const curve = buildPath(line)!
    const out = new THREE.Vector3()
    // Ends are exact; a control point you asked for is a place the camera should actually be.
    expect(samplePath(curve, 0, out).x).toBeCloseTo(0, 4)
    expect(curve.getPoint(1, out).x).toBeCloseTo(30, 4)
  })

  it('closes when asked', () => {
    const open = pathLength(buildPath(line, false)!)
    const closed = pathLength(buildPath(line, true)!)
    // A loop has to come back, so it is longer.
    expect(closed).toBeGreaterThan(open)
  })
})

describe('samplePath', () => {
  const curve = buildPath(line)!
  const out = new THREE.Vector3()

  it('moves at a constant speed along the path, not along the parameter', () => {
    // Arc-length parameterisation. Without it the camera speeds up wherever waypoints are far
    // apart, which is the opposite of what changing their spacing should mean.
    const quarter = samplePath(curve, 0.25, out).clone()
    const half = samplePath(curve, 0.5, out).clone()
    const threeQuarters = samplePath(curve, 0.75, out).clone()

    expect(quarter.distanceTo(half)).toBeCloseTo(half.distanceTo(threeQuarters), 1)
  })

  it('wraps rather than clamping, so a repeating clip loops the move', () => {
    const at = (p: number) => samplePath(curve, p, out).clone()
    expect(at(1.25).distanceTo(at(0.25))).toBeCloseTo(0, 3)
    expect(at(2.5).distanceTo(at(0.5))).toBeCloseTo(0, 3)
  })

  it('handles negative progress, which a bipolar modulation range produces', () => {
    const at = (p: number) => samplePath(curve, p, out).clone()
    expect(at(-0.25).distanceTo(at(0.75))).toBeCloseTo(0, 3)
  })

  it('never produces NaN, whatever it is given', () => {
    for (const progress of [0, 1, -1, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      samplePath(curve, progress, out)
      expect(Number.isFinite(out.x)).toBe(true)
      expect(Number.isFinite(out.y)).toBe(true)
      expect(Number.isFinite(out.z)).toBe(true)
    }
  })

  it('is a pure function of progress', () => {
    const first = samplePath(curve, 0.37, out).clone()
    samplePath(curve, 0.9, out)
    expect(samplePath(curve, 0.37, out).distanceTo(first)).toBeCloseTo(0, 6)
  })
})

describe('samplePathAhead', () => {
  const curve = buildPath(line)!
  const out = new THREE.Vector3()

  it('looks forward along the direction of travel', () => {
    const here = samplePath(curve, 0.4, out).clone()
    const ahead = samplePathAhead(curve, 0.4, out).clone()
    expect(ahead.x).toBeGreaterThan(here.x)
  })

  it('looks ahead by a fraction of the path, not a fixed distance', () => {
    // A fixed distance would swing wildly between a short path and a long one.
    const short = buildPath(waypoints([0, 0, 0], [1, 0, 0]))!
    const long = buildPath(waypoints([0, 0, 0], [1000, 0, 0]))!

    const shortStep = samplePath(short, 0, out).distanceTo(samplePathAhead(short, 0, new THREE.Vector3()))
    const longStep = samplePath(long, 0, out).distanceTo(samplePathAhead(long, 0, new THREE.Vector3()))

    expect(longStep / shortStep).toBeCloseTo(1000, 0)
    expect(AIM_LOOKAHEAD).toBeGreaterThan(0)
  })
})
