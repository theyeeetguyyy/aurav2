import { useFrame } from '@react-three/fiber'
import { resolveTimeline } from '@/engine/timeline/StateResolver'
import { publishTimeline } from '@/engine/timeline/liveTimeline'
import { activeClock } from '@/engine/time/timeAuthority'
import { useProjectStore } from '@/store/useProjectStore'

/** Resolves the timeline once per frame and publishes it for the render path to read.
 *
 *  Mounted before anything that reads it. Resolution is a pure function of the clock (HC-3),
 *  so evaluating twice at the same `t` gives the same answer — which is what lets the
 *  exporter render frames out of order.
 *
 *  See `engine/timeline/liveTimeline.ts` for where the result goes and why it is not a store. */
export function TimelineDriver() {
  useFrame(() => {
    const { timelineStrips, statesLibrary } = useProjectStore.getState().project
    // An unsequenced project short-circuits inside the resolver and returns a shared
    // constant, so the common case allocates nothing.
    publishTimeline(resolveTimeline(timelineStrips, statesLibrary, activeClock().time))
  })

  return null
}
