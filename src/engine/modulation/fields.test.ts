import { describe, expect, it } from 'vitest'
import { evaluateField, type FieldContext } from './fields'
import type { FieldRef } from '@/types/params'

const ctx = (time: number): FieldContext => ({ time, isTrackActive: () => true })

/** Every Field must be a PURE FUNCTION OF TIME (HC-3).
 *
 *  This is the property that makes offline export possible: the renderer evaluates
 *  frames out of order and faster than real time, so anything implemented as an
 *  accumulator (`phase += rate * dt`) would silently diverge from what was previewed.
 *  These tests exist to catch a future generative field written the accumulating way. */
describe('generative fields are pure functions of time', () => {
  const keys = ['lfo-sine', 'lfo-triangle', 'lfo-saw', 'lfo-square', 'noise']

  it.each(keys)('%s returns the same value for the same t, in any call order', (key) => {
    const field: FieldRef = { kind: 'generative', key, rate: 0.37 }

    const forward: number[] = []
    for (let i = 0; i < 50; i++) forward.push(evaluateField(field, ctx(i * 0.1)))

    // Same samples, evaluated backwards — the exporter's access pattern.
    const backward: number[] = []
    for (let i = 49; i >= 0; i--) backward.unshift(evaluateField(field, ctx(i * 0.1)))

    expect(backward).toEqual(forward)

    // Re-sampling one arbitrary point still agrees. The input must be computed the
    // same way — 23 * 0.1 is not bit-identical to the literal 2.3, and comparing
    // across that gap tests floating-point arithmetic rather than purity.
    expect(evaluateField(field, ctx(23 * 0.1))).toBe(forward[23])
  })

  it.each(keys)('%s stays within 0–1', (key) => {
    const field: FieldRef = { kind: 'generative', key, rate: 1.7 }
    for (let i = 0; i < 500; i++) {
      const value = evaluateField(field, ctx(i * 0.013))
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('handles negative time without wrapping to a discontinuity', () => {
    // Timeline positions can go negative during scrub or with a pre-roll.
    for (const key of ['lfo-triangle', 'lfo-saw', 'lfo-square']) {
      const field: FieldRef = { kind: 'generative', key, rate: 1 }
      const value = evaluateField(field, ctx(-0.25))
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('sine completes one cycle per 1/rate seconds', () => {
    const field: FieldRef = { kind: 'generative', key: 'lfo-sine', rate: 2 }
    expect(evaluateField(field, ctx(0))).toBeCloseTo(0.5, 6)
    expect(evaluateField(field, ctx(0.125))).toBeCloseTo(1, 6)
    expect(evaluateField(field, ctx(0.375))).toBeCloseTo(0, 6)
    expect(evaluateField(field, ctx(0.5))).toBeCloseTo(0.5, 6)
  })
})

describe('audio field gating', () => {
  it('contributes nothing when the track is not visually active', () => {
    // Solo isolates visuals as well as audio (HC-11). A solo-excluded stem must
    // contribute zero, not a scaled-down value.
    const field: FieldRef = { kind: 'audio', key: 'rms', sourceId: 'track-1' }
    const muted: FieldContext = { time: 1, isTrackActive: () => false }
    expect(evaluateField(field, muted)).toBe(0)
  })

  it('returns 0 for an audio field with no source track', () => {
    expect(evaluateField({ kind: 'audio', key: 'rms' }, ctx(1))).toBe(0)
  })
})

describe('unimplemented field kinds', () => {
  it('return 0 rather than throwing, so a project referencing them still loads', () => {
    expect(evaluateField({ kind: 'narrative', key: 'section-intensity' }, ctx(1))).toBe(0)
    expect(evaluateField({ kind: 'object', key: 'param', sourceId: 'x' }, ctx(1))).toBe(0)
  })
})
