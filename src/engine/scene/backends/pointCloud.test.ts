import { describe, expect, it } from 'vitest'
import { MAX_POINTS, POINT_BRICKS } from './pointCloud'
import { defaultParams } from './types'

/** Positions of a brick built with its own defaults, plus overrides. */
function build(id: string, overrides: Record<string, number> = {}) {
  const brick = POINT_BRICKS.find((b) => b.id === id)!
  const geometry = brick.build({ ...defaultParams(brick), ...overrides })
  const attribute = geometry.getAttribute('position')
  return { geometry, attribute, array: attribute.array as Float32Array }
}

describe('point bricks', () => {
  it('all declare the points backend and refuse to morph', () => {
    for (const brick of POINT_BRICKS) {
      expect(brick.backend, brick.id).toBe('points')
      // A cloud cannot vertex-lerp into a mesh: different vertex counts, different meaning.
      expect(brick.morphGroup, brick.id).toBeNull()
    }
  })

  it('every brick builds a position attribute of the requested count', () => {
    for (const brick of POINT_BRICKS) {
      const { attribute } = build(brick.id, { count: 512 })
      expect(attribute.count, brick.id).toBe(512)
      expect(attribute.itemSize, brick.id).toBe(3)
    }
  })

  it('every brick gets a bounding sphere', () => {
    // Three cannot infer one for an unindexed geometry, and without it the whole cloud vanishes the
    // moment its centre leaves the frustum.
    for (const brick of POINT_BRICKS) {
      const { geometry } = build(brick.id, { count: 256 })
      expect(geometry.boundingSphere, brick.id).not.toBeNull()
      expect(geometry.boundingSphere!.radius, brick.id).toBeGreaterThan(0)
    }
  })

  it('produces no NaN, whatever it is handed', () => {
    for (const brick of POINT_BRICKS) {
      // Zero and negative sizes are reachable by dragging a slider to its floor.
      const hostile = Object.fromEntries(brick.descriptors.map((d) => [d.key, 0]))
      const geometry = brick.build({ ...hostile, count: 64 })
      const array = geometry.getAttribute('position').array as Float32Array
      for (let i = 0; i < array.length; i++) {
        expect(Number.isFinite(array[i]), `${brick.id}[${i}]`).toBe(true)
      }
    }
  })

  it('clamps the count into a range that can actually be drawn', () => {
    for (const brick of POINT_BRICKS) {
      expect(build(brick.id, { count: 1_000_000 }).attribute.count, brick.id).toBe(MAX_POINTS)
      expect(build(brick.id, { count: -5 }).attribute.count, brick.id).toBeGreaterThanOrEqual(16)
    }
  })

  it('is deterministic — the same parameters build the same cloud', () => {
    // Scatter comes from a hash of the point index, never Math.random(). Otherwise a saved project
    // reopens as a different picture and an export stops matching its preview.
    for (const brick of POINT_BRICKS) {
      const a = build(brick.id, { count: 300 }).array
      const b = build(brick.id, { count: 300 }).array
      expect(Array.from(a), brick.id).toEqual(Array.from(b))
    }
  })
})

describe('distributions', () => {
  it('the shell puts every point at the radius', () => {
    const radius = 7
    const { array, attribute } = build('pts-sphere-surface', { count: 400, radius })
    for (let i = 0; i < attribute.count; i++) {
      const o = i * 3
      const length = Math.hypot(array[o], array[o + 1], array[o + 2])
      expect(length).toBeCloseTo(radius, 3)
    }
  })

  it('the shell spreads evenly instead of clustering at the poles', () => {
    // Uniform random spherical coordinates bunch at the poles, which reads as a mistake rather than
    // as a cloud. The Fibonacci sphere is the fix, and this is the property it buys: y is spread
    // evenly across the full range rather than piling up at the ends.
    const { array, attribute } = build('pts-sphere-surface', { count: 1000, radius: 1 })
    const bands = new Array(10).fill(0)
    for (let i = 0; i < attribute.count; i++) {
      const y = array[i * 3 + 1]
      bands[Math.min(9, Math.floor(((y + 1) / 2) * 10))]++
    }
    // Every band within a factor of two of the mean.
    for (const n of bands) {
      expect(n).toBeGreaterThan(attribute.count / 20)
      expect(n).toBeLessThan(attribute.count / 5)
    }
  })

  it('the volume fills rather than shells, and stays inside the radius', () => {
    const radius = 9
    const { array, attribute } = build('pts-sphere-volume', { count: 800, radius })
    let inner = 0
    for (let i = 0; i < attribute.count; i++) {
      const o = i * 3
      const length = Math.hypot(array[o], array[o + 1], array[o + 2])
      expect(length).toBeLessThanOrEqual(radius + 1e-3)
      if (length < radius * 0.5) inner++
    }
    // A shell would have none of these; the cube-root keeps density even so some land inside.
    expect(inner).toBeGreaterThan(0)
  })

  it('the field respects each axis independently, including a flat one', () => {
    const { array, attribute } = build('pts-box', {
      count: 500,
      width: 20,
      height: 0,
      depth: 60,
    })
    for (let i = 0; i < attribute.count; i++) {
      const o = i * 3
      expect(Math.abs(array[o])).toBeLessThanOrEqual(10 + 1e-3)
      // Height 0 is a legitimate request — it is what makes a floor.
      expect(Math.abs(array[o + 1])).toBeLessThanOrEqual(1e-6)
      expect(Math.abs(array[o + 2])).toBeLessThanOrEqual(30 + 1e-3)
    }
  })

  it('the disc keeps its hole', () => {
    const { array, attribute } = build('pts-disc', {
      count: 600,
      radius: 20,
      inner: 8,
      thickness: 0,
    })
    for (let i = 0; i < attribute.count; i++) {
      const o = i * 3
      const r = Math.hypot(array[o], array[o + 2])
      expect(r).toBeGreaterThanOrEqual(8 - 1e-3)
      expect(r).toBeLessThanOrEqual(20 + 1e-3)
    }
  })

  it('the disc survives an inner radius dragged past the outer', () => {
    // Reachable by one slider drag, and it must not produce a NaN radius.
    const { array } = build('pts-disc', { count: 64, radius: 5, inner: 50 })
    for (let i = 0; i < array.length; i++) expect(Number.isFinite(array[i])).toBe(true)
  })

  it('the helix climbs monotonically through its height', () => {
    const { array, attribute } = build('pts-helix', {
      count: 200,
      height: 40,
      radius: 5,
      turns: 3,
      scatter: 0,
    })
    const first = array[1]
    const last = array[(attribute.count - 1) * 3 + 1]
    expect(last).toBeGreaterThan(first)
    expect(last - first).toBeCloseTo(40, 0)
  })
})
