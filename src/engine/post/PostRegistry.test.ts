import { describe, expect, it } from 'vitest'
import { Effect, Pass } from 'postprocessing'
import { PostRegistry } from './PostRegistry'
import { POST_GROUPS, type PostContext } from './types'
import { formatAddress, parseAddress } from '@/types/params'
import { POST_STACK_ID } from '@/types/visual'
import { grainBrick } from './bricks/shaders'

/** Structural invariants for the post catalogue.
 *
 *  The same job `proceduralMesh.test.ts` does for geometry: none of this checks how an
 *  effect LOOKS, it checks the properties every consumer downstream assumes. A brick that
 *  declares a range it cannot honour, or a knob nothing can wire to, is broken in a way
 *  that only shows up as a dead slider three screens away. */

const CONTEXT: PostContext = { time: 0, dt: 1 / 60, width: 1920, height: 1080 }

describe('PostRegistry', () => {
  const bricks = PostRegistry.list()

  it('registers every brick under a unique id', () => {
    const ids = bricks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(bricks.length).toBeGreaterThan(0)
  })

  it('assigns every brick to a known group', () => {
    for (const brick of bricks) {
      expect(POST_GROUPS).toContain(brick.group)
    }
  })

  it('groups the whole catalogue with nothing left out', () => {
    const grouped = PostRegistry.listByGroup().flatMap((entry) => entry.bricks)
    expect(grouped).toHaveLength(bricks.length)
  })

  it.each(bricks.map((b) => [b.id, b] as const))('%s declares coherent descriptors', (_id, brick) => {
    expect(brick.descriptors.length).toBeGreaterThan(0)

    for (const descriptor of brick.descriptors) {
      expect(descriptor.min).toBeLessThan(descriptor.max)
      expect(descriptor.step).toBeGreaterThan(0)

      if (descriptor.type === 'float' || descriptor.type === 'int') {
        const value = Number(descriptor.defaultValue)
        expect(value).toBeGreaterThanOrEqual(descriptor.min)
        expect(value).toBeLessThanOrEqual(descriptor.max)
      }

      if (descriptor.type === 'enum') {
        expect(descriptor.options?.length ?? 0).toBeGreaterThan(0)
        expect(descriptor.options?.map((o) => o.value)).toContain(String(descriptor.defaultValue))
      }
    }
  })

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s exposes at least one parameter that can be driven',
    (_id, brick) => {
      // A post effect nothing can be wired to is a preset, not an instrument. The whole
      // reason the stack lives inside the parameter system is that every knob is a target.
      expect(brick.descriptors.some((d) => d.exposed && d.realtime)).toBe(true)
    },
  )

  it.each(bricks.map((b) => [b.id, b] as const))(
    '%s builds a composer node and survives an update at defaults',
    (_id, brick) => {
      const handle = brick.create()
      try {
        expect(handle.node instanceof Effect || handle.node instanceof Pass).toBe(true)
        expect(() => handle.update(PostRegistry.defaultParams(brick.id), CONTEXT)).not.toThrow()
        // Missing parameters must fall back rather than write NaN into a uniform — a
        // project saved before a brick gained a knob would otherwise render black.
        expect(() => handle.update({}, CONTEXT)).not.toThrow()
      } finally {
        handle.dispose()
      }
    },
  )

  it('declares convolution effects as standalone', () => {
    // postprocessing refuses to merge a convolution into a shared EffectPass. If a brick
    // reads the input buffer away from its own pixel and forgets to say so, the composer
    // throws at build time — in the browser, on the user's click.
    const convolutions = bricks.filter((b) => b.standalone)
    expect(convolutions.map((b) => b.id)).toContain('post-zoom-blur')
  })
})

describe('post addressing', () => {
  it('round-trips a post parameter address', () => {
    const address = { objectId: POST_STACK_ID, effectId: 'fx-1', paramKey: 'intensity' }
    expect(parseAddress(formatAddress(address))).toEqual(address)
  })

  it('cannot collide with a scene object address', () => {
    // Object ids come from crypto.randomUUID(); the reserved id starts with '@' so it can
    // never be generated.
    expect(POST_STACK_ID.startsWith('@')).toBe(true)
  })
})

describe('film grain determinism', () => {
  it('derives its seed from the clock, not from a frame counter', () => {
    const handle = grainBrick.create()
    const params = PostRegistry.defaultParams('post-grain')
    const seed = () => (handle.node as Effect).uniforms.get('seed')?.value as number

    try {
      handle.update(params, { ...CONTEXT, time: 2 })
      const atTwoSeconds = seed()

      // Render a different moment, then come back. An accumulator would have advanced;
      // a pure function of time gives the same answer (HC-2/HC-3).
      handle.update(params, { ...CONTEXT, time: 90 })
      expect(seed()).not.toBe(atTwoSeconds)

      handle.update(params, { ...CONTEXT, time: 2 })
      expect(seed()).toBe(atTwoSeconds)
    } finally {
      handle.dispose()
    }
  })
})
