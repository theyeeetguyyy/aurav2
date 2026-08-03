import { create } from 'zustand'
import type { ID } from '@/types/audio'
import type { AutomationPoint, LaneData, LaneInterpolation } from '@/engine/automation/lane'
import { flatLane } from '@/engine/automation/lane'
import { useModulationStore } from '@/store/useModulationStore'
import { getNextStemColor, generateId } from '@/utils/stemColors'

/** Hand-drawn signals. Its own store for the same reason generators have one: a lane is
 *  not a scene object, not a track, and not an effect — it is a source. */

export interface AutomationLane extends LaneData {
  id: ID
  name: string
  color: string
}

interface AutomationState {
  lanes: AutomationLane[]
  /** Which lane the editor is showing. */
  selectedId: ID | null

  addLane: (duration: number, name?: string) => ID
  removeLane: (id: ID) => void
  renameLane: (id: ID, name: string) => void
  setPoints: (id: ID, points: AutomationPoint[]) => void
  setInterpolation: (id: ID, interpolation: LaneInterpolation) => void
  select: (id: ID | null) => void
  clear: () => void
}

export const useAutomationStore = create<AutomationState>((set) => ({
  lanes: [],
  selectedId: null,

  addLane: (duration, name) => {
    const id = generateId()
    set((s) => ({
      lanes: [
        ...s.lanes,
        {
          id,
          name: name ?? `Lane ${s.lanes.length + 1}`,
          color: getNextStemColor(),
          // A flat line rather than an empty lane: drawing on top of something is a much
          // easier first gesture than drawing from nothing.
          points: flatLane(duration, 0.5),
          interpolation: 'smooth',
        },
      ],
      selectedId: id,
    }))
    return id
  },

  removeLane: (id) => {
    // Same rule as deleting a generator: the wires drawn from it go too.
    useModulationStore.getState().releaseObject(id)
    set((s) => ({
      lanes: s.lanes.filter((l) => l.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }))
  },

  renameLane: (id, name) =>
    set((s) => ({
      lanes: s.lanes.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)),
    })),

  setPoints: (id, points) =>
    set((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, points } : l)) })),

  setInterpolation: (id, interpolation) =>
    set((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, interpolation } : l)) })),

  select: (id) => set({ selectedId: id }),

  clear: () => set({ lanes: [], selectedId: null }),
}))

/** Lane lookup for the field context. Passed into the engine, never imported by it. */
export function getLane(id: string): LaneData | null {
  return useAutomationStore.getState().lanes.find((l) => l.id === id) ?? null
}
