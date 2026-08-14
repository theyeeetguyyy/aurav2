import { describe, expect, it } from 'vitest'
import {
  CLONER_BRICKS,
  radialCloner,
  linearCloner,
  gridCloner,
  scatterCloner,
  surfaceCloner,
} from './cloners'
import { EFFECTOR_BRICKS, flowEffector, randomEffector, stepEffector } from './effectors'
import { EffectRegistry } from '../EffectRegistry'
import { CloneRuntime, hasCloner } from './CloneRuntime'
import {
  isCloner,
  isEffector,
  MAX_CLONES,
  type CloneBuffers,
  type ClonerBrick,
  type EffectorBrick,
} from './types'
import type { EffectInstance } from '@/types/visual'
import type { ParamValue } from '@/types/params'

/** Structural invariants for cloners and effectors.
 *
 *  The one that matters most is that a frame RESTARTS from the layout. Effectors add to
 *  what came before them, so if the buffers were not reset every frame the array would
 *  drift further from its layout on every tick and the result would depend on how long
 *  the app had been open rather than on time (HC-3). */

function buffers(): CloneBuffers {
  return {
    count: 0,
    position: new Float32Array(MAX_CLONES * 3),
    rotation: new Float32Array(MAX_CLONES * 3),
    scale: new Float32Array(MAX_CLONES * 3),
    color: new Float32Array(MAX_CLONES * 3),
  tint: new Float32Array(MAX_CLONES * 3),
  }
}

function defaults(brick: ClonerBrick | EffectorBrick): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {}
  for (const descriptor of brick.descriptors) params[descriptor.key] = descriptor.defaultValue
  return params
}

function layout(brick: ClonerBrick, overrides: Record<string, ParamValue> = {}): CloneBuffers {
  const clones = buffers()
  brick.layout({ params: { ...defaults(brick), ...overrides }, clones })
  return clones
}

describe('cloner catalogue', () => {
  it('registers every cloner and effector under a unique id', () => {
    const ids = [...CLONER_BRICKS, ...EFFECTOR_BRICKS].map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(EffectRegistry.get(id)).not.toBeNull()
  })

  it('tells cloners and effectors apart by contract, not by a flag', () => {
    for (const brick of CLONER_BRICKS) {
      expect(isCloner(brick)).toBe(true)
      expect(isEffector(brick)).toBe(false)
      expect(brick.family).toBe('instancing')
    }
    for (const brick of EFFECTOR_BRICKS) {
      expect(isEffector(brick)).toBe(true)
      expect(isCloner(brick)).toBe(false)
    }
  })

  it('leaves deformers out of both', () => {
    for (const brick of EffectRegistry.listByFamily('geometry')) {
      expect(isCloner(brick)).toBe(false)
      expect(isEffector(brick)).toBe(false)
    }
  })

  it.each(CLONER_BRICKS.map((b) => [b.id, b] as const))(
    '%s clamps its count to MAX_CLONES',
    (_id, brick) => {
      const clones = layout(brick, { count: 99999, countX: 999, countY: 999, countZ: 999 })
      expect(clones.count).toBeGreaterThan(0)
      expect(clones.count).toBeLessThanOrEqual(MAX_CLONES)
    },
  )

  it.each(CLONER_BRICKS.map((b) => [b.id, b] as const))(
    '%s starts every clone at the SAME scale and full tint',
    (_id, brick) => {
      // Uniformity, not literally 1. What an effector needs is a baseline with no hidden per-clone
      // variation in it, so that a scale delta lands equally on every copy and stacking two effectors
      // is predictable. Requiring exactly 1 additionally forbids a layout from having a sane arrival
      // size, which the surface layout must: an instanced mesh draws the same geometry at every clone,
      // so unit-scale studs are the size of the thing they stud and it arrives as a solid ball.
      const clones = layout(brick)
      const first = clones.scale[0]
      expect(first).toBeGreaterThan(0)
      for (let i = 0; i < clones.count * 3; i++) {
        expect(clones.scale[i]).toBeCloseTo(first, 6)
        expect(clones.tint[i]).toBeCloseTo(1, 6)
      }
    },
  )
})

describe('radial cloner', () => {
  it('places every clone on the ring', () => {
    const clones = layout(radialCloner, { count: 12, radius: 10, rise: 0 })
    for (let i = 0; i < clones.count; i++) {
      const o = i * 3
      expect(Math.hypot(clones.position[o], clones.position[o + 2])).toBeCloseTo(10, 5)
    }
  })

  it('does not stack the last clone on the first for a full turn', () => {
    const clones = layout(radialCloner, { count: 8, arc: 360, radius: 10 })
    const first = [clones.position[0], clones.position[2]]
    const lastOffset = (clones.count - 1) * 3
    const last = [clones.position[lastOffset], clones.position[lastOffset + 2]]
    expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeGreaterThan(1)
  })

  it('reaches the end angle on a partial arc', () => {
    // A 180° arc of 3 clones must sit at 0°, 90° and 180° — not at 0°, 60°, 120°.
    const clones = layout(radialCloner, { count: 3, arc: 180, radius: 10, startAngle: 0 })
    expect(clones.position[0]).toBeCloseTo(10, 5)
    expect(clones.position[6]).toBeCloseTo(-10, 5)
  })
})

