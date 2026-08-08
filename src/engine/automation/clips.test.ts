import { describe, expect, it } from 'vitest'
import {
  MAX_CLIP_REPEAT,
  MIN_CLIP_SECONDS,
  clipAt,
  clipPhase,
  duplicateOffset,
  holdValue,
  normaliseClip,
  patternFromPoints,
  resizeClip,
  sampleClips,
  type AutomationClip,
  type AutomationPattern,
} from './clips'
import { flatPattern, rampPattern, samplePoints, stabPattern } from './lane'

function clip(patch: Partial<AutomationClip> = {}): AutomationClip {
  return { id: 'c1', patternId: 'p1', startTime: 0, duration: 4, repeat: 1, ...patch }
}

const ramp: AutomationPattern = {
  id: 'p1',
  name: 'Ramp',
  color: '#fff',
  points: rampPattern(0, 1),
  interpolation: 'linear',
}
const patterns = { p1: ramp }

describe('clipAt', () => {
  it('finds the clip covering a time', () => {
    expect(clipAt([clip()], 2)?.id).toBe('c1')
    expect(clipAt([clip()], 9)).toBeNull()
  })

  it('is half-open, so butted clips never both claim the boundary', () => {
    const a = clip({ id: 'a', startTime: 0, duration: 4 })
    const b = clip({ id: 'b', startTime: 4, duration: 4 })
    expect(clipAt([a, b], 3.99)?.id).toBe('a')
    expect(clipAt([a, b], 4)?.id).toBe('b')
  })

  it('lets a later clip win an overlap, like every NLE', () => {
    const under = clip({ id: 'under', startTime: 0, duration: 8 })
    const over = clip({ id: 'over', startTime: 2, duration: 2 })
    expect(clipAt([under, over], 3)?.id).toBe('over')
    expect(clipAt([under, over], 6)?.id).toBe('under')
  })
})

describe('clipPhase', () => {
  it('runs 0 to 1 across a single pass', () => {
    const c = clip({ startTime: 10, duration: 4 })
    expect(clipPhase(c, 10)).toBeCloseTo(0)
    expect(clipPhase(c, 12)).toBeCloseTo(0.5)
  })

  it('cycles `repeat` times inside the same span — the ten-seconds-every-second case', () => {
    // Ten cycles across ten seconds: the pattern runs once per second.
    const c = clip({ startTime: 0, duration: 10, repeat: 10 })
    expect(clipPhase(c, 0)).toBeCloseTo(0)
    expect(clipPhase(c, 0.5)).toBeCloseTo(0.5)
    expect(clipPhase(c, 1)).toBeCloseTo(0)
    expect(clipPhase(c, 1.5)).toBeCloseTo(0.5)
    expect(clipPhase(c, 7.25)).toBeCloseTo(0.25)
  })

  it('ends on 1 rather than wrapping, so a clip ending high does not flicker', () => {
    expect(clipPhase(clip({ duration: 4, repeat: 3 }), 4)).toBe(1)
  })

  it('survives a degenerate duration', () => {
    expect(Number.isFinite(clipPhase(clip({ duration: 0 }), 0))).toBe(true)
  })
})

describe('sampleClips', () => {
  it('reads the pattern through the clip', () => {
    expect(sampleClips([clip({ duration: 4 })], patterns, 2)).toBeCloseTo(0.5)
  })

  it('returns null in a gap, so the caller decides what a gap means', () => {
    expect(sampleClips([clip({ duration: 4 })], patterns, 9)).toBeNull()
  })

  it('returns null when the pattern is missing rather than guessing at 0', () => {
    expect(sampleClips([clip({ patternId: 'gone' })], patterns, 1)).toBeNull()
  })

  it('repeats turn a ramp into a sawtooth', () => {
    const c = clip({ duration: 4, repeat: 4 })
    expect(sampleClips([c], patterns, 0.5)).toBeCloseTo(0.5)
    expect(sampleClips([c], patterns, 1.0)).toBeCloseTo(0)
    expect(sampleClips([c], patterns, 1.5)).toBeCloseTo(0.5)
  })

  it('agrees with samplePoints at the same phase — one curve, not two', () => {
    // The clip UI draws with samplePoints and the engine reads through sampleClips. If these
    // disagreed, the curve on screen would not be the curve that runs.
    const c = clip({ duration: 6, repeat: 2 })
    const t = 4.1
    expect(sampleClips([c], patterns, t)).toBeCloseTo(
      samplePoints(ramp.points, ramp.interpolation, clipPhase(c, t)),
    )
  })
})

