import type { SignalChain } from '@/types/modulation'
import { evaluateCurve } from './curve'

/** SignalShaper — one connection's signal chain (Principle 8, Ableton Envelope Follower).
 *
 *      Gain → Curve → Rise/Fall → Min/Max → Weight
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
    // 0 — Input window. Rescales the part of the source's range that actually carries
    //     information onto the full 0–1 the rest of the chain assumes. Gain cannot do
    //     this: it multiplies, so raising it clips the peaks before it lifts the floor.
    const inputMin = chain.inputMin ?? 0
    const inputMax = chain.inputMax ?? 1
    const window = inputMax - inputMin
    const scaled =
      Math.abs(window) < 1e-6 ? 0 : clamp01((input - inputMin) / window)

    // 1 — Gain, then clamp: the follower operates on a normalised signal, so a gain
    //     above 1 means "reach full range sooner", not "exceed full range".
    const gained = clamp01(scaled * chain.gain)

    // 2 — Response curve. Shapes *how* the signal reacts before any smoothing, so a
    //     gate curve genuinely gates rather than gating a smoothed average.
    const curved = chain.curve ? evaluateCurve(chain.curve, gained) : gained

    // 3 — Rise/Fall. Time constants are in milliseconds; a one-pole exponential
    //     reaches ~63% of a step in one constant.
    const tauMs = curved > this.envelope ? chain.rise : chain.fall
    if (tauMs <= 0 || dt <= 0) {
      this.envelope = curved
    } else {
      const coefficient = Math.exp(-dt / (tauMs / 1000))
      this.envelope = curved + (this.envelope - curved) * coefficient
    }

    const shaped = chain.invert ? 1 - this.envelope : this.envelope

    // 4 — Min/Max maps the shaped 0–1 onto an offset range in the TARGET's units.
    const ranged = chain.min + (chain.max - chain.min) * shaped

    // 5 — Weight. The N:1 mix control; the matrix sums weighted contributions.
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
