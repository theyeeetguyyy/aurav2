import { describe, expect, it } from 'vitest'
import { resolveLoopRegion } from './MultiTrackRack'

/** The Loop button was a no-op for its entire existence.
 *
 *  `loopStart` and `loopEnd` both default to 0, and the transport guarded on
 *  `loopEnd > loopStart` — never true until a region-selection UI existed (Phase 6B).
 *  So the button toggled a flag, lit up, and did nothing. */
describe('resolveLoopRegion', () => {
  it('treats an unset region as the whole project', () => {
    expect(resolveLoopRegion(0, 0, 90)).toEqual({ loopStart: 0, loopEnd: 90 })
  })

  it('honours an explicit region', () => {
    expect(resolveLoopRegion(8, 24, 90)).toEqual({ loopStart: 8, loopEnd: 24 })
  })

  it('falls back to the whole project for an inverted or empty region', () => {
    // A zero-length region must not mean "loop nothing" — that is indistinguishable
    // from the default, and would put playback in a one-frame trap.
    expect(resolveLoopRegion(30, 30, 90)).toEqual({ loopStart: 0, loopEnd: 90 })
    expect(resolveLoopRegion(50, 20, 90)).toEqual({ loopStart: 0, loopEnd: 90 })
  })

  it('yields a non-looping region when there is no audio', () => {
    // loopEnd === loopStart === 0, so the transport's `loopEnd > loopStart` check
    // fails and playback is never restarted. Correct: there is nothing to loop.
    const region = resolveLoopRegion(0, 0, 0)
    expect(region.loopEnd).toBe(0)
    expect(region.loopEnd > region.loopStart).toBe(false)
  })
})