describe('holdValue', () => {
  const flat: AutomationPattern = { ...ramp, id: 'flat', points: flatPattern(0.3) }

  it('holds the nearest edge, so a curve does not mute its parameter elsewhere', () => {
    const c = clip({ startTime: 4, duration: 2 })
    expect(holdValue([c], patterns, 0)).toBeCloseTo(0)
    expect(holdValue([c], patterns, 20)).toBeCloseTo(1)
  })

  it('picks whichever edge is closer in time', () => {
    const a = clip({ id: 'a', patternId: 'flat', startTime: 0, duration: 2 })
    const b = clip({ id: 'b', patternId: 'p1', startTime: 10, duration: 2 })
    const table = { p1: ramp, flat }
    expect(holdValue([a, b], table, 2.5)).toBeCloseTo(0.3)
    expect(holdValue([a, b], table, 9.5)).toBeCloseTo(0)
  })

  it('has nothing to hold with no clips', () => {
    expect(holdValue([], patterns, 5)).toBeNull()
  })
})

describe('normaliseClip', () => {
  it('clamps a clip nobody could grab back', () => {
    const c = normaliseClip(clip({ startTime: -5, duration: 0, repeat: 0 }))
    expect(c.startTime).toBe(0)
    expect(c.duration).toBe(MIN_CLIP_SECONDS)
    expect(c.repeat).toBe(1)
  })

  it('caps repeat where the drawing stops describing anything', () => {
    expect(normaliseClip(clip({ repeat: 5000 })).repeat).toBe(MAX_CLIP_REPEAT)
  })

  it('rounds a fractional repeat', () => {
    expect(normaliseClip(clip({ repeat: 3.6 })).repeat).toBe(4)
  })
})

describe('resizeClip', () => {
  it('holds the far edge still — that is what makes it a resize, not a move', () => {
    const c = clip({ startTime: 4, duration: 4 })
    const resized = resizeClip(c, 'start', 6)
    expect(resized.startTime).toBe(6)
    expect(resized.startTime + resized.duration).toBeCloseTo(8)
  })

  it('extends from the end without moving the start', () => {
    const resized = resizeClip(clip({ startTime: 4, duration: 4 }), 'end', 12)
    expect(resized.startTime).toBe(4)
    expect(resized.duration).toBeCloseTo(8)
  })

  it('never inverts, whichever edge is dragged past the other', () => {
    const a = resizeClip(clip({ startTime: 4, duration: 4 }), 'start', 99)
    expect(a.duration).toBeGreaterThanOrEqual(MIN_CLIP_SECONDS)
    const b = resizeClip(clip({ startTime: 4, duration: 4 }), 'end', -99)
    expect(b.duration).toBeGreaterThanOrEqual(MIN_CLIP_SECONDS)
  })

  it('keeps the start at or after zero', () => {
    expect(resizeClip(clip({ startTime: 2, duration: 4 }), 'start', -10).startTime).toBe(0)
  })
})

describe('duplicateOffset', () => {
  it('lands the copy immediately after, never underneath', () => {
    // In place, the copy would sit on top — and since later wins, the ORIGINAL would be the
    // one that stopped playing. Invisible and inert at once.
    expect(duplicateOffset(clip({ startTime: 4, duration: 3 }))).toBe(7)
  })
})

describe('patternFromPoints', () => {
  it('normalises absolute seconds onto 0-1', () => {
    const points = patternFromPoints(
      [
        { t: 0, v: 0 },
        { t: 5, v: 1 },
      ],
      5,
    )
    expect(points[0].t).toBe(0)
    expect(points[1].t).toBe(1)
  })

  it('gives a flat pattern rather than nothing, which would sample as 0', () => {
    expect(patternFromPoints([], 10)).toHaveLength(2)
    expect(patternFromPoints([{ t: 0, v: 1 }], 0)).toHaveLength(2)
  })
})

describe('starting shapes', () => {
  it('all span the pattern domain exactly', () => {
    for (const points of [flatPattern(), rampPattern(), stabPattern()]) {
      expect(points[0].t).toBe(0)
      expect(points[points.length - 1].t).toBe(1)
    }
  })

  it('a stab starts at full and decays, which is what repeat is for', () => {
    const stab = stabPattern()
    expect(stab[0].v).toBe(1)
    expect(stab[stab.length - 1].v).toBeLessThan(0.1)
  })
})
