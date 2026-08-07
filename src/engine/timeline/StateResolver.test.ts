import { describe, expect, it } from 'vitest'
import { findFreeSlot, resolveTimeline, snapToGrid, withOverride } from './StateResolver'
import type { Strip, VisualState } from '@/types/project'
import type { SignalChain } from '@/types/modulation'

function state(id: string, patch: Partial<VisualState> = {}): VisualState {
  return {
    id,
    name: id,
    color: '#ffffff',
    sceneObjectIds: [],
    activeConnectionIds: [],
    activePostIds: [],
    connectionOverrides: {},
    ...patch,
  }
}

function strip(id: string, stateId: string, startTime: number, duration: number, lane = 0): Strip {
  return { id, stateId, startTime, duration, lane }
}

describe('resolveTimeline', () => {
  it('shows everything when nothing is sequenced', () => {
    const resolved = resolveTimeline([], {}, 12)
    expect(resolved.visibleObjectIds).toBeNull()
    expect(resolved.activeConnectionIds).toBeNull()
    expect(resolved.activePostIds).toBeNull()
    expect(resolved.activeStripIds).toEqual([])
  })

  it('returns the identical object for an unsequenced project', () => {
    // Same reference, so the per-frame driver allocates nothing in the common case.
    expect(resolveTimeline([], {}, 0)).toBe(resolveTimeline([], {}, 99))
  })

  it('shows only what the live strip selects', () => {
    const states = { a: state('a', { sceneObjectIds: ['cube'], activePostIds: ['bloom'] }) }
    const resolved = resolveTimeline([strip('s1', 'a', 4, 4)], states, 5)

    expect([...resolved.visibleObjectIds!]).toEqual(['cube'])
    expect([...resolved.activePostIds!]).toEqual(['bloom'])
    expect(resolved.activeStripIds).toEqual(['s1'])
  })

  it('treats a strip as half-open, so butted strips never both play', () => {
    const states = { a: state('a', { sceneObjectIds: ['cube'] }) }
    const strips = [strip('s1', 'a', 0, 4), strip('s2', 'a', 4, 4)]

    expect(resolveTimeline(strips, states, 3.99).activeStripIds).toEqual(['s1'])
    expect(resolveTimeline(strips, states, 4).activeStripIds).toEqual(['s2'])
  })

  it('holds the previous look through a gap rather than cutting to black', () => {
    const states = { a: state('a', { sceneObjectIds: ['cube'] }) }
    const resolved = resolveTimeline([strip('s1', 'a', 0, 2)], states, 5)
    expect(resolved.visibleObjectIds).toBeNull()
  })

  it('unions overlapping lanes and reports them lowest lane first', () => {
    const states = {
      bg: state('bg', { sceneObjectIds: ['floor'] }),
      drop: state('drop', { sceneObjectIds: ['cube'] }),
    }
    const strips = [strip('top', 'drop', 0, 8, 2), strip('bottom', 'bg', 0, 8, 0)]
    const resolved = resolveTimeline(strips, states, 1)

    expect(resolved.activeStripIds).toEqual(['bottom', 'top'])
    expect([...resolved.visibleObjectIds!].sort()).toEqual(['cube', 'floor'])
  })

  it('lets the higher lane win a conflicting override, key by key', () => {
    const states = {
      bg: state('bg', { connectionOverrides: { c1: { gain: 1, weight: 0.25 } } }),
      drop: state('drop', { connectionOverrides: { c1: { gain: 4 } } }),
    }
    const strips = [strip('top', 'drop', 0, 8, 1), strip('bottom', 'bg', 0, 8, 0)]
    const resolved = resolveTimeline(strips, states, 1)

    // Gain comes from the top lane; weight survives from the one underneath.
    expect(resolved.overrides.c1).toEqual({ gain: 4, weight: 0.25 })
  })

  it('falls back to everything when the live strip points at a deleted state', () => {
    const resolved = resolveTimeline([strip('s1', 'gone', 0, 8)], {}, 1)
    expect(resolved.visibleObjectIds).toBeNull()
  })
})

describe('cutTime', () => {
  const states = { a: state('a', { sceneObjectIds: ['cube'] }) }

  it('is null on an unsequenced project, so nothing keyed off it fires', () => {
    expect(resolveTimeline([], states, 5).cutTime).toBeNull()
  })

  it('reports when the live strip began', () => {
    expect(resolveTimeline([strip('s1', 'a', 8, 4)], states, 9).cutTime).toBe(8)
  })

  it('takes the LATEST boundary when lanes overlap', () => {
    // A background strip running under a drop: the moment the picture changed is when the
    // drop came in, not when the background did.
    const strips = [strip('bg', 'a', 0, 60, 0), strip('drop', 'a', 32, 8, 1)]
    expect(resolveTimeline(strips, states, 33).cutTime).toBe(32)
  })

  it('is null in a gap, because the picture did not change entering one', () => {
    expect(resolveTimeline([strip('s1', 'a', 0, 2)], states, 5).cutTime).toBeNull()
  })
})

describe('withOverride', () => {
  const chain: SignalChain = { gain: 1, weight: 1 } as SignalChain

  it('returns the same chain when there is nothing to override', () => {
    expect(withOverride(chain, undefined)).toBe(chain)
  })

  it('patches only the keys the override names', () => {
    expect(withOverride(chain, { gain: 3 })).toEqual({ gain: 3, weight: 1 })
  })
})

describe('snapToGrid', () => {
  const grid = [0, 0.5, 1, 1.5, 2]

  it('snaps to the nearest beat inside the tolerance', () => {
    expect(snapToGrid(1.04, grid, 0.1)).toBe(1)
    expect(snapToGrid(1.46, grid, 0.1)).toBe(1.5)
  })

  it('leaves the time alone outside the tolerance, so fine placement still works', () => {
    expect(snapToGrid(1.25, grid, 0.1)).toBe(1.25)
  })

  it('does nothing with no grid or no tolerance', () => {
    expect(snapToGrid(1.04, [], 0.1)).toBe(1.04)
    expect(snapToGrid(1.04, grid, 0)).toBe(1.04)
  })

  it('never returns a negative time', () => {
    expect(snapToGrid(-5, grid, 0.1)).toBe(0)
    expect(snapToGrid(-5, [], 0)).toBe(0)
  })
})

describe('findFreeSlot', () => {
  it('keeps the requested time and lane when nothing is in the way', () => {
    expect(findFreeSlot([], 4, 2, 3)).toEqual({ startTime: 4, lane: 0 })
  })

  it('steps up a lane rather than burying the new strip', () => {
    // Two Place clicks at the same playhead used to land on top of each other, and the one
    // underneath is on a losing lane anyway — so it was invisible AND inert.
    const strips = [strip('a', 's', 0, 8, 0)]
    expect(findFreeSlot(strips, 0, 4, 3)).toEqual({ startTime: 0, lane: 1 })
  })

  it('appends after everything once every lane is busy at that time', () => {
    const strips = [
      strip('a', 's', 0, 8, 0),
      strip('b', 's', 0, 6, 1),
      strip('c', 's', 0, 10, 2),
    ]
    expect(findFreeSlot(strips, 0, 4, 3)).toEqual({ startTime: 10, lane: 0 })
  })

  it('treats a strip that merely touches as free, matching the half-open resolver', () => {
    const strips = [strip('a', 's', 0, 4, 0)]
    expect(findFreeSlot(strips, 4, 4, 3)).toEqual({ startTime: 4, lane: 0 })
  })
})
