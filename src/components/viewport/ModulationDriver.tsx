import { useFrame } from '@react-three/fiber'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { activeClock } from '@/engine/time/timeAuthority'
import { useModulationStore } from '@/store/useModulationStore'
import { isTrackVisuallyActive } from '@/store/useAudioStore'
import { getGenerator } from '@/store/useGeneratorStore'
import { getLane } from '@/store/useAutomationStore'
import { isConnectionActive, resolvedTimeline } from '@/engine/timeline/liveTimeline'
import { withOverride } from '@/engine/timeline/StateResolver'
import type { ModulationConnection } from '@/types/modulation'

/** Evaluates the modulation matrix once per frame, before anything reads it.
 *
 *  Mounted ahead of SceneObjects in the canvas tree, so its useFrame subscription is
 *  registered first and runs first. Re-evaluating with the same time is idempotent
 *  (dt collapses to 0), so ordering is a performance detail, not a correctness one.
 *
 *  Reads stores with getState() rather than a hook: subscribing would re-render this
 *  component, and it runs 60 times a second (HC-1). */
export function ModulationDriver() {
  useFrame(() => {
    const { connections, triggers } = useModulationStore.getState()
    if (connections.length === 0 && triggers.length === 0) return

    // The timeline gates which wires are live and may override their chains (HC-8).
    // Routing itself stays project-global — a state activates a subset of it, so an envelope
    // survives a cut unless the state deliberately drops it.
    const { overrides, activeConnectionIds } = resolvedTimeline()
    const live: readonly ModulationConnection[] =
      activeConnectionIds === null && Object.keys(overrides).length === 0
        ? connections
        : connections
            .filter((c) => isConnectionActive(c.id, c.enabled))
            // `enabled` is forced on: the timeline already decided, and the matrix skips
            // anything still flagged off.
            .map((c) => ({ ...c, enabled: true, chain: withOverride(c.chain, overrides[c.id]) }))
    // The active clock, not the transport directly: preview reads the live playhead and
    // an offline render installs a FrameClock, and neither this nor anything downstream
    // needs to know which (HC-2).
    ModulationMatrix.evaluate(activeClock(), live, triggers, {
      isTrackActive: isTrackVisuallyActive,
      getGenerator,
      getLane,
    })
  })

  return null
}
