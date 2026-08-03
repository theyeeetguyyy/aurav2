import { describe, expect, it } from 'vitest'
import {
  BEHAVIOUR_BRICKS,
  behaviourDefaults,
  emptyRig,
  getBehaviour,
  orbitBehaviour,
  resetRig,
  shakeBehaviour,
  type CameraRig,
} from './behaviours'

/** Camera behaviours must be pure functions of time.
 *
 *  This is the invariant that lets the Scene Camera move at all under HC-3: the exporter
 *  renders frame 5000 before frame 12, and scrubbing backwards has to reproduce exactly.
 *  A behaviour that eased toward its previous value — the obvious way to write shake —
 *  would make the camera depend on how long playback had been running. */

function run(brickId: string, time: number, overrides: Record<string, number> = {}): CameraRig {
  const brick = getBehaviour(brickId)!
  const rig = emptyRig()
  brick.apply({ time, params: { ...behaviourDefaults(brickId), ...overrides }, rig })
  return rig
}

describe('camera behaviours', () => {
  it('registers every brick under a unique id', () => {
    const ids = BEHAVIOUR_BRICKS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(getBehaviour(id)).not.toBeNull()
  })

  it.each(BEHAVIOUR_BRICKS.map((b) => [b.id, b] as const))(
    '%s is a pure function of time',
    (id) => {
      // Out of order on purpose: this is what the exporter does.
      const first = run(id, 3.25)
      run(id, 91.5)
      const again = run(id, 3.25)
      expect(again).toEqual(first)
    },
  )

  it.each(BEHAVIOUR_BRICKS.map((b) => [b.id, b] as const))(
    '%s exposes at least one drivable parameter',
    (_id, brick) => {
      // Amplitudes have to be modulation targets — "shake rises with the drop" is the
      // whole reason these exist rather than being a checkbox.
      expect(brick.descriptors.some((d) => d.exposed && d.realtime)).toBe(true)
    },
  )

  it.each(BEHAVIOUR_BRICKS.map((b) => [b.id, b] as const))(
    '%s survives missing parameters',
    (_id, brick) => {
      const rig = emptyRig()
      expect(() => brick.apply({ time: 5, params: {}, rig })).not.toThrow()
      for (const value of Object.values(rig)) expect(Number.isFinite(value)).toBe(true)
    },
  )

  it('leaves the rig untouched when shake has no amplitude', () => {
    const rig = run('cam-shake', 12, { amplitude: 0, roll: 0 })
    expect(rig.offsetX).toBe(0)
    expect(rig.offsetY).toBe(0)
    expect(rig.roll).toBe(0)
  })

  it('decorrelates shake axes', () => {
    // One noise stream reused across axes reads as a slide along a diagonal rather than
    // as a handheld operator.
    const rig = run('cam-shake', 4.2, { amplitude: 1 })
    expect(rig.offsetX).not.toBeCloseTo(rig.offsetY, 4)
  })

  it('advances orbit monotonically with time at a fixed speed', () => {
    const a = run('cam-orbit', 0, { speed: 60 })
    const b = run('cam-orbit', 0.5, { speed: 60 })
    // 60 rpm is one revolution per second, so half a second is half a turn.
    expect(b.azimuth - a.azimuth).toBeCloseTo(Math.PI, 5)
  })

  it('accumulates across a stack rather than overwriting', () => {
    const rig = emptyRig()
    const ctx = { time: 2, params: behaviourDefaults('cam-orbit'), rig }
    orbitBehaviour.apply(ctx)
    const afterOrbit = rig.azimuth

    shakeBehaviour.apply({ time: 2, params: behaviourDefaults('cam-shake'), rig })
    // Shake must not have cleared orbit's contribution — behaviours sum, which is what
    // makes the order they are declared in cosmetic.
    expect(rig.azimuth).toBe(afterOrbit)
    expect(rig.offsetX).not.toBe(0)
  })

  it('resets a rig completely', () => {
    const rig = run('cam-shake', 9, { amplitude: 3 })
    resetRig(rig)
    expect(rig).toEqual(emptyRig())
  })
})
