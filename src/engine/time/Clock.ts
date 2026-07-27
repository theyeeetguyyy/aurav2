/** Clock — the single time authority (docs/03-ARCHITECTURE.md HC-2).
 *
 *  Every time-dependent system reads `time` from a Clock passed into it.
 *  No engine module may call performance.now(), Date.now(), or read
 *  AudioContext.currentTime directly to decide what to draw.
 *
 *  Three implementations of one interface:
 *    RealtimeClock — preview playback, driven by AudioContext.currentTime
 *    ScrubClock    — timeline scrubbing while paused, driven by user input
 *    FrameClock    — offline export, stepped as frameIndex / fps
 *
 *  If a system cannot be driven by FrameClock, it cannot be exported,
 *  which means it is broken. */

export interface Clock {
  /** Seconds into the project timeline. */
  readonly time: number
  readonly playing: boolean
}

/** A clock whose time is set externally, one step at a time.
 *  Used by the offline exporter (FrameClock) and by scrubbing (ScrubClock). */
export class SteppedClock implements Clock {
  private _time = 0
  private readonly _playing: boolean

  constructor(playing = false) {
    this._playing = playing
  }

  get time(): number {
    return this._time
  }

  get playing(): boolean {
    return this._playing
  }

  /** Set absolute time in seconds. */
  seek(time: number): void {
    this._time = time
  }
}

/** Deterministic frame-stepped clock for offline rendering.
 *  Timestamps are derived by integer division so they never drift. */
export class FrameClock implements Clock {
  private _frame = 0
  public readonly fps: number

  constructor(fps: number) {
    this.fps = fps
  }

  get time(): number {
    return this._frame / this.fps
  }

  get playing(): boolean {
    return true
  }

  get frame(): number {
    return this._frame
  }

  setFrame(frame: number): void {
    this._frame = frame
  }

  advance(): void {
    this._frame++
  }
}
