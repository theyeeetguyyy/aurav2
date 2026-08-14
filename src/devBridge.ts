import { useSceneStore } from '@/store/useSceneStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useModulationStore } from '@/store/useModulationStore'
import { usePostStore } from '@/store/usePostStore'
import { activeClock } from '@/engine/time/timeAuthority'

/** Read-only state bridge for browser-driven checks. Development builds only.
 *
 *  Without it, every check against a running AURA is a screenshot diff, and a screenshot cannot
 *  distinguish "the feature is broken" from "the click missed the button". That ambiguity cost real
 *  time: a points deformer was reported broken when the effect had in fact never been added to the
 *  object. Being able to read the object back settles it in one call.
 *
 *  Getters, not the stores themselves — nothing here can drive the app, so a check cannot pass by
 *  quietly mutating state into the shape it wants. */
export function installDevBridge(): void {
  if (!import.meta.env.DEV) return

  Object.defineProperty(window, 'aura', {
    configurable: true,
    value: {
      /** Objects with their effect stacks — the usual question. */
      objects: () =>
        useSceneStore.getState().objects.map((o) => ({
          id: o.id,
          name: o.name,
          brickId: o.brickId,
          backend: o.backend,
          materialId: o.materialId,
          material: o.material,
          paletteSlot: o.paletteSlot,
          visible: o.visible,
          effects: o.effects.map((e) => ({
            effectId: e.effectId,
            enabled: e.enabled,
            params: e.params,
          })),
        })),
      selection: () => useSceneStore.getState().selectedId,
      palette: () => useSceneStore.getState().palette,
      connections: () =>
        useModulationStore.getState().connections.map((c) => ({
          source: c.source,
          target: c.target,
          enabled: c.enabled,
        })),
      states: () =>
        Object.values(useProjectStore.getState().project.statesLibrary).map((s) => ({
          id: s.id,
          name: s.name,
          objects: s.objects.length,
          post: s.post.length,
        })),
      strips: () =>
        useProjectStore.getState().project.timelineStrips.map((s) => ({
          stateId: s.stateId,
          lane: s.lane,
          startTime: s.startTime,
          duration: s.duration,
        })),
      activeStateId: () => useProjectStore.getState().activeStateId,
      post: () => usePostStore.getState().effects.map((e) => e.effectId),
      time: () => activeClock().time,
    },
  })
}
