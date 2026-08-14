import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LINE_BRICKS } from './lineCurve'
import { MAX_PATH_POINTS } from './curves'
import { defaultParams } from './types'
import { DeformRuntime } from '../DeformRuntime'
import type { EffectInstance } from '@/types/visual'

function build(id: string, overrides: Record<string, number | boolean> = {}) {
  const brick = LINE_BRICKS.find((b) => b.id === id)!
  const geometry = brick.build({ ...defaultParams(brick), ...overrides })
  const attribute = geometry.getAttribute('position')
  return {
    geometry,
    attribute,
    array: attribute.array as Float32Array,
    index: geometry.getIndex()!,
  }
}

describe('line bricks', () => {
  it('all declare the lines backend and refuse to morph', () => {
    for (const brick of LINE_BRICKS) {
      expect(brick.backend, brick.id).toBe('lines')
      // A stroke has a different vertex count and a different meaning from a surface; offering the
      // morph would promise something the renderer cannot do.
      expect(brick.morphGroup, brick.id).toBeNull()
    }
  })

  it('every brick indexes its segments in pairs, all in range', () => {
    // The whole backend rests on this: `LineSegments` reads the index two at a time, so an odd
    // length draws a corrupted figure and an out-of-range entry reads past the buffer.
    for (const brick of LINE_BRICKS) {
      const { index, attribute } = build(brick.id)
      expect(index.count % 2, brick.id).toBe(0)
      expect(index.count, brick.id).toBeGreaterThan(0)
      for (let i = 0; i < index.count; i++) {
        const value = index.getX(i)
        expect(value, `${brick.id}[${i}]`).toBeGreaterThanOrEqual(0)
        expect(value, `${brick.id}[${i}]`).toBeLessThan(attribute.count)
      }
    }
  })

  it('every brick gets a bounding sphere', () => {
    // Nothing infers one for a hand-built geometry, and without it the figure vanishes as soon as
    // its centre leaves the frustum.
    for (const brick of LINE_BRICKS) {
      const { geometry } = build(brick.id)
      expect(geometry.boundingSphere, brick.id).not.toBeNull()
      expect(geometry.boundingSphere!.radius, brick.id).toBeGreaterThan(0)
    }
  })

  it('produces no NaN, whatever it is handed', () => {
    for (const brick of LINE_BRICKS) {
      // Every slider dragged to zero — reachable, and the flow path divides by a field magnitude.
      const hostile = Object.fromEntries(brick.descriptors.map((d) => [d.key, 0]))
      const geometry = brick.build(hostile)
      const array = geometry.getAttribute('position').array as Float32Array
      for (let i = 0; i < array.length; i++) {
        expect(Number.isFinite(array[i]), `${brick.id}[${i}]`).toBe(true)
      }
    }
  })

  it('is deterministic — the same parameters build the same figure', () => {
    // Scatter comes from a hash of the strand index, never Math.random(). Otherwise a saved project
    // reopens as a different picture and an export stops matching its preview.
    for (const brick of LINE_BRICKS) {
      expect(Array.from(build(brick.id).array), brick.id).toEqual(
        Array.from(build(brick.id).array),
      )
    }
  })

  it('holds the vertex budget however extreme the request', () => {
    // The deformer pass is CPU-side over every vertex every frame, so this is a frame-rate limit
    // rather than a memory one. Strands wins and resolution gives way.
    for (const brick of LINE_BRICKS) {
      const { attribute } = build(brick.id, { strands: 500, segments: 5000, nodes: 100_000 })
      expect(attribute.count, brick.id).toBeLessThanOrEqual(MAX_PATH_POINTS)
      expect(attribute.count, brick.id).toBeGreaterThan(0)
    }
  })
})