describe('linear cloner', () => {
  it('centres the array on the object by default', () => {
    const clones = layout(linearCloner, { count: 9, stepZ: 4, centered: true })
    let sum = 0
    for (let i = 0; i < clones.count; i++) sum += clones.position[i * 3 + 2]
    expect(sum).toBeCloseTo(0, 5)
  })

  it('grows in one direction when not centred', () => {
    const clones = layout(linearCloner, { count: 4, stepZ: 4, centered: false })
    expect(clones.position[2]).toBeCloseTo(0, 5)
    expect(clones.position[3 * 3 + 2]).toBeCloseTo(12, 5)
  })
})

describe('grid cloner', () => {
  it('produces one clone per cell', () => {
    const clones = layout(gridCloner, { countX: 3, countY: 2, countZ: 4 })
    expect(clones.count).toBe(24)
  })
})

describe('effectors', () => {
  it.each(EFFECTOR_BRICKS.map((b) => [b.id, b] as const))(
    '%s is inert at its defaults',
    (_id, brick) => {
      // Adding an effector must change nothing until an output is dialled in. Otherwise
      // every effector is a surprise, and stacking two becomes guesswork.
      const clones = layout(radialCloner)
      const before = Float32Array.from(clones.position)
      brick.affect({ params: defaults(brick), clones, time: 3 })
      // Normalise signed zero: adding +0 to -0 gives +0, which is numerically identical
      // and structurally unequal. The invariant is about values, not about bit patterns.
      expect(unsigned(clones.position)).toEqual(unsigned(before))
    },
  )

  it('ramps the step effector from nothing to full', () => {
    const clones = layout(linearCloner, { count: 5, stepZ: 0, centered: false })
    stepEffector.affect({
      params: { ...defaults(stepEffector), posY: 10 },
      clones,
      time: 0,
    })
    expect(clones.position[1]).toBeCloseTo(0, 5)
    expect(clones.position[4 * 3 + 1]).toBeCloseTo(10, 5)
  })

  it('makes the random effector deterministic from its seed', () => {
    const run = (seed: number) => {
      const clones = layout(linearCloner, { count: 16, stepZ: 0 })
      randomEffector.affect({
        params: { ...defaults(randomEffector), seed, posX: 5 },
        clones,
        time: 0,
      })
      return Array.from(clones.position.slice(0, 48))
    }
    expect(run(7)).toEqual(run(7))
    expect(run(7)).not.toEqual(run(8))
  })
})

describe('CloneRuntime', () => {
  const instance = (effectId: string, params: Record<string, ParamValue> = {}): EffectInstance => {
    const brick = EffectRegistry.get(effectId)!
    const base: Record<string, ParamValue> = {}
    for (const d of brick.descriptors) base[d.key] = d.defaultValue
    return {
      id: `i-${effectId}`,
      effectId,
      name: brick.label,
      family: 'instancing',
      params: { ...base, ...params },
      enabled: true,
    }
  }

  it('reports no clones for a stack without a cloner', () => {
    const runtime = new CloneRuntime()
    expect(runtime.resolve([instance('eff-step')], 0, (e) => e.params)).toBe(0)
    expect(hasCloner([instance('eff-step')])).toBe(false)
    expect(hasCloner([instance('cloner-radial')])).toBe(true)
  })

  it('restarts from the layout every frame', () => {
    const runtime = new CloneRuntime()
    const effects = [
      instance('cloner-linear', { count: 6, stepZ: 0, centered: false }),
      instance('eff-step', { posY: 10 }),
    ]

    // A second evaluation with the same inputs must give the same answer. Accumulating
    // instead would double the offset on every tick.
    const capture = new Float32Array(18)
    runtime.resolve(effects, 0, (e) => e.params)
    const first = captureY(runtime, capture)
    runtime.resolve(effects, 0, (e) => e.params)
    const second = captureY(runtime, capture)
    expect(second).toEqual(first)
    expect(first[4 * 3 + 1]).toBeGreaterThan(0)
  })

  it('bounds the whole array, not just the object origin', () => {
    // The regression this guards: without a bounding volume covering every clone, the
    // renderer culls the entire array as soon as the object's own origin leaves the
    // frustum — clones simply stop drawing while plainly on screen.
    const runtime = new CloneRuntime()
    runtime.resolve([instance('cloner-radial', { count: 8, radius: 30 })], 0, (e) => e.params)
    captureY(runtime, new Float32Array(24))

    expect(runtime.bounds.radius).toBeGreaterThan(30)
    expect(runtime.bounds.center.length()).toBeLessThan(1)
  })

  it('ignores a second cloner rather than half-applying it', () => {
    const runtime = new CloneRuntime()
    const single = runtime.resolve(
      [instance('cloner-radial', { count: 5 })],
      0,
      (e) => e.params,
    )
    const doubled = runtime.resolve(
      [instance('cloner-radial', { count: 5 }), instance('cloner-grid')],
      0,
      (e) => e.params,
    )
    expect(doubled).toBe(single)
  })
})

