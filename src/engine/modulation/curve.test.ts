import { describe, expect, it } from 'vitest'
import { CURVE_PRESETS, LINEAR_CURVE, evaluateCurve, isLinear, normaliseCurve } from './curve'
import { connectionRange } from './preview'
import { DEFAULT_SIGNAL_CHAIN } from '@/types/modulation'
import type { ModulationConnection, SignalChain } from '@/types/modulation'

const connection = (chain: Partial<SignalChain>): ModulationConnection => ({
  id: 'c',
  source: { kind: 'audio', key: 'rms', sourceId: 't' },
  target: { objectId: 'o', paramKey: 'scale.uniform' },
  chain: { ...DEFAULT_SIGNAL_CHAIN, ...chain },
  enabled: true,
})

describe('evaluateCurve', () => {
  it('passes through unchanged on the linear default', () => {
    for (const x of [0, 0.13, 0.5, 0.87, 1]) {
      expect(evaluateCurve(LINEAR_CURVE, x)).toBeCloseTo(x, 6)
    }
  })

  it('clamps outside 0–1 rather than extrapolating', () => {
    // Gain can push the input past 1; the curve must saturate, not run away.
    expect(evaluateCurve(LINEAR_CURVE, -3)).toBe(0)
    expect(evaluateCurve(LINEAR_CURVE, 4)).toBe(1)
  })

  it('always hits its own control points', () => {
    const points = CURVE_PRESETS.find((p) => p.id === 'band')!.points
    for (const point of points) {
      expect(evaluateCurve(points, point.x)).toBeCloseTo(point.y, 5)
    }
  })

  it('bends without leaving the segment bounds', () => {
    // Tension must reshape the path between two points, never overshoot past them —
    // an overshoot would silently push a parameter outside its declared range.
    for (const tension of [-1, -0.5, 0.5, 1]) {
      const curve = [
        { x: 0, y: 0, tension },
        { x: 1, y: 1, tension: 0 },
      ]
      for (let i = 0; i <= 20; i++) {
        const y = evaluateCurve(curve, i / 20)
        expect(y).toBeGreaterThanOrEqual(-1e-6)
        expect(y).toBeLessThanOrEqual(1 + 1e-6)
      }
    }
  })

  it('positive tension stays below linear, negative above', () => {
    const at = (tension: number) =>
      evaluateCurve([{ x: 0, y: 0, tension }, { x: 1, y: 1, tension: 0 }], 0.5)
    expect(at(0.8)).toBeLessThan(0.5)
    expect(at(-0.8)).toBeGreaterThan(0.5)
    expect(at(0)).toBeCloseTo(0.5, 6)
  })

  it('is monotonic where the control points are', () => {
    const points = CURVE_PRESETS.find((p) => p.id === 'ease-in')!.points
    let previous = -Infinity
    for (let i = 0; i <= 40; i++) {
      const y = evaluateCurve(points, i / 40)
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = y
    }
  })

  it('handles a degenerate zero-width segment without dividing by zero', () => {
    const curve = [
      { x: 0, y: 0, tension: 0 },
      { x: 0.5, y: 0.2, tension: 0 },
      { x: 0.5, y: 0.9, tension: 0 },
      { x: 1, y: 1, tension: 0 },
    ]
    expect(Number.isFinite(evaluateCurve(curve, 0.5))).toBe(true)
  })
})

describe('curve presets', () => {
  it.each(CURVE_PRESETS.map((p) => [p.id, p] as const))('%s stays in range', (_id, preset) => {
    for (let i = 0; i <= 40; i++) {
      const y = evaluateCurve(preset.points, i / 40)
      expect(y).toBeGreaterThanOrEqual(-1e-6)
      expect(y).toBeLessThanOrEqual(1 + 1e-6)
    }
  })

  it('gate produces nothing below its threshold and full above', () => {
    const gate = CURVE_PRESETS.find((p) => p.id === 'gate')!.points
    expect(evaluateCurve(gate, 0.2)).toBeCloseTo(0, 5)
    expect(evaluateCurve(gate, 0.9)).toBeCloseTo(1, 5)
  })

  it('inverted maps loud to nothing', () => {
    const inverted = CURVE_PRESETS.find((p) => p.id === 'invert')!.points
    expect(evaluateCurve(inverted, 0)).toBeCloseTo(1, 5)
    expect(evaluateCurve(inverted, 1)).toBeCloseTo(0, 5)
  })
})

describe('normaliseCurve', () => {
  it('sorts by x and clamps into range', () => {
    const messy = normaliseCurve([
      { x: 0.8, y: 2, tension: 5 },
      { x: -1, y: -3, tension: -9 },
    ])
    expect(messy[0].x).toBe(0)
    expect(messy[0].y).toBe(0)
    expect(messy[1].y).toBe(1)
    expect(messy[1].tension).toBe(1)
  })
})

describe('isLinear', () => {
  it('recognises the default and rejects anything shaped', () => {
    expect(isLinear(LINEAR_CURVE)).toBe(true)
    expect(isLinear(CURVE_PRESETS.find((p) => p.id === 'gate')!.points)).toBe(false)
    expect(isLinear([{ x: 0, y: 0, tension: 0.5 }, { x: 1, y: 1, tension: 0 }])).toBe(false)
  })
})

describe('connectionRange', () => {
  // This is what the routing UI shows instead of an abstract 0–1: the real values the
  // parameter will move between.
  it('spans base to base+max on a linear curve', () => {
    const { low, high } = connectionRange(connection({ min: 0, max: 1.5 }), 1)
    expect(low).toBeCloseTo(1, 5)
    expect(high).toBeCloseTo(2.5, 5)
  })

  it('accounts for weight', () => {
    const { high } = connectionRange(connection({ min: 0, max: 2, weight: 0.5 }), 1)
    expect(high).toBeCloseTo(2, 5)
  })

  it('accounts for inversion by swapping which end is reachable', () => {
    const normal = connectionRange(connection({ min: 0, max: 1 }), 5)
    const inverted = connectionRange(connection({ min: 0, max: 1, invert: true }), 5)
    expect(normal.low).toBeCloseTo(inverted.low, 5)
    expect(normal.high).toBeCloseTo(inverted.high, 5)
  })

  it('finds a mid-curve peak that endpoint sampling would miss', () => {
    // A Band curve returns to zero at both ends, so checking only x=0 and x=1 would
    // report a range of zero while the parameter visibly moves.
    const band = CURVE_PRESETS.find((p) => p.id === 'band')!.points
    const { low, high } = connectionRange(connection({ min: 0, max: 4, curve: band }), 0)
    expect(low).toBeCloseTo(0, 5)
    expect(high).toBeCloseTo(4, 5)
  })

  it('handles a negative range without inverting low and high', () => {
    const { low, high } = connectionRange(connection({ min: 0, max: -3 }), 10)
    expect(low).toBeCloseTo(7, 5)
    expect(high).toBeCloseTo(10, 5)
  })
})
