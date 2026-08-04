import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import type { ID } from '@/types/audio'
import type { AutomationPoint, LaneData, LaneInterpolation } from '@/engine/automation/lane'
import { decimate, flatLane } from '@/engine/automation/lane'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import type { FeatureKey } from '@/engine/audio/featureTypes'
import { useModulationStore } from '@/store/useModulationStore'
import { getNextStemColor, generateId } from '@/utils/stemColors'

/** Automation lanes.
 *
 *  Most lanes belong to a stem: one per imported track, showing the curve the analyser
 *  derived, editable in place under that stem's own waveform. Detached lanes exist for
 *  the rarer "I want a shape the music does not contain".
 *
 *  A stem lane starts with **no points**, deferring to the feature timeline. It only
 *  materialises a curve when someone edits it, so the common case costs nothing and what
 *  is displayed is exactly what the analyser produced rather than a resampling of it. */

export interface AutomationLane extends LaneData {
  id: ID
  name: string
  color: string
}

interface AutomationState {
  lanes: AutomationLane[]
  /** Which detached lane the standalone editor is showing. */
  selectedId: ID | null

  /** Get or create the lane for a stem. Called on import and by the row editor. */
  ensureStemLane: (trackId: ID, name: string, color: string, metric?: FeatureKey) => AutomationLane
  laneForTrack: (trackId: ID) => AutomationLane | null

  addLane: (duration: number, name?: string) => ID
  removeLane: (id: ID) => void
  removeLanesForTrack: (trackId: ID) => void
  renameLane: (id: ID, name: string) => void
  setPoints: (id: ID, points: AutomationPoint[]) => void
  setInterpolation: (id: ID, interpolation: LaneInterpolation) => void
  /** Switch which analysed metric the lane is the curve of. Returns it to analysis. */
  setMetric: (id: ID, metric: FeatureKey) => void
  /** Throw away edits and follow the analysis again. */
  resetToAnalysis: (id: ID) => void
  /** Snapshot the analysis into editable points, for the first edit. */
  materialise: (id: ID, duration: number) => AutomationPoint[]
  select: (id: ID | null) => void
  clear: () => void
}

function stemLane(trackId: ID, name: string, color: string, metric: FeatureKey): AutomationLane {
  return {
    id: generateId(),
    name,
    color,
    // Empty on purpose: `analysis` mode reads the feature timeline directly, which is
    // exact and allocates nothing until someone actually edits.
    points: [],
    interpolation: 'smooth',
    mode: 'analysis',
    source: { trackId, metric },
  }
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  lanes: [],
  selectedId: null,

  ensureStemLane: (trackId, name, color, metric = 'envelope') => {
    const existing = get().lanes.find((l) => l.source?.trackId === trackId)
    if (existing) return existing

    const lane = stemLane(trackId, name, color, metric)
    set((s) => ({ lanes: [...s.lanes, lane] }))
    return lane
  },

  laneForTrack: (trackId) => get().lanes.find((l) => l.source?.trackId === trackId) ?? null,

  addLane: (duration, name) => {
    recordChange('Add lane', ['lanes'])
    const id = generateId()
    set((s) => ({
      lanes: [
        ...s.lanes,
        {
          id,
          name: name ?? `Lane ${s.lanes.filter((l) => !l.source).length + 1}`,
          color: getNextStemColor(),
          // A detached lane has no analysis to defer to, so it starts flat — drawing on
          // top of something is a far easier first gesture than drawing from nothing.
          points: flatLane(duration, 0.5),
          interpolation: 'smooth',
          mode: 'edited',
        },
      ],
      selectedId: id,
    }))
    return id
  },

  removeLane: (id) => {
    recordChange('Delete lane', ['lanes', 'modulation'])
    useModulationStore.getState().releaseObject(id)
    set((s) => ({
      lanes: s.lanes.filter((l) => l.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }))
  },

  removeLanesForTrack: (trackId) => {
    // Deleting a stem takes its lane with it, and the wires drawn from that lane.
    for (const lane of get().lanes.filter((l) => l.source?.trackId === trackId)) {
      useModulationStore.getState().releaseObject(lane.id)
    }
    set((s) => ({ lanes: s.lanes.filter((l) => l.source?.trackId !== trackId) }))
  },

  renameLane: (id, name) => {
    recordChange('Rename lane', ['lanes'])
    set((s) => ({
      lanes: s.lanes.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)),
    }))
  },

  setPoints: (id, points) => {
    // One key per lane, so a paint stroke is one undo step.
    recordChange('Edit automation', ['lanes'], `lane:${id}`)
    set((s) => ({
      lanes: s.lanes.map((l) => (l.id === id ? { ...l, points, mode: 'edited' as const } : l)),
    }))
  },

  setInterpolation: (id, interpolation) => {
    recordChange('Change lane curve', ['lanes'])
    set((s) => ({ lanes: s.lanes.map((l) => (l.id === id ? { ...l, interpolation } : l)) }))
  },

  setMetric: (id, metric) => {
    recordChange('Change source metric', ['lanes'])
    set((s) => ({
      lanes: s.lanes.map((l) =>
        l.id === id && l.source
          ? { ...l, source: { ...l.source, metric }, mode: 'analysis' as const, points: [] }
          : l,
      ),
    }))
  },

  resetToAnalysis: (id) => {
    recordChange('Reset to analysis', ['lanes'])
    set((s) => ({
      lanes: s.lanes.map((l) =>
        l.id === id && l.source ? { ...l, mode: 'analysis' as const, points: [] } : l,
      ),
    }))
  },

  materialise: (id, duration) => {
    const lane = get().lanes.find((l) => l.id === id)
    if (!lane) return []
    if (lane.mode === 'edited' && lane.points.length > 0) return lane.points
    if (!lane.source) return flatLane(duration, 0.5)

    const { trackId, metric } = lane.source
    return decimate((t) => AudioFeatures.sample(trackId, metric as FeatureKey, t), duration)
  },

  select: (id) => set({ selectedId: id }),

  clear: () => set({ lanes: [], selectedId: null }),
}))

/** Lane lookup for the field context. Passed into the engine, never imported by it. */
export function getLane(id: string): LaneData | null {
  return useAutomationStore.getState().lanes.find((l) => l.id === id) ?? null
}
