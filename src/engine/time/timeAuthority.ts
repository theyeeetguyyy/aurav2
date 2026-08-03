import type { Clock } from './Clock'
import { TransportClock } from './TransportClock'

/** The clock every render-path system reads (docs/03-ARCHITECTURE.md HC-2).
 *
 *  HC-2 says there is one time authority with three implementations. Until now the render
 *  path named one of them directly — `TransportClock` — which quietly made the other two
 *  unreachable: an offline `FrameClock` could be constructed but nothing would ever read
 *  it, so "if a system cannot be driven by FrameClock it is broken" was unenforceable.
 *
 *  This is the seam. Preview reads the live transport; the exporter installs a
 *  `FrameClock` for the duration of a render and every downstream system follows without
 *  knowing it happened. */

let override: Clock | null = null

/** Install a clock for the whole render path. Pass null to return to live playback.
 *  Only the exporter should call this. */
export function setActiveClock(clock: Clock | null): void {
  override = clock
}

export function activeClock(): Clock {
  return override ?? TransportClock
}
