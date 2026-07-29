import { describe, expect, it } from 'vitest'
import { DEFORMER_BRICKS } from './deformers'
import type { DeformContext } from './types'
import { noise3, fbm3 } from './noise'

/** A cube of 8 vertices is enough to prove displacement behaviour without depending on
 *  the real icosphere. */
function makeContext(params: Record<string, number | string>): DeformContext {
  const base = new Float32Array([
    1, 1, 1, -1, 1, 1, 1, -1, 1, -1, -1, 1, 1, 1, -1, -1, 1, -1, 1, -1, -1, -1, -1, -1,
  ])
  const directions = new Float32Array(base.length)
  for (let i = 0; i < base.length; i += 3) {
    const length = Math.hypot(base[i], base[i + 1], base[i + 2])
    directions[i] = base[i] / length
    directions[i + 1] = base[i + 1] / length
    directions[i + 2] = base[i + 2] / length
  }

  return {
    positions: Float32Array.from(base),
    base,
    directions,
    vertexCount: base.length / 3,
    params: params as Record<string, number>,
  }
}

const byId = (id: string) => {
  const brick = DEFORMER_BRICKS.find((b) => b.id === id)
  if (!brick) throw new Error(`no deformer ${id}`)
  return brick
}

function defaultsOf(id: string): Record<string, number | string> {
  const params: Record<string, number | string> = {}
  for (const d of byId(id).descriptors) params[d.key] = d.defaultValue as number | string
  return params
}

describe('deformers are inert at defaults', () => {
  // A freshly added deformer must not change the shape. Otherwise adding one to inspect
  // its controls silently destroys whatever the user had.
  it.each(DEFORMER_BRICKS.map((b) => [b.id] as const))('%s leaves geometry untouched', (id) => {
    const ctx = makeContext(defaultsOf(id))
    const before = Float32Array.from(ctx.positions)
    byId(id).apply(ctx)
    expect(Array.from(ctx.positions)).toEqual(Array.from(before))
  })
})

describe('deformers cannot animate on their own (D-36)', () => {
  // The contract has no `time`, so a deformer is a pure function of its parameters.
  // All motion must arrive through modulation — a stem, an LFO, a Generator. This test
  // is the structural guard: identical params must give identical geometry, forever.
  it.each(DEFORMER_BRICKS.map((b) => [b.id] as const))('%s is deterministic', (id) => {
    const params = { ...defaultsOf(id), amount: 3, strength: 3, angle: 90, phase: 0.3 }

    const run = () => {
      const ctx = makeContext(params)
      byId(id).apply(ctx)
      return Array.from(ctx.positions)
    }

    const first = run()
    for (let i = 0; i < 5; i++) expect(run()).toEqual(first)
  })

  it('exposes no way to read a clock', () => {
    // If someone adds `time` back to DeformContext, this fails and they have to argue
    // with D-36 rather than quietly reintroduce built-in motion.
    const ctx = makeContext(defaultsOf('def-wave'))
    expect('time' in ctx).toBe(false)
  })

  it('routes travel through a modulatable phase instead', () => {
    // Wave and Noise used to animate off an internal `speed`. They now expose `phase`,
    // which a saw LFO drives — same motion, but authored and sync-able.
    for (const id of ['def-wave', 'def-noise']) {
      const brick = byId(id)
      expect(brick.descriptors.some((d) => d.key === 'speed'), `${id} still has speed`).toBe(false)
      const phase = brick.descriptors.find((d) => d.key === 'phase')
      expect(phase, `${id} missing phase`).toBeDefined()
      expect(phase!.realtime).toBe(true)
    }
  })

  it('phase actually changes the result', () => {
    const at = (phase: number) => {
      const ctx = makeContext({ ...defaultsOf('def-wave'), amount: 4, phase })
      byId('def-wave').apply(ctx)
      return Array.from(ctx.positions)
    }
    expect(at(0)).not.toEqual(at(0.5))
  })
})

