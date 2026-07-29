import { describe, expect, it } from 'vitest'
import { SignalShaper } from './SignalShaper'
import { DEFAULT_SIGNAL_CHAIN } from '@/types/modulation'
import type { SignalChain } from '@/types/modulation'

const chain = (patch: Partial<SignalChain> = {}): SignalChain => ({
  ...DEFAULT_SIGNAL_CHAIN,
  ...patch,
})

/** The chain order is Gain → Rise/Fall → Min/Max → Weight (Principle 8).
 *  Each stage is tested in isolation by neutralising the others. */
describe('SignalShaper chain', () => {
  const instant = { rise: 0, fall: 0 }

  it('passes a signal through unchanged at unity settings', () => {
    const shaper = new SignalShaper()
    expect(shaper.process(0.5, chain({ ...instant }), 0.016)).toBeCloseTo(0.5, 6)
  })

  it('applies gain before shaping, and clamps at full scale', () => {
    const shaper = new SignalShaper()
    expect(shaper.process(0.25, chain({ ...instant, gain: 2 }), 0.016)).toBeCloseTo(0.5, 6)

    // Gain means "reach full range sooner", not "exceed full range".
    const hot = new SignalShaper()
    expect(hot.process(0.8, chain({ ...instant, gain: 4 }), 0.016)).toBeCloseTo(1, 6)
  })

  it('maps the shaped signal onto the min/max offset range', () => {
    const shaper = new SignalShaper()
    expect(shaper.process(0.5, chain({ ...instant, min: 2, max: 4 }), 0.016)).toBeCloseTo(3, 6)
  })

  it('scales the final contribution by weight', () => {
    const shaper = new SignalShaper()
    expect(shaper.process(1, chain({ ...instant, weight: 0.25 }), 0.016)).toBeCloseTo(0.25, 6)
  })

  it('inverts before ranging, not after', () => {
    const shaper = new SignalShaper()
    // invert flips the 0–1 signal, so 0.25 becomes 0.75 and then maps into [0, 4].
    expect(shaper.process(0.25, chain({ ...instant, invert: true, max: 4 }), 0.016)).toBeCloseTo(3, 6)
  })
})

describe('SignalShaper envelope', () => {
  it('rises toward a step rather than jumping to it', () => {
    const shaper = new SignalShaper()
    const c = chain({ rise: 100, fall: 100 })

    const first = shaper.process(1, c, 0.016)
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(1)

    // One time constant of total elapsed time gets ~63% of the way there.
    let value = first
    for (let i = 1; i < 6; i++) value = shaper.process(1, c, 0.016)
    expect(value).toBeGreaterThan(0.55)
    expect(value).toBeLessThan(0.72)
  })

  it('uses rise on the way up and fall on the way down', () => {
    // Asymmetry is the point: fast attack so a hit lands, slow release so it settles
    // instead of chattering.
    const fastAttack = new SignalShaper()
    const c = chain({ rise: 1, fall: 1000 })

    fastAttack.process(1, c, 0.016)
    expect(fastAttack.value).toBeGreaterThan(0.99)

    fastAttack.process(0, c, 0.016)
    expect(fastAttack.value).toBeGreaterThan(0.98)
  })

  it('snaps instantly when a time constant is zero', () => {
    const shaper = new SignalShaper()
    shaper.process(1, chain({ rise: 0, fall: 0 }), 0.016)
    expect(shaper.value).toBe(1)
  })

  it('reset() clears follower memory so a seek does not ramp from stale state', () => {
    const shaper = new SignalShaper()
    const c = chain({ rise: 500, fall: 500 })

    for (let i = 0; i < 30; i++) shaper.process(1, c, 0.016)
    expect(shaper.value).toBeGreaterThan(0.5)

    shaper.reset()
    expect(shaper.value).toBe(0)
  })

  it('treats dt <= 0 as an instant update, so a paused frame cannot stall the envelope', () => {
    const shaper = new SignalShaper()
    expect(shaper.process(0.7, chain({ rise: 500, fall: 500 }), 0)).toBeCloseTo(0.7, 6)
  })
})
