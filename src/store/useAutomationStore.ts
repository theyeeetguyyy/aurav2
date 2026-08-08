import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import type { ID } from '@/types/audio'
import type {
  AutomationPoint,
  LaneData,
  LaneInterpolation,
} from '@/engine/automation/lane'
import { decimate, flatPattern, stabPattern } from '@/engine/automation/lane'
import {
  MIN_CLIP_SECONDS,
  duplicateOffset,
  normaliseClip,
  resizeClip,
  type AutomationClip,
  type AutomationPattern,
} from '@/engine/automation/clips'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import type { FeatureKey } from '@/engine/audio/featureTypes'
import { useModulationStore } from '@/store/useModulationStore'
import { getNextStemColor, generateId, paletteColor } from '@/utils/stemColors'

/** Automation: lanes, the clips on them, and the patterns those clips reference.
 *
 *  **Lanes** are the wireable identity — a routing wire points at a lane id, and that never
 *  changes as you edit what is on it. Most lanes belong to a stem; with nothing on it a stem
 *  lane *is* that stem's analysed signal.
 *
 *  **Clips** are placements: start, length, repeat count. **Patterns** are the shapes, in
 *  normalised time, shared by every clip that references them. Editing a pattern therefore
 *  changes every clip using it — which is the point, and why there is no "unlinked" copy.
 *
 *  Patterns are project-global rather than per-lane, so a shape drawn against the kick can be
 *  dropped onto a lane driving something else without being redrawn.
 *
 *  **A stem has one lane per metric you asked for, and none for the rest.** The analyser produces
 *  thirteen signals per stem; almost nobody wants thirteen. So selecting a metric on the stems
 *  page is what brings it into existence as a source, and Routing lists lanes rather than raw
 *  metrics — which is why four stems no longer mean sixty-four rows of things you will never
 *  wire. TouchDesigner arrives at the same shape with the Select CHOP: single out the channels
 *  you want before anything downstream sees them. */

export interface AutomationLane extends LaneData {
  id: ID
  name: string
  color: string
}

interface AutomationState {
  lanes: AutomationLane[]
  /** Every pattern in the project, keyed by id. */
  patterns: Record<ID, AutomationPattern>
  /** The clip being edited, if any. Its pattern is what the curve editor shows. */
  selectedClipId: ID | null

  /** Get or create the lane for one metric of a stem. Called on import and by the picker. */
  ensureStemLane: (trackId: ID, name: string, color: string, metric?: FeatureKey) => AutomationLane
  /** Every lane belonging to a stem, in the order its metrics were selected. */
  lanesForTrack: (trackId: ID) => AutomationLane[]
  /** Add or remove a metric as a source. Removing takes its clips and wires with it. */
  toggleStemMetric: (trackId: ID, name: string, color: string, metric: FeatureKey) => void

  addLane: (name?: string) => ID
  removeLane: (id: ID) => void
  removeLanesForTrack: (trackId: ID) => void
  renameLane: (id: ID, name: string) => void
  /** Place a new clip on a lane. Creates a pattern for it unless one is named.
   *  Returns the clip id. */
  addClip: (laneId: ID, startTime: number, duration: number, patternId?: ID) => ID | null
  /** Place a copy of a clip immediately after it, sharing its pattern. */
  duplicateClip: (laneId: ID, clipId: ID) => ID | null
  moveClip: (laneId: ID, clipId: ID, startTime: number) => void
  resizeClipEdge: (laneId: ID, clipId: ID, edge: 'start' | 'end', time: number) => void
  setClipRepeat: (laneId: ID, clipId: ID, repeat: number) => void
  removeClip: (laneId: ID, clipId: ID) => void
  /** Drop every clip on a lane. On a stem lane that returns it to pure analysis. */
  clearClips: (laneId: ID) => void

  setPatternPoints: (patternId: ID, points: AutomationPoint[]) => void
  setPatternInterpolation: (patternId: ID, interpolation: LaneInterpolation) => void
  renamePattern: (patternId: ID, name: string) => void

  selectClip: (id: ID | null) => void
  /** Points to seed a new pattern on a stem lane: the analysed shape over the clip's span,
   *  so the first edit starts from what the music actually does. */
  sampledPattern: (laneId: ID, startTime: number, duration: number) => AutomationPoint[]
  clear: () => void
}

function stemLane(trackId: ID, name: string, color: string, metric: FeatureKey): AutomationLane {
  return {
    id: generateId(),
    // Named for the stem AND the metric, because a stem now has several lanes and "drums" on
    // four of them tells you nothing about which is which.
    name: `${name} · ${metricLabel(metric)}`,
    color,
    // No clips: the lane reads the feature timeline directly, which is exact and allocates
    // nothing until someone places something on it.
    clips: [],
    source: { trackId, metric },
  }
}