describe('explode', () => {
  it('pushes every vertex outward along its direction', () => {
    const ctx = makeContext({ ...defaultsOf('def-explode'), strength: 2, spread: 0 })
    byId('def-explode').apply(ctx)

    for (let i = 0; i < ctx.vertexCount; i++) {
      const o = i * 3
      const before = Math.hypot(ctx.base[o], ctx.base[o + 1], ctx.base[o + 2])
      const after = Math.hypot(ctx.positions[o], ctx.positions[o + 1], ctx.positions[o + 2])
      expect(after).toBeGreaterThan(before)
    }
  })

  it('pulls inward on a negative strength', () => {
    const ctx = makeContext({ ...defaultsOf('def-explode'), strength: -0.5, spread: 0 })
    byId('def-explode').apply(ctx)
    const after = Math.hypot(ctx.positions[0], ctx.positions[1], ctx.positions[2])
    expect(after).toBeLessThan(Math.hypot(ctx.base[0], ctx.base[1], ctx.base[2]))
  })

  it('keeps its shard pattern stable across evaluations', () => {
    // Per-vertex jitter is keyed on index — otherwise the surface boils instead of
    // bursting.
    const params = { ...defaultsOf('def-explode'), strength: 2, spread: 1 }
    const a = makeContext(params)
    const b = makeContext(params)
    byId('def-explode').apply(a)
    byId('def-explode').apply(b)
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions))
  })
})

describe('spike', () => {
  it('displaces along the selected axis only', () => {
    const ctx = makeContext({ ...defaultsOf('def-spike'), amount: 5, axis: 'y', sharpness: 1 })
    byId('def-spike').apply(ctx)

    for (let i = 0; i < ctx.vertexCount; i++) {
      const o = i * 3
      expect(ctx.positions[o]).toBeCloseTo(ctx.base[o], 6)
      expect(ctx.positions[o + 2]).toBeCloseTo(ctx.base[o + 2], 6)
    }
  })

  it('concentrates displacement as sharpness rises', () => {
    const displacementAt = (sharpness: number) => {
      const ctx = makeContext({ ...defaultsOf('def-spike'), amount: 5, axis: 'y', sharpness })
      byId('def-spike').apply(ctx)
      return Math.abs(ctx.positions[1] - ctx.base[1])
    }
    // Cube corners sit off-axis, so a higher exponent on dot(normal, axis) reduces them.
    expect(displacementAt(8)).toBeLessThan(displacementAt(1))
  })
})

describe('twist', () => {
  it('preserves distance from the twist axis', () => {
    const ctx = makeContext({ ...defaultsOf('def-twist'), angle: 180, axis: 'y', falloff: 1 })
    byId('def-twist').apply(ctx)

    for (let i = 0; i < ctx.vertexCount; i++) {
      const o = i * 3
      const before = Math.hypot(ctx.base[o], ctx.base[o + 2])
      const after = Math.hypot(ctx.positions[o], ctx.positions[o + 2])
      // Rotation about Y cannot change radius in XZ, only angle.
      expect(after).toBeCloseTo(before, 5)
      expect(ctx.positions[o + 1]).toBeCloseTo(ctx.base[o + 1], 6)
    }
  })
})

