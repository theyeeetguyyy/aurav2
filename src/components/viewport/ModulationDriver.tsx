import { useFrame } from '@react-three/fiber'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { TransportClock } from '@/engine/time/TransportClock'
import { useModulationStore } from '@/store/useModulationStore'
import { isTrackVisuallyActive } from '@/store/useAudioStore'
import { getGenerator } from '@/store/useGeneratorStore'

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
    ModulationMatrix.evaluate(TransportClock, connections, triggers, {
      isTrackActive: isTrackVisuallyActive,
      getGenerator,
    })
  })

  return null
}