/** Read the Y column out of the runtime through its public write path. */
function captureY(runtime: CloneRuntime, scratch: Float32Array): number[] {
  const fake = {
    count: 0,
    geometry: { boundingSphere: { radius: 1 }, computeBoundingSphere: () => {} },
    instanceMatrix: { needsUpdate: false },
    instanceColor: null,
    boundingSphere: null,
    setMatrixAt: (index: number, matrix: { elements: number[] }) => {
      if (index * 3 + 1 < scratch.length) scratch[index * 3 + 1] = matrix.elements[13]
    },
    setColorAt: () => {},
  }
  runtime.applyTo(fake as unknown as Parameters<CloneRuntime['applyTo']>[0])
  return Array.from(scratch)
}

/** `-0` and `+0` are numerically equal but structurally distinct to a deep-equality
 *  check, and adding zero flips one into the other. Only the values matter here. */
function unsigned(values: Float32Array): number[] {
  return Array.from(values, (v) => (v === 0 ? 0 : v))
}

describe('non-lattice layouts (17-EXPRESSIVE-RANGE Pass 3)', () => {
  it('scatter is deterministic, and its seed actually changes the cloud', () => {
    // A layout using Math.random() would reopen a saved project as a different picture and stop an
    // export matching its preview.
    const a = layout(scatterCloner, { count: 64 })
    const b = layout(scatterCloner, { count: 64 })
    expect(Array.from(a.position)).toEqual(Array.from(b.position))

    const c = layout(scatterCloner, { count: 64, seed: 7 })
    expect(Array.from(c.position)).not.toEqual(Array.from(a.position))
  })

  it('scatter fills its box on every axis and stays inside it', () => {
    const clones = layout(scatterCloner, { count: 400, width: 20, height: 10, depth: 60 })
    const extent = [0, 0, 0]
    for (let i = 0; i < clones.count; i++) {
      const o = i * 3
      for (let axis = 0; axis < 3; axis++) {
        extent[axis] = Math.max(extent[axis], Math.abs(clones.position[o + axis]))
      }
    }
    // Inside the half-extents…
    expect(extent[0]).toBeLessThanOrEqual(10)
    expect(extent[1]).toBeLessThanOrEqual(5)
    expect(extent[2]).toBeLessThanOrEqual(30)
    // …and actually using them, rather than collapsing to a plane or a line.
    expect(extent[0]).toBeGreaterThan(8)
    expect(extent[1]).toBeGreaterThan(4)
    expect(extent[2]).toBeGreaterThan(24)
  })

  it('scatter has no lattice — the whole reason it exists', () => {
    // The tell it removes: on a grid every coordinate is a multiple of the spacing, so the number of
    // distinct values along an axis is tiny however many copies there are.
    const grid = layout(gridCloner, { countX: 8, countY: 8, countZ: 8, spacingX: 8 })
    const gridValues = new Set<number>()
    for (let i = 0; i < grid.count; i++) gridValues.add(Math.round(grid.position[i * 3] * 100))
    expect(gridValues.size).toBe(8)

    const scattered = layout(scatterCloner, { count: 256 })
    const scatterValues = new Set<number>()
    for (let i = 0; i < scattered.count; i++) {
      scatterValues.add(Math.round(scattered.position[i * 3] * 100))
    }
    expect(scatterValues.size).toBeGreaterThan(200)
  })

  it('scatter spherical mode keeps every clone inside the ball', () => {
    const r = 20
    const clones = layout(scatterCloner, {
      count: 300,
      spherical: 1,
      width: r * 2,
      height: r * 2,
      depth: r * 2,
    })
    for (let i = 0; i < clones.count; i++) {
      const o = i * 3
      const length = Math.hypot(clones.position[o], clones.position[o + 1], clones.position[o + 2])
      expect(length).toBeLessThanOrEqual(r + 1e-3)
    }
  })

  it('the surface layout puts every clone on the supplied geometry', () => {
    // Eight vertices of a cube: every clone must land on one of them, not between them.
    const source = new Float32Array([
      1, 1, 1, -1, 1, 1, 1, -1, 1, -1, -1, 1, 1, 1, -1, -1, 1, -1, 1, -1, -1, -1, -1, -1,
    ])
    const clones = buffers()
    surfaceCloner.layout({
      params: { ...defaults(surfaceCloner), count: 8, align: 0 },
      clones,
      sourcePositions: source,
    })

    expect(clones.count).toBe(8)
    for (let i = 0; i < clones.count; i++) {
      const o = i * 3
      const onAVertex = [0, 1, 2, 3, 4, 5, 6, 7].some(
        (v) =>
          Math.abs(clones.position[o] - source[v * 3]) < 1e-6 &&
          Math.abs(clones.position[o + 1] - source[v * 3 + 1]) < 1e-6 &&
          Math.abs(clones.position[o + 2] - source[v * 3 + 2]) < 1e-6,
      )
      expect(onAVertex, `clone ${i}`).toBe(true)
    }
  })

  it('the surface layout survives having no geometry at all', () => {
    // Reachable: a brick that failed to build. It must not produce NaN positions.
    const clones = layout(surfaceCloner, { count: 32 })
    for (let i = 0; i < clones.count * 3; i++) expect(Number.isFinite(clones.position[i])).toBe(true)
  })

  it('the surface layout never asks for more clones than there are vertices', () => {
    // Otherwise the stride wraps and copies stack invisibly on top of each other, which reads as a
    // count control that stops working partway along its range.
    const source = new Float32Array(12 * 3).fill(1)
    const clones = buffers()
    surfaceCloner.layout({
      params: { ...defaults(surfaceCloner), count: 500 },
      clones,
      sourcePositions: source,
    })
    expect(clones.count).toBe(12)
  })
})

