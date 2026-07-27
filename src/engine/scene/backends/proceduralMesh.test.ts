import { describe, expect, it } from 'vitest'
import { BASE_VERTEX_COUNT, PROCEDURAL_BRICKS, PROCEDURAL_MORPH_GROUP } from './proceduralMesh'
import { PRIMITIVE_BRICKS } from './primitiveMesh'
import { canMorph, defaultParams } from './types'

/** The shared-topology invariant (docs/03-ARCHITECTURE.md HC-4).
 *
 *  This is the test the roadmap calls out as most needed. Vertex interpolation only
 *  works when both geometries have the same vertex count AND the same correspondence.
 *  A brick that quietly builds its own mesh will not fail here in an obvious way at
 *  authoring time — it will produce exploding, self-intersecting geometry mid-morph,
 *  much later and far from the cause. */

describe('procedural mesh family', () => {
  it('is the documented icosphere vertex count', () => {
    expect(BASE_VERTEX_COUNT).toBe(642)
  })

  it.each(PROCEDURAL_BRICKS.map((brick) => [brick.id, brick] as const))(
    '%s builds exactly BASE_VERTEX_COUNT vertices at default params',
    (_id, brick) => {
      const geometry = brick.build(defaultParams(brick))
      expect(geometry.getAttribute('position').count).toBe(BASE_VERTEX_COUNT)
    },
  )

  it.each(PROCEDURAL_BRICKS.map((brick) => [brick.id, brick] as const))(
    '%s keeps its vertex count at extreme params',
    (_id, brick) => {
      // Parameters must only displace the shared topology, never re-tessellate it.
      const extremes: Record<string, number> = {}
      for (const descriptor of brick.descriptors) {
        extremes[descriptor.key] = descriptor.max
      }
      const geometry = brick.build(extremes)
      expect(geometry.getAttribute('position').count).toBe(BASE_VERTEX_COUNT)
    },
  )

  it('shares one morph group, so every shape can morph into every other', () => {
    for (const brick of PROCEDURAL_BRICKS) {
      expect(brick.morphGroup).toBe(PROCEDURAL_MORPH_GROUP)
    }

    for (const a of PROCEDURAL_BRICKS) {
      for (const b of PROCEDURAL_BRICKS) {
        expect(canMorph(a, b)).toBe(true)
      }
    }
  })

  it('preserves the base sphere directions for deformers and the morph engine', () => {
    const brick = PROCEDURAL_BRICKS[0]
    const geometry = brick.build(defaultParams(brick))
    const directions = geometry.getAttribute('baseDirection')

    expect(directions).toBeDefined()
    expect(directions.count).toBe(BASE_VERTEX_COUNT)

    // Every stored direction must be a unit vector — deformers push along these.
    for (let i = 0; i < directions.count; i++) {
      const length = Math.hypot(directions.getX(i), directions.getY(i), directions.getZ(i))
      expect(length).toBeCloseTo(1, 5)
    }
  })

  it('produces finite geometry for every brick at default and extreme params', () => {
    for (const brick of PROCEDURAL_BRICKS) {
      const extremes: Record<string, number> = {}
      for (const descriptor of brick.descriptors) extremes[descriptor.key] = descriptor.min

      for (const params of [defaultParams(brick), extremes]) {
        const positions = brick.build(params).getAttribute('position').array
        for (let i = 0; i < positions.length; i++) {
          expect(Number.isFinite(positions[i])).toBe(true)
        }
      }
    }
  })
})

describe('primitive mesh family', () => {
  it('is swap-only — no primitive may claim morph compatibility', () => {
    for (const brick of PRIMITIVE_BRICKS) {
      expect(brick.morphGroup).toBeNull()
      expect(canMorph(brick, brick)).toBe(false)
    }
  })

  it('never cross-morphs with the procedural family', () => {
    for (const primitive of PRIMITIVE_BRICKS) {
      for (const procedural of PROCEDURAL_BRICKS) {
        expect(canMorph(primitive, procedural)).toBe(false)
        expect(canMorph(procedural, primitive)).toBe(false)
      }
    }
  })

  it('builds without throwing at default params', () => {
    for (const brick of PRIMITIVE_BRICKS) {
      const geometry = brick.build(defaultParams(brick))
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
    }
  })
})

describe('brick declarations', () => {
  it('has unique ids across all families', () => {
    const ids = [...PROCEDURAL_BRICKS, ...PRIMITIVE_BRICKS].map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('declares defaults inside their own declared range', () => {
    for (const brick of [...PROCEDURAL_BRICKS, ...PRIMITIVE_BRICKS]) {
      for (const descriptor of brick.descriptors) {
        if (descriptor.type !== 'float' && descriptor.type !== 'int') continue
        const value = descriptor.defaultValue as number
        expect(value, `${brick.id}.${descriptor.key}`).toBeGreaterThanOrEqual(descriptor.min)
        expect(value, `${brick.id}.${descriptor.key}`).toBeLessThanOrEqual(descriptor.max)
      }
    }
  })
})
