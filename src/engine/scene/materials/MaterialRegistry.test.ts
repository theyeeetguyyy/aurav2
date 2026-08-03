import { describe, expect, it } from 'vitest'
import { DEFAULT_MATERIAL_ID, MaterialRegistry } from './MaterialRegistry'
import { materialKey } from './types'

/** Invariants every consumer of a material brick assumes.
 *
 *  The load-bearing one is the prefix contract: descriptors are addressed as
 *  `material.<key>` so routing and serialisation are unchanged, while values are stored
 *  unprefixed because that is the split `writeParam` has always used. Get that wrong in
 *  one brick and its knobs silently stop responding — the parameter writes to
 *  `material['material.roughness']` and the renderer reads `material.roughness`. */

describe('MaterialRegistry', () => {
  const bricks = MaterialRegistry.list()

  it('registers the default model', () => {
    expect(MaterialRegistry.get(DEFAULT_MATERIAL_ID)).not.toBeNull()
    expect(bricks.length).toBeGreaterThan(1)
  })

  it('registers every brick under a unique id', () => {
    const ids = bricks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s prefixes every descriptor key with "material."',
    (_id, brick) => {
      for (const descriptor of brick.descriptors) {
        expect(descriptor.key.startsWith('material.')).toBe(true)
        expect(descriptor.group).toBe('Material')
      }
    },
  )

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s stores defaults under unprefixed keys',
    (_id, brick) => {
      const defaults = MaterialRegistry.defaultParams(brick.id)
      for (const descriptor of brick.descriptors) {
        expect(defaults).toHaveProperty(materialKey(descriptor.key))
      }
    },
  )

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s builds a material and accepts its own defaults',
    (_id, brick) => {
      const handle = brick.create()
      try {
        expect(handle.material).toBeDefined()
        expect(() => handle.update(MaterialRegistry.defaultParams(brick.id))).not.toThrow()
        // A project saved against an older version of the brick is missing keys; the
        // material must fall back rather than write undefined into a uniform.
        expect(() => handle.update({})).not.toThrow()
      } finally {
        handle.dispose()
      }
    },
  )

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s exposes at least one parameter that can be driven',
    (_id, brick) => {
      expect(brick.descriptors.some((d) => d.exposed && d.realtime)).toBe(true)
    },
  )

  it('carries shared values across a model swap', () => {
    const from = MaterialRegistry.defaultParams('mat-standard')
    from.opacity = 0.42

    const to = MaterialRegistry.migrateParams('mat-physical', from)
    // Opacity exists on both, so a dialled-in value survives curiosity about clearcoat.
    expect(to.opacity).toBe(0.42)
    // Clearcoat exists only on the destination, so it arrives at its own default.
    expect(to.clearcoat).toBe(0.6)
  })

  it('falls back to the default model for an unknown id', () => {
    expect(Object.keys(MaterialRegistry.defaultParams('mat-nonexistent')).length).toBeGreaterThan(0)
  })
})
