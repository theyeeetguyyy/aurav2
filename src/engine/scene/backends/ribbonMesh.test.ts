import { describe, expect, it } from 'vitest'
import { RIBBON_BRICKS } from './ribbonMesh'
import { defaultParams } from './types'

function build(id: string, overrides: Record<string, number> = {}) {
  const brick = RIBBON_BRICKS.find((b) => b.id === id)!
  const geometry = brick.build({ ...defaultParams(brick), ...overrides })
  const attribute = geometry.getAttribute('position')
  return {
    geometry,
    attribute,
    array: attribute.array as Float32Array,
    index: geometry.getIndex()!,
  }
}

describe('ribbon bricks', () => {
  it('are ordinary meshes, so everything the mesh backend has applies', () => {
    // The entire reason a ribbon is a swept mesh rather than a thick line: seven materials, shadows,
    // reflections and cloners arrive with it and need no ribbon-specific version.
    for (const brick of RIBBON_BRICKS) {
      expect(brick.backend, brick.id).toBe('mesh')
      // Its topology is its own; there is no shared vertex count to lerp against.
      expect(brick.morphGroup, brick.id).toBeNull()
    }
  })

  it('builds whole triangles, all in range', () => {
    for (const brick of RIBBON_BRICKS) {
      const { index, attribute } = build(brick.id)
      expect(index.count % 3, brick.id).toBe(0)
      expect(index.count, brick.id).toBeGreaterThan(0)
      for (let i = 0; i < index.count; i++) {
        const value = index.getX(i)
        expect(value, `${brick.id}[${i}]`).toBeGreaterThanOrEqual(0)
        expect(value, `${brick.id}[${i}]`).toBeLessThan(attribute.count)
      }
    }
  })

  it('carries the normals and UVs a lit material needs', () => {
    // A swept mesh with no normals renders black under every shading model, which reads as the
    // object having failed to arrive rather than as a missing attribute.
    for (const brick of RIBBON_BRICKS) {
      const { geometry } = build(brick.id)
      expect(geometry.hasAttribute('normal'), brick.id).toBe(true)
      expect(geometry.hasAttribute('uv'), brick.id).toBe(true)

      const normals = geometry.getAttribute('normal').array as Float32Array
      for (let i = 0; i < normals.length; i++) {
        expect(Number.isFinite(normals[i]), `${brick.id} normal[${i}]`).toBe(true)
      }
    }
  })

  it('produces no NaN, whatever it is handed', () => {
    for (const brick of RIBBON_BRICKS) {
      const hostile = Object.fromEntries(brick.descriptors.map((d) => [d.key, 0]))
      const geometry = brick.build(hostile)
      const array = geometry.getAttribute('position').array as Float32Array
      for (let i = 0; i < array.length; i++) {
        expect(Number.isFinite(array[i]), `${brick.id}[${i}]`).toBe(true)
      }
    }
  })

  it('holds the vertex budget however extreme the request', () => {
    // A ribbon costs `sides` vertices per sample where a stroke costs one, so the same figure is an
    // order of magnitude heavier and the budget has to account for the section.
    for (const brick of RIBBON_BRICKS) {
      const { attribute } = build(brick.id, { strands: 200, segments: 2000, sides: 16 })
      expect(attribute.count, brick.id).toBeLessThanOrEqual(30_000)
      expect(attribute.count, brick.id).toBeGreaterThan(0)
    }
  })

  it('is deterministic — the same parameters build the same mesh', () => {
    for (const brick of RIBBON_BRICKS) {
      expect(Array.from(build(brick.id).array), brick.id).toEqual(Array.from(build(brick.id).array))
    }
  })
})

describe('the section', () => {
  it('flatten squashes one axis of the section and leaves the other', () => {
    // The one control that decides whether this reads as a cable or as a ribbon. A version that
    // scaled both axes would just be a thinner tube, which is what Thickness already is.
    const straight = { strands: 1, segments: 8, turns: 0, height: 20, radius: 0, twist: 0, sides: 8 }
    const round = build('geo-ribbon-spiral', { ...straight, thickness: 1, flatten: 1 })
    const flat = build('geo-ribbon-spiral', { ...straight, thickness: 1, flatten: 0.1 })

    const spread = (array: Float32Array, axis: number) => {
      let min = Infinity
      let max = -Infinity
      for (let i = axis; i < array.length; i += 3) {
        min = Math.min(min, array[i])
        max = Math.max(max, array[i])
      }
      return max - min
    }

    // A path straight up Y, so the section lies in XZ. One axis keeps its width, the other loses it.
    const roundX = spread(round.array, 0)
    const flatX = spread(flat.array, 0)
    const roundZ = spread(round.array, 2)
    const flatZ = spread(flat.array, 2)

    expect(Math.min(flatX, flatZ)).toBeLessThan(Math.min(roundX, roundZ) * 0.5)
    expect(Math.max(flatX, flatZ)).toBeCloseTo(Math.max(roundX, roundZ), 3)
  })

  it('twist rotates the section along the path', () => {
    const base = { strands: 1, segments: 24, thickness: 1, flatten: 0.1, sides: 4 }
    const straight = build('geo-ribbon-spiral', { ...base, twist: 0 }).array
    const twisted = build('geo-ribbon-spiral', { ...base, twist: 3 }).array

    let differing = 0
    for (let i = 0; i < straight.length; i++) {
      if (Math.abs(straight[i] - twisted[i]) > 1e-3) differing++
    }
    expect(differing).toBeGreaterThan(straight.length / 4)
  })

  it('keeps the band flat along a straight run', () => {
    // Parallel transport rather than Frenet frames. A Frenet normal is undefined where a path is
    // momentarily straight and flips through an inflection, which shows up as a band that snaps
    // 180° mid-stroke — visible on exactly the straight sections this asserts about.
    const { array, attribute } = build('geo-ribbon-spiral', {
      strands: 1,
      segments: 16,
      turns: 0,
      height: 20,
      radius: 0,
      twist: 0,
      sides: 4,
      thickness: 1,
      flatten: 0.05,
    })

    // Every ring must present the same section orientation: vertex j of each ring sits at the same
    // offset from its ring centre.
    const sides = 4
    const rings = attribute.count / sides
    for (let j = 0; j < sides; j++) {
      const first = [array[j * 3], array[j * 3 + 2]]
      for (let i = 1; i < rings; i++) {
        const o = (i * sides + j) * 3
        expect(array[o]).toBeCloseTo(first[0], 4)
        expect(array[o + 2]).toBeCloseTo(first[1], 4)
      }
    }
  })
})
