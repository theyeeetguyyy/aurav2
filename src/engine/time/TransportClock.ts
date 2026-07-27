/** TransportClock — the live playhead.
 *
 *  CRITICAL (docs/03-ARCHITECTURE.md HC-1): the playhead is a per-frame value and
 *  must NOT live in React state. Writing it to Zustand at 60 Hz re-renders every
 *  subscribed component 60 times a second — with N stems that is N waveform
 *  repaints plus a full reconciliation pass, every frame.
 *
 *  Per-frame consumers (canvas painters, useFrame hooks, the modulation matrix)
 *  subscribe directly and read `time` imperatively. React components that merely
 *  *display* the time use the useTransportTime() hook, which throttles. */

import type { Clock } from './Clock'

type TimeListener = (time: number, playing: boolean) => void

class TransportClockImpl implements Clock {
  private _time = 0
  private _playing = false
  private _duration = 0
  private readonly listeners = new Set<TimeListener>()

  get time(): number {
    return this._time
  }

  get playing(): boolean {
    return this._playing
  }

  /** Project duration in seconds (longest trimmed track). */
  get duration(): number {
    return this._duration
  }

  /** Playhead position as a 0–1 fraction of the project duration. */
  get progress(): number {
    return this._duration > 0 ? Math.min(this._time / this._duration, 1) : 0
  }

  setTime(time: number): void {
    if (time === this._time) return
    this._time = time
    this.emit()
  }

  setPlaying(playing: boolean): void {
    if (playing === this._playing) return
    this._playing = playing
    this.emit()
  }

  setDuration(duration: number): void {
    this._duration = duration
  }

  /** Subscribe to every tick. Returns an unsubscribe function.
   *  Listeners run on the audio clock's rAF tick — keep them allocation-free. */
  subscribe(listener: TimeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this._time, this._playing)
    }
  }

  reset(): void {
    this._time = 0
    this._playing = false
    this.emit()
  }
}

/** Singleton live transport clock. */
export const TransportClock = new TransportClockImpl()
