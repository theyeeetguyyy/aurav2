import { useFrame } from '@react-three/fiber'
import { resolveTimeline } from '@/engine/timeline/StateResolver'
import { publishTimeline, resolvedTimeline } from '@/engine/timeline/liveTimeline'
import { activeClock } from '@/engine/time/timeAuthority'
import { useProjectStore } from '@/store/useProjectStore'

/** Resolves the timeline once per frame, and loads the state a cut lands on.
 *
 *  Resolution is a pure function of the clock (HC-3), so evaluating twice at the same `t` gives the
 *  same answer — which is what lets the exporter render frames out of order.
 *
 *  **Loading a state is a store write, and it happens only at a cut.** With a state owning its
 *  scene, playing across a strip boundary genuinely means swapping scenes; there is no per-frame
 *  filtering to do instead. Cuts are seconds apart, not frames, so this costs a handful of writes
 *  per song — and it is skipped entirely on an unsequenced project, which is most of them.
 *
 *  It commits the outgoing state first, so edits made while parked on a strip are not lost when the
 *  playhead moves off it. */
export function TimelineDriver() {
  useFrame(() => {
    const store = useProjectStore.getState()
    const { timelineStrips, statesLibrary } = store.project

    const next = resolveTimeline(timelineStrips, statesLibrary, activeClock().time)
    const previousStateId = resolvedTimeline().stateId
    publishTimeline(next)

    // Only on a change, and only when the timeline actually names a state. Null means "render what
    // is loaded", which is exactly what an unsequenced project and a gap both want.
    if (next.stateId && next.stateId !== previousStateId && next.stateId !== store.activeStateId) {
      store.activateState(next.stateId)
    }
  })

  return null
}
