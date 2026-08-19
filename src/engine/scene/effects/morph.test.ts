import { describe, expect, it } from 'vitest'
import { morphBrick } from './morph'
import type { DeformContext } from './types'
import { BrickRegistry } from '../BrickRegistry'
import { PROCEDURAL_BRICKS, BASE_VERTEX_COUNT } from '../backends/proceduralMesh'
import { canMorph } from '../backends/types'

const base = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1])
const target = Float32Array.from([3, 0, 0, 0, 3, 0, 0, 0, 3])

function context(amount: number, targetPositions: Float32Array | null = target): DeformContext {
  return {
    positions: Float32Array.from(base),
    base,
    directions: Float32Array.from(base),
    vertexCount: base.length / 3,
    params: { amount },
    targetPositions,
  }
}

describe('morph', () => {
  it('is inert at zero, like every other deformer (D-111)', () => {
    const ctx = context(0)
    morphBrick.apply(ctx)
    expect(Array.from(ctx.positions)).toEqual(Array.from(base))
  })

  it('declares the parameter that gates it', () => {
    expect(morphBrick.driver).toBe('amount')
    const driver = morphBrick.descriptors.find((d) => d.key === morphBrick.driver)
    expect(driver?.defaultValue).toBe(0)
    // Amount is the half that must be drivable; the target is a deliberate edit (D-31).
    expect(driver?.realtime).toBe(true)
  })

  it('arrives exactly on the target at full amount', () => {
    const ctx = context(1)
    morphBrick.apply(ctx)
    expect(Array.from(ctx.positions)).toEqual(Array.from(target))
  })

  it('is a linear blend in between', () => {
    const ctx = context(0.5)
    morphBrick.apply(ctx)
    expect(Array.from(ctx.positions)).toEqual([2, 0, 0, 0, 2, 0, 0, 0, 2])
  })

  it('clamps past full rather than overshooting into nonsense', () => {
    // Reachable: Amount is a modulation target, and modulation is base + Σ offsets, so a strong
    // wire pushes it past 1 constantly.
    const ctx = context(4)
    morphBrick.apply(ctx)
    expect(Array.from(ctx.positions)).toEqual(Array.from(target))
  })

  it('does nothing at all when there is no target to morph towards', () => {
    // A point cloud, a stroke, a primitive — anything outside the shared-topology family. Refusing
    // is the honest answer: there is no vertex correspondence to blend along.
    const ctx = context(1, null)
    morphBrick.apply(ctx)
    expect(Array.from(ctx.positions)).toEqual(Array.from(base))
  })

  it('offers only targets that can actually be morphed into', () => {
    // The UI has claimed "can morph into N other shapes" since Phase 4C. Every option here must be
    // a brick `canMorph` agrees with, or the claim is still false — just in a new place.
    const options = morphBrick.descriptors.find((d) => d.key === 'target')?.options ?? []
    expect(options.length).toBeGreaterThanOrEqual(6)

    const source = BrickRegistry.get(PROCEDURAL_BRICKS[0].id)
    for (const option of options) {
      const brick = BrickRegistry.get(option.value)
      expect(brick, option.value).not.toBeNull()
      expect(canMorph(source, brick), option.value).toBe(true)
    }
  })

  it('every offered target really has the same vertex count', () => {
    // The property the whole feature rests on, asserted here as well as in the topology test —
    // because this is the code that would produce self-intersecting mush if it ever stopped holding.
    const options = morphBrick.descriptors.find((d) => d.key === 'target')?.options ?? []
    for (const option of options) {
      const geometry = BrickRegistry.buildGeometry(option.value, {})
      expect(geometry?.getAttribute('position').count, option.value).toBe(BASE_VERTEX_COUNT)
    }
  })
})
