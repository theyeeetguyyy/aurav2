import { describe, expect, it } from 'vitest'
import { SILENCE_FLOOR, SILENCE_IGNORE, SILENCE_RAMP, writeSilence } from './silence'

const RATE = 200

/** Build an envelope from spans of `[seconds, level]`. */
function envelope(spans: [number, number][]): Float32Array {
  const total = spans.reduce((n, [seconds]) => n + Math.round(seconds * RATE), 0)
  const out = new Float32Array(total)
  let at = 0
  for (const [seconds, level] of spans) {
    const frames = Math.round(seconds * RATE)
    out.fill(level, at, at + frames)
    at += frames
  }
  return out
}

function silenceOf(spans: [number, number][]): Float32Array {
  const env = envelope(spans)
  const out = new Float32Array(env.length)
  writeSilence(env, out, RATE)
  return out
}

const at = (signal: Float32Array, seconds: number) => signal[Math.round(seconds * RATE)]

describe('silence', () => {
  it('stays at zero before the stem has ever played', () => {
    // The property a live tap cannot have. At the first frame of a song every stem is quiet, and a
    // naive "quiet means silent" reading would open an intro with every silence wire at maximum.
    const signal = silenceOf([
      [4, 0],
      [1, 0.8],
    ])
    expect(at(signal, 0)).toBe(0)
    expect(at(signal, 2)).toBe(0)
    expect(at(signal, 3.9)).toBe(0)
  })

  it('ignores the gap between hits', () => {
    // A kick pattern is mostly silence by duration. Responding to it would fire eight times a bar
    // and read as chatter rather than as an event — which is why inverting the envelope is not
    // this feature.
    const beat: [number, number][] = []
    for (let i = 0; i < 16; i++) beat.push([0.02, 0.9], [0.1, 0])
    const signal = silenceOf(beat)
    expect(Math.max(...signal)).toBe(0)
  })

  it('rises once a stop outlasts a gap, and reaches full after the ramp', () => {
    const signal = silenceOf([
      [1, 0.9],
      [3, 0],
    ])
    // Still nothing while the stop is shorter than a gap between hits.
    expect(at(signal, 1 + SILENCE_IGNORE * 0.5)).toBe(0)
    // Climbing through the ramp.
    const mid = at(signal, 1 + SILENCE_IGNORE + SILENCE_RAMP * 0.5)
    expect(mid).toBeGreaterThan(0.3)
    expect(mid).toBeLessThan(0.7)
    // Full, and it stays there.
    expect(at(signal, 1 + SILENCE_IGNORE + SILENCE_RAMP + 0.1)).toBeCloseTo(1, 2)
    expect(at(signal, 3.5)).toBeCloseTo(1, 2)
  })

  it('resets the moment the stem comes back', () => {
    // The drop. The signal must be at zero on the frame the sound returns, or the visual it drives
    // arrives late to the one moment it exists for.
    const signal = silenceOf([
      [0.5, 0.9],
      [2, 0],
      [1, 0.9],
    ])
    expect(at(signal, 2.4)).toBeCloseTo(1, 2)
    expect(at(signal, 2.6)).toBe(0)
  })

  it('reports nothing for a stem that never rises above the floor', () => {
    // A muted or empty stem is not "silent throughout" — it has no signal at all, and treating it
    // as maximum silence would make the emptiest stem the loudest source in the project.
    const signal = silenceOf([[5, SILENCE_FLOOR * 0.5]])
    expect(Math.max(...signal)).toBe(0)
  })

  it('stays inside 0–1 and never emits NaN', () => {
    const signal = silenceOf([
      [0.2, 1],
      [6, 0],
    ])
    for (const value of signal) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('handles an empty timeline', () => {
    const out = new Float32Array(0)
    expect(() => writeSilence(new Float32Array(0), out, RATE)).not.toThrow()
  })
})