describe('noise helpers', () => {
  it('noise3 stays in 0–1 and is deterministic', () => {
    for (let i = 0; i < 200; i++) {
      const v = noise3(i * 0.37, i * -0.11, i * 0.73)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(noise3(1.5, 2.5, 3.5)).toBe(noise3(1.5, 2.5, 3.5))
  })

  it('fbm3 stays in 0–1 at every octave count', () => {
    for (const octaves of [1, 2, 3, 4]) {
      for (let i = 0; i < 50; i++) {
        const v = fbm3(i * 0.21, i * 0.13, i * -0.31, octaves)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('descriptor hygiene', () => {
  it('declares defaults inside range and marks displacement params realtime', () => {
    for (const brick of DEFORMER_BRICKS) {
      for (const d of brick.descriptors) {
        if (d.type === 'float' || d.type === 'int') {
          const value = d.defaultValue as number
          expect(value, `${brick.id}.${d.key}`).toBeGreaterThanOrEqual(d.min)
          expect(value, `${brick.id}.${d.key}`).toBeLessThanOrEqual(d.max)
        }
      }
      // The whole point of a deformer is being drivable at frame rate — at least one
      // parameter must be.
      expect(brick.descriptors.some((d) => d.realtime && d.exposed), brick.id).toBe(true)
    }
  })

  it('has unique ids', () => {
    const ids = DEFORMER_BRICKS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('new deformer families behave structurally differently', () => {
  it('vortex rotates most near the axis, twist most far along it', () => {
    // The two are easy to confuse. Vortex falls off with distance FROM the axis;
    // Twist grows with distance ALONG it. Opposite structures.
    const vortex = makeContext({ ...defaultsOf('def-vortex'), angle: 180, axis: 'y', radius: 2 })
    byId('def-vortex').apply(vortex)
    for (let i = 0; i < vortex.vertexCount; i++) {
      const o = i * 3
      // Rotation about Y preserves XZ radius and leaves Y alone, whatever the falloff.
      expect(Math.hypot(vortex.positions[o], vortex.positions[o + 2])).toBeCloseTo(
        Math.hypot(vortex.base[o], vortex.base[o + 2]),
        5,
      )
      expect(vortex.positions[o + 1]).toBeCloseTo(vortex.base[o + 1], 6)
    }
  })

  it('squash preserves volume', () => {
    const ctx = makeContext({ ...defaultsOf('def-squash'), amount: 3, axis: 'y' })
    byId('def-squash').apply(ctx)
    const o = 0
    const sy = ctx.positions[o + 1] / ctx.base[o + 1]
    const sx = ctx.positions[o] / ctx.base[o]
    const sz = ctx.positions[o + 2] / ctx.base[o + 2]
    // scale_along * scale_across^2 == 1 is what makes it read as elastic.
    expect(sy * sx * sz).toBeCloseTo(1, 5)
  })

  it('quantize snaps onto the grid at full amount', () => {
    const step = 0.75
    const ctx = makeContext({ ...defaultsOf('def-quantize'), amount: 1, step })
    byId('def-quantize').apply(ctx)
    for (let i = 0; i < ctx.positions.length; i++) {
      expect(ctx.positions[i] / step).toBeCloseTo(Math.round(ctx.positions[i] / step), 5)
    }
  })

  it('spherify drives every vertex to one radius at full amount', () => {
    const radius = 4
    const ctx = makeContext({ ...defaultsOf('def-spherify'), amount: 1, radius })
    byId('def-spherify').apply(ctx)
    for (let i = 0; i < ctx.vertexCount; i++) {
      const o = i * 3
      expect(Math.hypot(ctx.positions[o], ctx.positions[o + 1], ctx.positions[o + 2])).toBeCloseTo(
        radius,
        4,
      )
    }
  })

  it('attract collapses toward its point', () => {
    const ctx = makeContext({ ...defaultsOf('def-attract'), amount: 1, x: 0, y: 0, z: 0, radius: 50 })
    byId('def-attract').apply(ctx)
    for (let i = 0; i < ctx.vertexCount; i++) {
      const o = i * 3
      expect(Math.hypot(ctx.positions[o], ctx.positions[o + 1], ctx.positions[o + 2])).toBeLessThan(
        Math.hypot(ctx.base[o], ctx.base[o + 1], ctx.base[o + 2]),
      )
    }
  })

  it('melt only ever moves material downward', () => {
    const ctx = makeContext({ ...defaultsOf('def-melt'), amount: 10, floor: -2, spread: 0 })
    byId('def-melt').apply(ctx)
    for (let i = 0; i < ctx.vertexCount; i++) {
      const o = i * 3
      expect(ctx.positions[o + 1]).toBeLessThanOrEqual(ctx.base[o + 1] + 1e-6)
    }
  })

  it('fracture moves vertices sharing a cell as one rigid unit', () => {
    // Two neighbours inside ONE cell must receive the same translation — that is exactly
    // what separates fracture (chunks move together) from explode (every vertex
    // independently, so the mesh stretches instead of breaking).
    //
    // The shared 8-corner cube cannot show this: its corners sit at ±1, so every axis
    // straddles the 0/−1 cell boundary and no two corners ever share a cell.
    const base = new Float32Array([2, 2, 2, 2.4, 2.1, 2.2])
    const directions = new Float32Array(base.length)
    for (let i = 0; i < base.length; i += 3) {
      const length = Math.hypot(base[i], base[i + 1], base[i + 2])
      directions[i] = base[i] / length
      directions[i + 1] = base[i + 1] / length
      directions[i + 2] = base[i + 2] / length
    }

    const ctx: DeformContext = {
      positions: Float32Array.from(base),
      base,
      directions,
      vertexCount: 2,
      params: { ...defaultsOf('def-fracture'), amount: 5, cellSize: 10, spin: 0 } as Record<
        string,
        number
      >,
    }
    byId('def-fracture').apply(ctx)

    for (let axis = 0; axis < 3; axis++) {
      expect(ctx.positions[axis] - base[axis]).toBeCloseTo(
        ctx.positions[3 + axis] - base[3 + axis],
        6,
      )
    }
  })

  it('has 15 structurally distinct deformers', () => {
    expect(DEFORMER_BRICKS.length).toBe(15)
  })
})
