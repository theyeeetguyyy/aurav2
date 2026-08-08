import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LightRegistry } from './LightRegistry'
import { LIGHT_BRICKS } from './lights'
import { describeObject, modulationTargets } from '@/engine/params/ParamRegistry'
import { DEFAULT_TRANSFORM, type SceneObject } from '@/types/visual'

/** Invariants the lighting module rests on.
 *
 *  The load-bearing one is that `intensity` is an exposed realtime target on every light.
 *  That single property is what makes strobe-on-hit a wire rather than a feature (D-30):
 *  an onset trigger adds a decaying impulse to any address, so the moment intensity is
 *  addressable, "flash the rim on every snare" is authored, not implemented. */

function lightObject(brickId: string): SceneObject {
  return {
    id: 'l1',
    name: 'Light',
    type: 'light',
    backend: 'mesh',
    brickId,
    transform: {
      position: [...DEFAULT_TRANSFORM.position],
      rotation: [...DEFAULT_TRANSFORM.rotation],
      scale: [...DEFAULT_TRANSFORM.scale],
    },
    params: LightRegistry.defaultParams(brickId),
    materialId: 'mat-standard',
    material: {},
    effects: [],
    visible: true,
    locked: false,
  paletteSlot: null,
  }
}

describe('LightRegistry', () => {
  const bricks = LightRegistry.list()

  it('registers every light under a unique id', () => {
    const ids = bricks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(bricks.length).toBe(LIGHT_BRICKS.length)
  })

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s exposes intensity as a realtime target',
    (_id, brick) => {
      const intensity = brick.descriptors.find((d) => d.key === 'intensity')
      expect(intensity).toBeDefined()
      expect(intensity?.exposed).toBe(true)
      expect(intensity?.realtime).toBe(true)
      // Headroom matters: a trigger that can only add 0.2 produces a nudge, not a flash.
      expect(intensity!.max).toBeGreaterThan(Number(intensity!.defaultValue) * 2)
    },
  )

  it.each(bricks.map((b) => [b.id, b] as const))('%s builds a real THREE light', (_id, brick) => {
    const handle = brick.create()
    try {
      expect(handle.light).toBeInstanceOf(THREE.Light)
      expect(() => handle.update(LightRegistry.defaultParams(brick.id))).not.toThrow()
      // A project saved before a knob existed is missing keys; falling back beats writing
      // NaN into a light, which renders the whole scene black with no error.
      expect(() => handle.update({})).not.toThrow()
    } finally {
      handle.dispose()
    }
  })

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s only offers a shadow toggle if it can actually cast one',
    (_id, brick) => {
      const hasToggle = brick.descriptors.some((d) => d.key === 'shadows')
      expect(hasToggle).toBe(brick.castsShadows)
    },
  )

  it('aims lights that need a target', () => {
    for (const id of ['light-spot', 'light-sun']) {
      const handle = LightRegistry.get(id)!.create()
      try {
        // The target is parented to the light and sits down -Z, so the object's own
        // rotation aims the beam. Without it a spot always points at the world origin.
        expect(handle.target).not.toBeNull()
        expect(handle.target!.parent).toBe(handle.light)
        expect(handle.target!.position.z).toBeLessThan(0)
      } finally {
        handle.dispose()
      }
    }
  })
})

describe('lights in the parameter system', () => {
  it('describes a light as placement plus its own knobs, with no material', () => {
    const descriptors = describeObject(lightObject('light-spot'))
    const keys = descriptors.map((d) => d.key)

    expect(keys).toContain('position.x')
    expect(keys).toContain('rotation.y')
    expect(keys).toContain('intensity')
    expect(keys).toContain('angle')

    // A light has no surface and no size. Offering roughness or scale would be offering
    // controls that do nothing.
    expect(keys.some((k) => k.startsWith('material.'))).toBe(false)
    expect(keys.some((k) => k.startsWith('scale.'))).toBe(false)
  })

  it('makes light intensity routable', () => {
    const targets = modulationTargets(lightObject('light-point')).map((d) => d.key)
    expect(targets).toContain('intensity')
    expect(targets).toContain('position.y')
  })

  it('keeps colour off the routing list', () => {
    // Colour is a real parameter but not a scalar target — routing a stem to it would
    // need a colour-valued Field, which does not exist. Better absent than broken.
    const targets = modulationTargets(lightObject('light-point')).map((d) => d.key)
    expect(targets).not.toContain('color')
  })
})
