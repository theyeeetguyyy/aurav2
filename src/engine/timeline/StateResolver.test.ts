import { describe, expect, it } from 'vitest'
import { findFreeSlot, resolveTimeline, snapToGrid } from './StateResolver'
import type { Strip, VisualState } from '@/types/project'
import { DEFAULT_PALETTE } from '@/engine/scene/palette'

function state(id: string): VisualState {
  return {
    id,
    name: id,
    color: '#ffffff',
    objects: [],
    connections: [],
    post: [],
    postBypassed: false,
    palette: DEFAULT_PALETTE,
  }
}

function strip(id: string, stateId: string, startTime: number, duration: number, lane = 0): Strip {
  return { id, stateId, startTime, duration, lane }
}

const library = { a: state('a'), b: state('b') }

describe('resolveTimeline', () => {
  it('names no state when nothing is sequenced, so the loaded scene renders', () => {
    const resolved = resolveTimeline([], library, 12)
    expect(resolved.stateId).toBeNull()
    expect(resolved.activeStripIds).toEqual([])
    expect(resolved.cutTime).toBeNull()
  })

  it('returns the identical object for an unsequenced project', () => {
    // Same reference, so the per-frame driver allocates nothing in the common case.
    expect(resolveTimeline([], library, 0)).toBe(resolveTimeline([], library, 99))
  })

  it('names the state whose strip covers the time', () => {
    const resolved = resolveTimeline([strip('s1', 'a', 4, 4)], library, 5)
    expect(resolved.stateId).toBe('a')
    expect(resolved.activeStripIds).toEqual(['s1'])
  })

  it('treats a strip as half-open, so butted strips never both play', () => {
    const strips = [strip('s1', 'a', 0, 4), strip('s2', 'b', 4, 4)]
    expect(resolveTimeline(strips, library, 3.99).stateId).toBe('a')
    expect(resolveTimeline(strips, library, 4).stateId).toBe('b')
  })

  it('holds the previous look through a gap rather than cutting to black', () => {
    expect(resolveTimeline([strip('s1', 'a', 0, 2)], library, 5).stateId).toBeNull()
  })

  it('lets the higher lane own the frame', () => {
    const strips = [strip('bottom', 'a', 0, 8, 0), strip('top', 'b', 0, 8, 2)]
    const resolved = resolveTimeline(strips, library, 1)
    expect(resolved.stateId).toBe('b')
    // Both are live; the order says which won.
    expect(resolved.activeStripIds).toEqual(['bottom', 'top'])
  })

  it('falls through when the live strip points at a deleted state', () => {
    expect(resolveTimeline([strip('s1', 'gone', 0, 8)], library, 1).stateId).toBeNull()
  })
})

describe('cutTime', () => {
  it('is null when nothing is sequenced, so nothing keyed off it fires', () => {
    expect(resolveTimeline([], library, 5).cutTime).toBeNull()
  })

  it('reports when the live strip began', () => {
    expect(resolveTimeline([strip('s1', 'a', 8, 4)], library, 9).cutTime).toBe(8)
  })

  it('takes the LATEST boundary when lanes overlap', () => {
    // A background strip under a drop: the moment the picture changed is when the drop came in.
    const strips = [strip('bg', 'a', 0, 60, 0), strip('drop', 'b', 32, 8, 1)]
    expect(resolveTimeline(strips, library, 33).cutTime).toBe(32)
  })

  it('is null in a gap, because the picture did not change entering one', () => {
    expect(resolveTimeline([strip('s1', 'a', 0, 2)], library, 5).cutTime).toBeNull()
  })
})

describe('findFreeSlot', () => {
  it('keeps the requested time and lane when nothing is in the way', () => {
    expect(findFreeSlot([], 4, 2, 3)).toEqual({ startTime: 4, lane: 0 })
  })

  it('steps up a lane rather than burying the new strip', () => {
    // Two Place clicks at the same playhead used to land on top of each other, and the one
    // underneath is on a losing lane, so it was invisible AND inert.
    expect(findFreeSlot([strip('a', 'a', 0, 8, 0)], 0, 4, 3)).toEqual({ startTime: 0, lane: 1 })
  })

  it('appends after everything once every lane is busy at that time', () => {
    const strips = [
      strip('a', 'a', 0, 8, 0),
      strip('b', 'a', 0, 6, 1),
      strip('c', 'a', 0, 10, 2),
    ]
    expect(findFreeSlot(strips, 0, 4, 3)).toEqual({ startTime: 10, lane: 0 })
  })

  it('treats a strip that merely touches as free, matching the half-open resolver', () => {
    expect(findFreeSlot([strip('a', 'a', 0, 4, 0)], 4, 4, 3)).toEqual({ startTime: 4, lane: 0 })
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