describe('paths', () => {
  it('a Lissajous at whole-number ratios closes on itself', () => {
    // The property that makes it read as a standing figure rather than a wandering line.
    const { array, attribute } = build('line-lissajous', { strands: 1, segments: 256 })
    const last = (attribute.count - 1) * 3
    for (let axis = 0; axis < 3; axis++) {
      expect(array[axis]).toBeCloseTo(array[last + axis], 4)
    }
  })

  it('a spiral spans its height and taper closes one end to a point', () => {
    const open = build('line-spiral', { strands: 1, segments: 128, height: 40, taper: 0 })
    const first = open.array[1]
    const last = open.array[(open.attribute.count - 1) * 3 + 1]
    expect(last - first).toBeCloseTo(40, 1)

    // +1 closes the bottom: the first ring is at the axis, the last is at full radius.
    const tapered = build('line-spiral', { strands: 1, segments: 128, radius: 8, taper: 1 })
    const startRadius = Math.hypot(tapered.array[0], tapered.array[2])
    const endOffset = (tapered.attribute.count - 1) * 3
    const endRadius = Math.hypot(tapered.array[endOffset], tapered.array[endOffset + 2])
    expect(startRadius).toBeCloseTo(0, 3)
    expect(endRadius).toBeCloseTo(8, 3)
  })

  it('flow strands are streamlines, not copies of one another', () => {
    // The reason this path exists: it is the one figure in the set with no symmetry, so two strands
    // sharing a shape would mean the field is not being followed.
    const { array } = build('line-flow', { strands: 4, segments: 64 })
    const perStrand = 65 * 3
    let differing = 0
    for (let i = 0; i < perStrand; i++) {
      if (Math.abs(array[i] - array[perStrand + i]) > 1e-4) differing++
    }
    expect(differing).toBeGreaterThan(perStrand / 2)
  })

  it('flow steps a fixed distance regardless of field strength', () => {
    // The field is normalised before stepping. Without that, a strand crawls in weak regions and
    // jumps in strong ones, and the same Step means something different at every Field Scale.
    const step = 0.8
    const { array, attribute } = build('line-flow', { strands: 1, segments: 32, step })
    for (let i = 1; i < attribute.count; i++) {
      const o = i * 3
      const distance = Math.hypot(
        array[o] - array[o - 3],
        array[o + 1] - array[o - 2],
        array[o + 2] - array[o - 1],
      )
      expect(distance).toBeCloseTo(step, 4)
    }
  })

  it('strand spread separates strands rather than stacking them', () => {
    // A bundle where every strand sits on top of the last is one strand that cost twenty times as
    // much to draw — and it looks identical, which is how it would go unnoticed.
    const { array } = build('line-lissajous', { strands: 3, segments: 64, spread: 60 })
    const perStrand = 65 * 3
    expect(Math.abs(array[0] - array[perStrand])).toBeGreaterThan(1e-3)
  })
})

describe('the web', () => {
  it('never exceeds its links-per-node cap', () => {
    // Without the cap, a Link Distance a little past the node spacing produces tens of thousands of
    // links and the figure turns to mush.
    const maxLinks = 3
    const { index, attribute } = build('line-web', {
      nodes: 200,
      radius: 10,
      link: 30,
      maxLinks,
    })
    const degree = new Array(attribute.count).fill(0)
    for (let i = 0; i < index.count; i++) degree[index.getX(i)]++
    for (const d of degree) expect(d).toBeLessThanOrEqual(maxLinks)
  })

  it('hollow puts every node on the shell', () => {
    const radius = 12
    const { array, attribute } = build('line-web', { nodes: 120, radius, hollow: true })
    for (let i = 0; i < attribute.count; i++) {
      const o = i * 3
      expect(Math.hypot(array[o], array[o + 1], array[o + 2])).toBeCloseTo(radius, 3)
    }
  })

  it('links only pairs inside the link distance', () => {
    const link = 5
    const { array, index } = build('line-web', { nodes: 150, radius: 12, link, maxLinks: 6 })
    for (let i = 0; i < index.count; i += 2) {
      const a = index.getX(i) * 3
      const b = index.getX(i + 1) * 3
      const distance = Math.hypot(array[a] - array[b], array[a + 1] - array[b + 1], array[a + 2] - array[b + 2])
      expect(distance).toBeLessThanOrEqual(link + 1e-4)
    }
  })

  it('thins out rather than failing when nothing is in range', () => {
    const { index } = build('line-web', { nodes: 64, radius: 40, link: 0.25 })
    expect(index.count).toBe(0)
  })
})

describe('deformers on a stroke', () => {
  function deform(geometry: THREE.BufferGeometry, effectId: string, params: Record<string, number>) {
    const effect: EffectInstance = {
      id: 'e1',
      effectId,
      name: effectId,
      family: 'geometry',
      params,
      enabled: true,
    }
    return new DeformRuntime().resolve(geometry, [effect], () => params)
  }

  it('displaces a stroke and keeps it connected', () => {
    // The claim the backend is built on: a deformer displaces positions and never touches the index,
    // so fifteen operators arrive with the backend rather than needing stroke-specific versions.
    // Driven off its zero default, because a deformer at rest correctly changes nothing (D-111) —
    // a version of this test that added one at defaults would pass while proving nothing.
    const source = build('line-spiral', { strands: 2, segments: 32 }).geometry
    const before = Float32Array.from(source.getAttribute('position').array as Float32Array)
    const result = deform(source, 'def-twist', { angle: 220, falloff: 1 })

    expect(result.getIndex()!.count).toBe(source.getIndex()!.count)
    expect(result.getAttribute('position').count).toBe(before.length / 3)

    const after = result.getAttribute('position').array as Float32Array
    let moved = 0
    for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 1e-4) moved++
    expect(moved).toBeGreaterThan(before.length / 4)
  })

  it('adds no normal attribute to something that never had one', () => {
    // `computeVertexNormals` on an index of vertex PAIRS reads them as triangles. On a forty-
    // thousand-vertex cloud that is a wasted pass every frame writing an attribute nothing shades
    // from, so the runtime only recomputes normals where there were normals.
    const source = build('line-web', { nodes: 64 }).geometry
    const result = deform(source, 'def-twist', { angle: 90 })
    expect(source.hasAttribute('normal')).toBe(false)
    expect(result.hasAttribute('normal')).toBe(false)
  })
})
