import { describe, expect, it } from 'vitest'
import { CLONER_BRICKS, radialCloner, linearCloner, gridCloner } from './cloners'
import { EFFECTOR_BRICKS, randomEffector, stepEffector } from './effectors'
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
    '%s starts every clone at unit scale and full tint',
    (_id, brick) => {
      const clones = layout(brick)
      for (let i = 0; i < clones.count * 3; i++) {
        expect(clones.scale[i]).toBeCloseTo(1, 6)
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
