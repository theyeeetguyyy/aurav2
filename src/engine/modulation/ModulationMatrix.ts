import type { Clock } from '@/engine/time/Clock'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import type { EventTrigger, ModulationConnection } from '@/types/modulation'
import { formatAddress, type ParamAddress } from '@/types/params'
import { SignalShaper } from './SignalShaper'
import { evaluateField, type FieldContext } from './fields'

/** ModulationMatrix — the architectural core of the product
 *  (docs/04-ENGINE-SPECS.md §4.2).
 *
 *      final = base + Σᵢ weightᵢ · shapedᵢ( field(sourceᵢ, t) )
 *
 *  Weighted N:1 is the headline mechanic: many Fields summing onto one parameter, so
 *  "50% guns + 25% drums + 25% atmosphere drives this" is a routing table, not a
 *  special case.
 *
 *  Evaluated once per frame into a plain Map of address → offset. Consumers read it
 *  imperatively inside useFrame and write straight to Three.js objects. Nothing here
 *  touches React state (HC-1) — this runs 60 times a second.
 *
 *  Connections and triggers are passed in rather than read from a store: `engine/` may
 *  not import a store, and the offline exporter needs to drive this with its own state. */

/** A clock jump larger than this is a seek, a loop wrap, or an export start —
 *  not continuous playback. Envelopes reset so the next frame is correct rather than
 *  ramping from wherever playback happened to stop. */
const JUMP_THRESHOLD_SECONDS = 0.25

class ModulationMatrixImpl {
  /** Continuous offsets by serialised address, rebuilt each frame. */
  private readonly offsets = new Map<string, number>()
  /** One stateful follower per connection. */
  private readonly shapers = new Map<string, SignalShaper>()
  private lastTime = 0

  /** Evaluate every enabled connection and trigger at `clock.time`. */
  evaluate(
    clock: Clock,
    connections: readonly ModulationConnection[],
    triggers: readonly EventTrigger[],
    host: Pick<FieldContext, 'isTrackActive' | 'getGenerator' | 'getLane'>,
  ): void {
    const time = clock.time
    let dt = time - this.lastTime

    // A backwards or large jump is a seek, not playback. Snapping envelopes keeps the
    // first frame after a scrub correct instead of ramping in from stale state — which
    // is also what keeps preview and export agreeing (HC-3).
    if (dt < 0 || dt > JUMP_THRESHOLD_SECONDS) {
      this.resetEnvelopes()
      dt = 0
    }
    this.lastTime = time

    this.offsets.clear()
    const ctx: FieldContext = { time, ...host }

    for (const connection of connections) {
      if (!connection.enabled) continue

      const raw = evaluateField(connection.source, ctx)

      let shaper = this.shapers.get(connection.id)
      if (!shaper) {
        shaper = new SignalShaper()
        this.shapers.set(connection.id, shaper)
      }

      const contribution = shaper.process(raw, connection.chain, dt)
      const key = formatAddress(connection.target)
      this.offsets.set(key, (this.offsets.get(key) ?? 0) + contribution)
    }

    for (const trigger of triggers) {
      if (!trigger.enabled || !trigger.source.sourceId) continue
      if (!host.isTrackActive(trigger.source.sourceId)) continue

      const last = AudioFeatures.lastOnsetAtOrBefore(trigger.source.sourceId, time)
      if (last === null) continue

      // Pure function of time: derived from the AGE of the last hit, never accumulated.
      // Scrubbing backwards gives the same answer as playing forwards.
      const age = time - last
      const impulse = trigger.amount * Math.exp(-age / Math.max(0.001, trigger.decay))
      if (impulse < 1e-4) continue

      const key = formatAddress(trigger.target)
      this.offsets.set(key, (this.offsets.get(key) ?? 0) + impulse)
    }
  }

  /** Modulation offset for an address, or 0 when nothing drives it. */
  getOffset(addressKey: string): number {
    return this.offsets.get(addressKey) ?? 0
  }

  isDriven(addressKey: string): boolean {
    return this.offsets.has(addressKey)
  }

  /** Base value plus modulation, clamped. */
  apply(addressKey: string, base: number, min: number, max: number): number {
    const value = base + (this.offsets.get(addressKey) ?? 0)
    return value < min ? min : value > max ? max : value
  }

  drivenAddresses(): string[] {
    return [...this.offsets.keys()]
  }

  /** Drop a connection's follower state, so a later connection reusing the id does not
   *  inherit a stale envelope. */
  releaseConnection(connectionId: string): void {
    this.shapers.delete(connectionId)
  }

  /** Snap all followers. Called on clock jumps and before an export run. */
  resetEnvelopes(): void {
    for (const shaper of this.shapers.values()) shaper.reset()
  }

  reset(): void {
    this.offsets.clear()
    this.shapers.clear()
    this.lastTime = 0
  }
}

export const ModulationMatrix = new ModulationMatrixImpl()

/** Serialise an address once, outside the frame loop. Address keys are read on every
 *  frame for every driven parameter; rebuilding the string each time is pure waste. */
export function addressKey(objectId: string, paramKey: string, effectId?: string): string {
  const address: ParamAddress = effectId ? { objectId, effectId, paramKey } : { objectId, paramKey }
  return formatAddress(address)
}
