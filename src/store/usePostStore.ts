import { create } from 'zustand'
import type { ID } from '@/types/audio'
import type { ParamValue } from '@/types/params'
import type { EffectInstance } from '@/types/visual'
import { POST_STACK_ID } from '@/types/visual'
import { PostRegistry } from '@/engine/post/PostRegistry'
import { useModulationStore } from '@/store/useModulationStore'
import { generateId } from '@/utils/stemColors'

/** usePostStore — the project-wide post-processing stack.
 *
 *  Its own store rather than a field on useSceneStore, for the same reason
 *  useGeneratorStore is its own: the post chain is not a scene object and has no
 *  transform, material, geometry or layer position. Folding it in would mean a dozen
 *  permanently-null fields and a `type === 'post'` branch in every consumer.
 *
 *  Array order IS evaluation order, exactly like an object's deformer stack. Bloom before
 *  grade and bloom after grade are different pictures, so the order is authored, never
 *  inferred. */

interface PostState {
  /** Ordered; index 0 runs first, straight after the scene render. */
  effects: EffectInstance[]
  selectedId: ID | null
  /** Master bypass. Compares the treated frame against the raw one in one click. */
  bypassed: boolean

  addBrick: (brickId: string) => ID | null
  remove: (id: ID) => void
  reorder: (id: ID, delta: number) => void
  setEnabled: (id: ID, enabled: boolean) => void
  setParam: (effectId: ID, paramKey: string, value: ParamValue) => void
  select: (id: ID | null) => void
  setBypassed: (bypassed: boolean) => void
  clear: () => void
}

function uniqueName(effects: EffectInstance[], base: string): string {
  const taken = new Set(effects.map((e) => e.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

export const usePostStore = create<PostState>((set) => ({
  effects: [],
  selectedId: null,
  bypassed: false,

  addBrick: (brickId) => {
    const brick = PostRegistry.get(brickId)
    if (!brick) return null

    const id = generateId()
    set((s) => ({
      effects: [
        ...s.effects,
        {
          id,
          effectId: brickId,
          name: uniqueName(s.effects, brick.label),
          family: 'post-process',
          params: PostRegistry.defaultParams(brickId),
          enabled: true,
        },
      ],
      selectedId: id,
    }))
    return id
  },

  remove: (id) => {
    // Same rule as deleting a deformer: the wires pointing at its parameters have to go
    // with it, or the matrix keeps evaluating a target nothing renders.
    useModulationStore.getState().releaseEffect(POST_STACK_ID, id)
    set((s) => ({
      effects: s.effects.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }))
  },

  reorder: (id, delta) =>
    set((s) => {
      const from = s.effects.findIndex((e) => e.id === id)
      if (from === -1) return s
      const to = Math.max(0, Math.min(s.effects.length - 1, from + delta))
      if (from === to) return s
      const effects = [...s.effects]
      const [moved] = effects.splice(from, 1)
      effects.splice(to, 0, moved)
      return { effects }
    }),

  setEnabled: (id, enabled) =>
    set((s) => ({ effects: s.effects.map((e) => (e.id === id ? { ...e, enabled } : e)) })),

  setParam: (effectId, paramKey, value) =>
    set((s) => ({
      effects: s.effects.map((e) =>
        e.id === effectId ? { ...e, params: { ...e.params, [paramKey]: value } } : e,
      ),
    })),

  select: (id) => set({ selectedId: id }),

  setBypassed: (bypassed) => set({ bypassed }),

  clear: () => set({ effects: [], selectedId: null }),
}))

/** Convenience selector for the selected post effect. */
export function useSelectedPostEffect(): EffectInstance | null {
  return usePostStore((s) => s.effects.find((e) => e.id === s.selectedId) ?? null)
}