/** Apply a change to one lane's clips. Every clip action is this plus a transform. */
function mapClips(
  lanes: AutomationLane[],
  laneId: ID,
  fn: (clips: AutomationClip[]) => AutomationClip[],
): AutomationLane[] {
  return lanes.map((lane) => (lane.id === laneId ? { ...lane, clips: fn(lane.clips) } : lane))
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  lanes: [],
  patterns: {},
  selectedClipId: null,

  ensureStemLane: (trackId, name, color, metric = 'envelope') => {
    const existing = get().lanes.find(
      (l) => l.source?.trackId === trackId && l.source.metric === metric,
    )
    if (existing) return existing

    const lane = stemLane(trackId, name, color, metric)
    set((s) => ({ lanes: [...s.lanes, lane] }))
    return lane
  },

  lanesForTrack: (trackId) => get().lanes.filter((l) => l.source?.trackId === trackId),

  toggleStemMetric: (trackId, name, color, metric) => {
    const existing = get().lanes.find(
      (l) => l.source?.trackId === trackId && l.source.metric === metric,
    )

    if (existing) {
      // Deselecting destroys the lane, its clips and the wires drawn from it. That is the honest
      // reading of "I do not want this source": leaving an orphan lane behind so the wires
      // survive would mean Routing still listing something the stems page says is gone.
      recordChange('Remove source', ['lanes', 'modulation'])
      useModulationStore.getState().releaseObject(existing.id)
      set((s) => ({
        lanes: s.lanes.filter((l) => l.id !== existing.id),
        selectedClipId: existing.clips.some((c) => c.id === s.selectedClipId)
          ? null
          : s.selectedClipId,
      }))
      return
    }

    recordChange('Add source', ['lanes'])
    set((s) => ({ lanes: [...s.lanes, stemLane(trackId, name, color, metric)] }))
  },

  addLane: (name) => {
    recordChange('Add curve', ['lanes'])
    const id = generateId()
    set((s) => ({
      lanes: [
        ...s.lanes,
        {
          id,
          name: name ?? `Curve ${s.lanes.filter((l) => !l.source).length + 1}`,
          color: getNextStemColor(),
          // Empty. A lane is a row; what goes on it is a clip, and asking for the row should
          // not silently commit you to a shape and a length you did not choose.
          clips: [],
        },
      ],
    }))
    return id
  },

  removeLane: (id) => {
    recordChange('Delete curve', ['lanes', 'modulation'])
    useModulationStore.getState().releaseObject(id)
    set((s) => ({ lanes: s.lanes.filter((l) => l.id !== id) }))
  },

  removeLanesForTrack: (trackId) => {
    // Deleting a stem takes its lane with it, and the wires drawn from that lane.
    for (const lane of get().lanes.filter((l) => l.source?.trackId === trackId)) {
      useModulationStore.getState().releaseObject(lane.id)
    }
    set((s) => ({ lanes: s.lanes.filter((l) => l.source?.trackId !== trackId) }))
  },

  renameLane: (id, name) => {
    recordChange('Rename curve', ['lanes'], `laneName:${id}`)
    set((s) => ({
      lanes: s.lanes.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)),
    }))
  },

  // ─── Clips ───

  addClip: (laneId, startTime, duration, patternId) => {
    const lane = get().lanes.find((l) => l.id === laneId)
    if (!lane) return null

    recordChange('Add clip', ['lanes'])
    const clipId = generateId()

    set((s) => {
      const patterns = { ...s.patterns }
      let useId = patternId

      if (!useId || !patterns[useId]) {
        useId = generateId()
        const count = Object.keys(patterns).length
        patterns[useId] = {
          id: useId,
          name: `Pattern ${count + 1}`,
          color: paletteColor(count),
          // A stem lane seeds from its own analysed shape over this span, so the first thing
          // you see is the music. A drawn lane has nothing to sample, so it gets a stab —
          // a shape with an obvious rhythm, which is what `repeat` is for.
          points: lane.source
            ? get().sampledPattern(laneId, startTime, duration)
            : stabPattern(),
          interpolation: 'smooth',
        }
      }

      return {
        patterns,
        lanes: mapClips(s.lanes, laneId, (clips) => [
          ...clips,
          normaliseClip({
            id: clipId,
            patternId: useId!,
            startTime,
            duration,
            repeat: 1,
          }),
        ]),
        selectedClipId: clipId,
      }
    })

    return clipId
  },

  duplicateClip: (laneId, clipId) => {
    const lane = get().lanes.find((l) => l.id === laneId)
    const clip = lane?.clips.find((c) => c.id === clipId)
    if (!clip) return null

    recordChange('Duplicate clip', ['lanes'])
    const id = generateId()
    set((s) => ({
      // Same `patternId`: editing either copy changes both, which is the whole reason to
      // duplicate rather than redraw. Blender calls this a linked duplicate and offers an
      // unlinked one too; there is no use for the unlinked kind here.
      lanes: mapClips(s.lanes, laneId, (clips) => [
        ...clips,
        { ...clip, id, startTime: duplicateOffset(clip) },
      ]),
      selectedClipId: id,
    }))
    return id
  },

  moveClip: (laneId, clipId, startTime) => {
    // Coalesced per clip, so a drag is one undo step rather than one per pixel.
    recordChange('Move clip', ['lanes'], `clip:${clipId}`)
    set((s) => ({
      lanes: mapClips(s.lanes, laneId, (clips) =>
        clips.map((c) => (c.id === clipId ? normaliseClip({ ...c, startTime }) : c)),
      ),
    }))
  },

  resizeClipEdge: (laneId, clipId, edge, time) => {
    recordChange('Resize clip', ['lanes'], `clip:${clipId}`)
    set((s) => ({
      lanes: mapClips(s.lanes, laneId, (clips) =>
        clips.map((c) => (c.id === clipId ? resizeClip(c, edge, time) : c)),
      ),
    }))
  },

  setClipRepeat: (laneId, clipId, repeat) => {
    recordChange('Change clip repeat', ['lanes'], `repeat:${clipId}`)
    set((s) => ({
      lanes: mapClips(s.lanes, laneId, (clips) =>
        clips.map((c) => (c.id === clipId ? normaliseClip({ ...c, repeat }) : c)),
      ),
    }))
  },

  removeClip: (laneId, clipId) => {
    recordChange('Delete clip', ['lanes'])
    set((s) => ({
      lanes: mapClips(s.lanes, laneId, (clips) => clips.filter((c) => c.id !== clipId)),
      selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    }))
  },

  clearClips: (laneId) => {
    recordChange('Clear clips', ['lanes'])
    set((s) => ({
      lanes: mapClips(s.lanes, laneId, () => []),
      selectedClipId: null,
    }))
  },

  // ─── Patterns ───
  //
  // Deliberately NOT garbage-collected when the last clip referencing one goes away. A pattern
  // you spent time drawing should survive deleting the clip you drew it for, so it can be
  // placed again — and the cost of keeping one is a few hundred bytes.

  setPatternPoints: (patternId, points) => {
    // One key per pattern, so a paint stroke is one undo step.
    recordChange('Edit curve', ['lanes'], `pattern:${patternId}`)
    set((s) =>
      s.patterns[patternId]
        ? { patterns: { ...s.patterns, [patternId]: { ...s.patterns[patternId], points } } }
        : s,
    )
  },

  setPatternInterpolation: (patternId, interpolation) => {
    recordChange('Change curve shape', ['lanes'])
    set((s) =>
      s.patterns[patternId]
        ? {
            patterns: {
              ...s.patterns,
              [patternId]: { ...s.patterns[patternId], interpolation },
            },
          }
        : s,
    )
  },

  renamePattern: (patternId, name) => {
    recordChange('Rename curve', ['lanes'], `patternName:${patternId}`)
    set((s) =>
      s.patterns[patternId]
        ? {
            patterns: {
              ...s.patterns,
              [patternId]: {
                ...s.patterns[patternId],
                name: name.trim() || s.patterns[patternId].name,
              },
            },
          }
        : s,
    )
  },

  selectClip: (id) => set({ selectedClipId: id }),

  sampledPattern: (laneId, startTime, duration) => {
    const lane = get().lanes.find((l) => l.id === laneId)
    if (!lane?.source) return flatPattern(0.5)

    const { trackId, metric } = lane.source
    const span = Math.max(MIN_CLIP_SECONDS, duration)
    // `decimate` returns normalised time, which is exactly what a pattern holds — so the
    // analysed shape over this clip's span becomes the pattern's shape directly.
    return decimate((t) => AudioFeatures.sample(trackId, metric as FeatureKey, startTime + t), span)
  },

  clear: () => set({ lanes: [], patterns: {}, selectedClipId: null }),
}))

/** Lane lookup for the field context. Passed into the engine, never imported by it. */
export function getLane(id: string): LaneData | null {
  return useAutomationStore.getState().lanes.find((l) => l.id === id) ?? null
}

/** Pattern table for the field context, for the same reason. */
export function getPatterns(): Readonly<Record<string, AutomationPattern>> {
  return useAutomationStore.getState().patterns
}

/** A metric key as a label. Shared by the lane name and every picker, so the word for a signal
 *  is the same wherever it appears. */
export function metricLabel(key: string): string {
  return key
    .replace('band-', '')
    .replace(/-/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}
