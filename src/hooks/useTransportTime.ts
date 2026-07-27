import { useEffect, useState } from 'react'
import { TransportClock } from '@/engine/time/TransportClock'

/** Subscribe a React component to the transport playhead at a throttled rate.
 *
 *  Per docs/03-ARCHITECTURE.md HC-1: only values a human must *watch* reach React,
 *  and they do so at display rate — never at frame rate. 12 Hz is plenty for a
 *  timecode readout or a VU meter; the eye cannot resolve faster.
 *
 *  Anything that needs per-frame precision (canvas playheads, shader uniforms,
 *  the modulation matrix) must subscribe to TransportClock directly and write
 *  imperatively instead of using this hook. */
export function useTransportTime(hz = 12): number {
  const [time, setTime] = useState(TransportClock.time)

  useEffect(() => {
    const minInterval = 1000 / hz
    let lastEmit = 0
    let lastPlaying = TransportClock.playing

    return TransportClock.subscribe((t, playing) => {
      // Always flush immediately on a play/pause edge or while paused (seeking,
      // scrubbing) so the readout never lags behind a discrete user action.
      if (playing !== lastPlaying || !playing) {
        lastPlaying = playing
        lastEmit = performance.now()
        setTime(t)
        return
      }

      const now = performance.now()
      if (now - lastEmit >= minInterval) {
        lastEmit = now
        setTime(t)
      }
    })
  }, [hz])

  return time
}