describe('flow effector', () => {
  function flow(overrides: Record<string, ParamValue>, count = 200) {
    const clones = layout(scatterCloner, { count })
    const before = Float32Array.from(clones.position)
    flowEffector.affect({
      params: { ...defaults(flowEffector), ...overrides },
      clones,
      time: 0,
    })
    return { clones, before }
  }

  it('moves clones when driven, and identically every time', () => {
    const first = flow({ strength: 10 })
    expect(Array.from(first.clones.position)).not.toEqual(Array.from(first.before))

    const second = flow({ strength: 10 })
    expect(Array.from(second.clones.position)).toEqual(Array.from(first.clones.position))
  })

  it('preserves spread rather than bunching — the reason it is a curl', () => {
    // A plain noise offset pushes clones towards wherever the field happens to point, so the cloud
    // collapses towards blobs and its spread shrinks. A divergence-free field cannot compress. That
    // is the property the maths buys, so it is the property under test.
    const { clones, before } = flow({ strength: 12, scale: 0.05 }, 400)

    const spread = (values: ArrayLike<number>, count: number) => {
      let sum = 0
      let sumSquares = 0
      for (let i = 0; i < count; i++) {
        const v = values[i * 3]
        sum += v
        sumSquares += v * v
      }
      return Math.sqrt(sumSquares / count - (sum / count) ** 2)
    }

    const original = spread(before, clones.count)
    const flowed = spread(clones.position, clones.count)
    expect(flowed).toBeGreaterThan(original * 0.75)
    expect(flowed).toBeLessThan(original * 1.6)
  })

  it('phase travels the field instead of accumulating', () => {
    // Two phases give two pictures, and re-evaluating either reproduces it — so scrubbing backwards is
    // exact and an out-of-order offline render matches the preview (HC-3).
    const a = flow({ strength: 10, phase: 0 })
    const b = flow({ strength: 10, phase: 0.5 })
    expect(Array.from(b.clones.position)).not.toEqual(Array.from(a.clones.position))
    expect(Array.from(flow({ strength: 10, phase: 0.5 }).clones.position)).toEqual(
      Array.from(b.clones.position),
    )
  })

  it('produces no NaN at the extremes of every control', () => {
    const cases: Record<string, ParamValue>[] = [
      { strength: 40, scale: 0.4, phase: 1, swirl: true },
      { strength: -40, scale: 0.005, phase: 0 },
      { strength: 40, scale: 0 },
    ]
    for (const params of cases) {
      const { clones } = flow(params)
      for (let i = 0; i < clones.count * 3; i++) {
        expect(Number.isFinite(clones.position[i]), JSON.stringify(params)).toBe(true)
        expect(Number.isFinite(clones.rotation[i]), JSON.stringify(params)).toBe(true)
      }
    }
  })
})
