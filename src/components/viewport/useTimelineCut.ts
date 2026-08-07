import { useSyncExternalStore } from 'react'
import { currentCut, subscribeToCuts } from '@/engine/timeline/liveTimeline'

/** Re-renders the caller whenever the live set of timeline strips changes.
 *
 *  For the rare consumer that has to *rebuild* something at a cut rather than read a flag
 *  in `useFrame` — post-processing, where an effect is compiled into a fullscreen pass or
 *  absent from it. Fires a handful of times per song, not sixty times per second. */
export function useTimelineCut(): string {
  return useSyncExternalStore(subscribeToCuts, currentCut)
}
