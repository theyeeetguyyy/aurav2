import type { SignalChain } from '@/types/modulation'

/** SignalShaper — one connection's signal chain (Principle 8, Ableton Envelope Follower).
 *
 *      Gain → Rise/Fall → Min/Max → Weight
 *
 *  Rise/Fall is the part people skip and the part that matters. Mapping raw audio
 *  straight onto a parameter produces jitter: the value chatters at frame rate and
 *  reads as noise rather than as a decision. An asymmetric follower — fast attack, slow
 *  release — is what makes a visual *hit* on the transient and *settle* afterwards.
 *
 *  Stateful by nature: the follower has memory. That memory must be reset whenever the
 *  clock jumps (seek, loop wrap, export start), or a scrub leaves stale envelope state
 *  and preview stops matching export. ModulationMatrix owns that reset. */
export class SignalShaper {
  /** Current follower output, 0–1 before ranging. */
  private envelope = 0

  /** Process one frame. `dt` is seconds since the previous evaluation. */
  process(input: number, chain: SignalChain, dt: number): number {
    // 1 — Gain, then clamp: the follower operates on a normalised signal, so a gain
    //     above 1 means "reach full range sooner", not "exceed full range".
    const gained = clamp01(input * chain.gain)

    // 2 — Rise/Fall. Time constants are in milliseconds; a one-pole exponential
    //     reaches ~63% of a step in one constant.
    const tauMs = gained > this.envelope ? chain.rise : chain.fall
    if (tauMs <= 0 || dt <= 0) {
      this.envelope = gained
    } else {
      const coefficient = Math.exp(-dt / (tauMs / 1000))
      this.envelope = gained + (this.envelope - gained) * coefficient
    }

    const shaped = chain.invert ? 1 - this.envelope : this.envelope

    // 3 — Min/Max maps the shaped 0–1 onto an offset range in the TARGET's units.
    const ranged = chain.min + (chain.max - chain.min) * shaped

    // 4 — Weight. The N:1 mix control; the matrix sums weighted contributions.
    return ranged * chain.weight
  }

  /** Snap the follower to a value without smoothing. Used on clock jumps so the first
   *  frame after a seek is correct rather than ramping from wherever playback stopped. */
  reset(to = 0): void {
    this.envelope = to
  }

  get value(): number {
    return this.envelope
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
