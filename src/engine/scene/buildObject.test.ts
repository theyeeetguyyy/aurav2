import { describe, expect, it } from 'vitest'
import { buildObject, canRenderAsPoints, uniqueName, withBackend } from './buildObject'
import { isPointMaterial } from './materials/pointMaterials'
import { BrickRegistry } from './BrickRegistry'

describe('buildObject', () => {
  it('gives a mesh brick a surface material and a point brick a point material', () => {
    // Get this wrong either way and the object renders as nothing, which reads as a crash.
    expect(isPointMaterial(buildObject('proc-sphere').materialId)).toBe(false)
    expect(isPointMaterial(buildObject('pts-sphere-surface').materialId)).toBe(true)
  })

  it('takes the backend from the brick', () => {
    expect(buildObject('proc-sphere').backend).toBe('mesh')
    expect(buildObject('pts-sphere-surface').backend).toBe('points')
  })

  it('walks the palette so consecutive shapes are not the same colour', () => {
    const first = buildObject('proc-sphere')
    const second = buildObject('proc-sphere', { siblings: [first] })
    expect(first.paletteSlot).toBe(0)
    expect(second.paletteSlot).toBe(1)
  })

  it('gives a light no palette slot', () => {
    // A light's colour is a lighting decision, not scene identity.
    expect(buildObject('light-spot').paletteSlot).toBeNull()
  })
})

describe('uniqueName', () => {
  it('numbers duplicates and never collides', () => {
    const objects = [buildObject('proc-sphere')]
    expect(uniqueName(objects, 'Sphere')).toBe('Sphere 2')
    expect(uniqueName([], 'Sphere')).toBe('Sphere')
  })
})

describe('canRenderAsPoints', () => {
  it('offers the switch on a mesh and withholds it on a cloud', () => {
    // One-way on purpose: a point buffer has no faces, so drawing it as a mesh joins unrelated
    // scattered vertices into shards.
    expect(canRenderAsPoints(buildObject('proc-sphere'))).toBe(true)
    expect(canRenderAsPoints(buildObject('pts-sphere-surface'))).toBe(false)
  })

  it('withholds it on a light', () => {
    expect(canRenderAsPoints(buildObject('light-spot'))).toBe(false)
  })

  it('offers it on every mesh brick in the library', () => {
    // The claim in the docs is "any geometry becomes a cloud". If a brick is exempt, that is a
    // documented promise the UI silently does not keep.
    for (const brick of BrickRegistry.list().filter((b) => b.backend === 'mesh')) {
      expect(canRenderAsPoints(buildObject(brick.id)), brick.id).toBe(true)
    }
  })
})

describe('withBackend', () => {
  it('swaps to a point material on the way to points, and back again', () => {
    const mesh = buildObject('proc-sphere')
    const points = withBackend(mesh, 'points')
    expect(points.backend).toBe('points')
    expect(isPointMaterial(points.materialId)).toBe(true)

    const back = withBackend(points, 'mesh')
    expect(back.backend).toBe('mesh')
    expect(isPointMaterial(back.materialId)).toBe(false)
  })

  it('leaves an already-compatible material alone', () => {
    // Switching a Fresnel sphere to Fresnel must not reset it to Standard.
    const mesh = { ...buildObject('proc-sphere'), materialId: 'mat-fresnel' }
    expect(withBackend(mesh, 'mesh').materialId).toBe('mat-fresnel')
  })

  it('carries shared material values across the swap', () => {
    const mesh = buildObject('proc-sphere')
    mesh.material = { ...mesh.material, color: '#ff0000' }
    expect(withBackend(mesh, 'points').material.color).toBe('#ff0000')
  })

  it('keeps everything else about the object', () => {
    const mesh = buildObject('proc-sphere')
    const points = withBackend(mesh, 'points')
    expect(points.id).toBe(mesh.id)
    expect(points.brickId).toBe(mesh.brickId)
    expect(points.params).toEqual(mesh.params)
    expect(points.transform).toEqual(mesh.transform)
    expect(points.paletteSlot).toBe(mesh.paletteSlot)
  })
})
