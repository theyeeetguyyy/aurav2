import { describe, expect, it } from 'vitest'
import { clearRange, flatLane, rampLane, sampleLane, writePoint } from './lane'
import type { AutomationPoint, LaneData, LaneInterpolation } from './lane'
import { SignalShaper } from '@/engine/modulation/SignalShaper'
import { DEFAULT_SIGNAL_CHAIN } from '@/types/modulation'

describe('automation lanes', () => {
  const lane = (
    points: AutomationPoint[],
    interpolation: LaneInterpolation = 'linear',
  ): LaneData => ({ points, interpolation })

  it('holds its end values outside the drawn range', () => {
    // Falling to zero outside the stroke would mean a lane drawn over the chorus
    // silently mutes the parameter for the rest of the song.
    const l = lane([
      { t: 2, v: 0.25 },
      { t: 4, v: 0.75 },
    ])
    expect(sampleLane(l, 0)).toBe(0.25)
    expect(sampleLane(l, 100)).toBe(0.75)
  })

  it('interpolates linearly between points', () => {
    const l = lane([
      { t: 0, v: 0 },
      { t: 10, v: 1 },
    ])
    expect(sampleLane(l, 5)).toBeCloseTo(0.5, 6)
  })

  it('eases with smooth interpolation but matches at the endpoints', () => {
    const l = lane(
      [
        { t: 0, v: 0 },
        { t: 10, v: 1 },
      ],
      'smooth',
    )
    expect(sampleLane(l, 0)).toBeCloseTo(0, 6)
    expect(sampleLane(l, 10)).toBeCloseTo(1, 6)
    expect(sampleLane(l, 5)).toBeCloseTo(0.5, 6)
    // Eased means flatter than linear near the start.
    expect(sampleLane(l, 1)).toBeLessThan(0.1)
  })

  it('holds the previous value with step interpolation', () => {
    const l = lane(
      [
        { t: 0, v: 0.2 },
        { t: 10, v: 0.9 },
      ],
      'step',
    )
    expect(sampleLane(l, 9.99)).toBeCloseTo(0.2, 6)
    expect(sampleLane(l, 10)).toBeCloseTo(0.9, 6)
  })

  it('is a pure function of time', () => {
    // The property the whole modulation system rests on (HC-3). A lane is a lookup, so
    // this is free — the test exists so it stays free.
    const l = lane(rampLane(30, 0, 1))
    const a = sampleLane(l, 7.5)
    sampleLane(l, 29)
    expect(sampleLane(l, 7.5)).toBe(a)
  })

  it('keeps points sorted and collapses near-coincident times', () => {
    // A freehand drag emits far more samples than the curve needs; without collapsing,
    // two seconds of drawing produces hundreds of indistinguishable points.
    let points = flatLane(10, 0.5)
    points = writePoint(points, 5, 0.9)
    points = writePoint(points, 5.002, 0.1)

    expect(points.map((p) => p.t)).toEqual([...points.map((p) => p.t)].sort((a, b) => a - b))
    expect(points.filter((p) => Math.abs(p.t - 5) < 0.01)).toHaveLength(1)
    // The later write replaces the earlier one; sampling a hair before the new point
    // is a hair off its value, which is interpolation working rather than a defect.
    expect(sampleLane(lane(points), 5)).toBeCloseTo(0.1, 2)
  })

  it('clamps written values into 0–1', () => {
    const points = writePoint([], 1, 4)
    expect(points[0].v).toBe(1)
    expect(writePoint([], 1, -3)[0].v).toBe(0)
  })

  it('clears a range in either direction', () => {
    const points = [
      { t: 1, v: 0 },
      { t: 5, v: 1 },
      { t: 9, v: 0 },
    ]
    expect(clearRange(points, 8, 2).map((p) => p.t)).toEqual([1, 9])
  })

  it('survives an empty lane', () => {
    expect(sampleLane(lane([]), 3)).toBe(0)
    expect(sampleLane(lane([{ t: 4, v: 0.7 }]), 0)).toBe(0.7)
  })
})

describe('signal chain input window', () => {
  const shape = (input: number, inputMin: number, inputMax: number) =>
    new SignalShaper().process(
      input,
      { ...DEFAULT_SIGNAL_CHAIN, inputMin, inputMax, rise: 0, fall: 0, min: 0, max: 1 },
      0,
    )

  it('stretches a narrow input window onto the full range', () => {
    // The point of the feature: a stem living between 0.3 and 0.6 should drive a
    // parameter across its whole range, not a third of it.
    expect(shape(0.3, 0.3, 0.6)).toBeCloseTo(0, 5)
    expect(shape(0.45, 0.3, 0.6)).toBeCloseTo(0.5, 5)
    expect(shape(0.6, 0.3, 0.6)).toBeCloseTo(1, 5)
  })

  it('clamps outside the window rather than overshooting', () => {
    expect(shape(0.1, 0.3, 0.6)).toBeCloseTo(0, 5)
    expect(shape(0.9, 0.3, 0.6)).toBeCloseTo(1, 5)
  })

  it('is inert at its defaults', () => {
    // An existing project must behave identically until someone touches the window.
    expect(shape(0.42, 0, 1)).toBeCloseTo(0.42, 5)
  })

  it('does not divide by zero on a collapsed window', () => {
    expect(Number.isFinite(shape(0.5, 0.5, 0.5))).toBe(true)
  })
})
