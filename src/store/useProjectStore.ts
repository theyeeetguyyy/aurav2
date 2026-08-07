import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import {
  TIMELINE_LANES,
  type Project,
  type SectionMarker,
  type Strip,
  type VisualState,
} from '@/types/project'
import type { ID } from '@/types/audio'
import { useModulationStore } from '@/store/useModulationStore'
import { usePostStore } from '@/store/usePostStore'
import { useSceneStore } from '@/store/useSceneStore'
import { findFreeSlot } from '@/engine/timeline/StateResolver'
import { generateVariations, planSequence } from '@/engine/timeline/variations'
import { useAudioStore, projectDuration } from '@/store/useAudioStore'
import { generateId, paletteColor } from '@/utils/stemColors'

/** States, strips and markers.
 *
 *  `captureState()` is the action that matters: a state records what is *currently* on and
 *  what is currently wired, as a **selection**. It does not copy the objects (HC-7) or the
 *  routing (HC-8) — so editing a shape changes it in every state that shows it, which is
 *  the entire point of the Blender NLA model this follows. */

interface ProjectState {
  project: Project

  /** Snapshot what is currently visible and wired into a new named state. */
  captureState: (name?: string) => ID
  /** Re-record an existing state from the current scene. */
  recaptureState: (id: ID) => void
  /** Make the scene match a state, so it can be edited. */
  applyState: (id: ID) => void
  removeState: (id: ID) => void
  /** Rename or recolour. Never rewrites the selection — that is `recaptureState`. */
  updateState: (id: ID, patch: Partial<VisualState>) => void

  /** Place a state on the timeline. Omit `lane` to have a free one chosen. */
  placeStrip: (stateId: ID, startTime: number, duration: number, lane?: number) => ID
  removeStrip: (id: ID) => void
  updateStrip: (id: ID, patch: Partial<Strip>) => void

  /** Derive a set of states from the current scene and sequence them across the song.
   *  Returns how many strips were laid down, or 0 when there was nothing to work with. */
  autoSequence: () => number

  placeMarker: (time: number, type: SectionMarker['type']) => ID
  removeMarker: (id: ID) => void
  updateMarker: (id: ID, patch: Partial<SectionMarker>) => void

  setProjectName: (name: string) => void
  setBpm: (bpm: number | null) => void
}

const EMPTY_PROJECT: Project = {
  name: 'Untitled Project',
  bpm: null,
  statesLibrary: {},
  timelineStrips: [],
  markers: [],
}

/** What is on and wired right now, as a selection rather than a copy (HC-7/HC-8). */
function currentSelection(): Pick<
  VisualState,
  'sceneObjectIds' | 'activeConnectionIds' | 'activePostIds' | 'connectionOverrides'
> {
  return {
    sceneObjectIds: useSceneStore
      .getState()
      .objects.filter((o) => o.visible)
      .map((o) => o.id),
    activeConnectionIds: useModulationStore
      .getState()
      .connections.filter((c) => c.enabled)
      .map((c) => c.id),
    activePostIds: usePostStore
      .getState()
      .effects.filter((e) => e.enabled)
      .map((e) => e.id),
    connectionOverrides: {},
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: EMPTY_PROJECT,

  captureState: (name) => {
    recordChange('Capture state', ['project'])
    const id = generateId()
    set((s) => ({
      project: {
        ...s.project,
        statesLibrary: {
          ...s.project.statesLibrary,
          [id]: {
            id,
            name: name ?? `State ${Object.keys(s.project.statesLibrary).length + 1}`,
            // Indexed by how many states exist rather than drawn from the stem rotation,
            // which belongs to stems alone.
            color: paletteColor(Object.keys(s.project.statesLibrary).length),
            ...currentSelection(),
          },
        },
      },
    }))
    return id
  },

  recaptureState: (id) => {
    recordChange('Re-capture state', ['project'])
    set((s) => {
      const existing = s.project.statesLibrary[id]
      if (!existing) return s
      return {
        project: {
          ...s.project,
          statesLibrary: {
            ...s.project.statesLibrary,
            [id]: { ...existing, ...currentSelection() },
          },
        },
      }
    })
  },

  applyState: (id) => {
    const state = get().project.statesLibrary[id]
    if (!state) return

    // Writes visibility and enablement, never the objects or wires themselves — a state
    // selects, it does not own.
    recordChange('Apply state', ['scene', 'modulation', 'post'])

    const visible = new Set(state.sceneObjectIds)
    useSceneStore.setState((s) => ({
      objects: s.objects.map((o) => ({ ...o, visible: visible.has(o.id) })),
    }))

    const live = new Set(state.activeConnectionIds)
    useModulationStore.setState((s) => ({
      connections: s.connections.map((c) => ({ ...c, enabled: live.has(c.id) })),
    }))

    const post = new Set(state.activePostIds)
    usePostStore.setState((s) => ({
      effects: s.effects.map((e) => ({ ...e, enabled: post.has(e.id) })),
    }))
  },

  removeState: (id) => {
    recordChange('Delete state', ['project'])
    set((s) => {
      const { [id]: _removed, ...rest } = s.project.statesLibrary
      return {
        project: {
          ...s.project,
          statesLibrary: rest,
          // A strip pointing at a deleted state resolves to nothing, so it goes too.
          timelineStrips: s.project.timelineStrips.filter((st) => st.stateId !== id),
        },
      }
    })
  },

  updateState: (id, patch) => {
    // Coalesced per state: renaming is typing, and one undo step per character is useless.
    recordChange('Update state', ['project'], `state:${id}`)
    set((s) => ({
      project: {
        ...s.project,
        statesLibrary: {
          ...s.project.statesLibrary,
          [id]: { ...s.project.statesLibrary[id], ...patch },
        },
      },
    }))
  },

  placeStrip: (stateId, startTime, duration, lane) => {
    recordChange('Place strip', ['project'])
    const id = generateId()
    set((s) => {
      const width = Math.max(0.1, duration)
      // An explicit lane is honoured exactly — a drop onto lane 2 means lane 2. Only an
      // unaimed placement gets a slot found for it.
      const slot =
        lane === undefined
          ? findFreeSlot(s.project.timelineStrips, Math.max(0, startTime), width, TIMELINE_LANES)
          : { startTime: Math.max(0, startTime), lane }

      return {
        project: {
          ...s.project,
          timelineStrips: [
            ...s.project.timelineStrips,
            { id, stateId, startTime: slot.startTime, duration: width, lane: slot.lane },
          ],
        },
      }
    })
    return id
  },

  removeStrip: (id) => {
    recordChange('Delete strip', ['project'])
    set((s) => ({
      project: {
        ...s.project,
        timelineStrips: s.project.timelineStrips.filter((st) => st.id !== id),
      },
    }))
  },

  updateStrip: (id, patch) => {
    // Coalesced per strip, so dragging one is a single undo step rather than one per pixel.
    // The label names the gesture: a resize changes duration, a move does not.
    recordChange(
      patch.duration === undefined ? 'Move strip' : 'Resize strip',
      ['project'],
      `strip:${id}`,
    )
    set((s) => ({
      project: {
        ...s.project,
        timelineStrips: s.project.timelineStrips.map((st) =>
          st.id === id ? { ...st, ...patch } : st,
        ),
      },
    }))
  },

  autoSequence: () => {
    const objects = useSceneStore.getState().objects
    const variations = generateVariations({
      // Only what is currently visible: an object the user switched off is one they have
      // already said they do not want, and a generated sequence should not overrule that.
      shapeIds: objects.filter((o) => o.visible && o.type !== 'light').map((o) => o.id),
      lightIds: objects.filter((o) => o.visible && o.type === 'light').map((o) => o.id),
      postIds: usePostStore.getState().effects.map((e) => e.id),
      connectionIds: useModulationStore.getState().connections.map((c) => c.id),
    })
    if (variations.length === 0) return 0

    const plan = planSequence(
      variations,
      get().project.markers,
      projectDuration(useAudioStore.getState().tracks),
    )
    if (plan.length === 0) return 0

    // One history entry for the whole operation. Undoing a generated sequence strip by strip
    // would be twelve presses to get back to where you were.
    recordChange('Auto-sequence', ['project'])

    set((s) => {
      const statesLibrary = { ...s.project.statesLibrary }
      const base = Object.keys(statesLibrary).length

      const ids = variations.map((variation, i) => {
        const id = generateId()
        statesLibrary[id] = {
          id,
          name: variation.name,
          color: paletteColor(base + i),
          sceneObjectIds: variation.sceneObjectIds,
          activeConnectionIds: variation.activeConnectionIds,
          activePostIds: variation.activePostIds,
          connectionOverrides: {},
        }
        return id
      })

      return {
        project: {
          ...s.project,
          statesLibrary,
          // Replaces the timeline rather than adding to it. Layering a generated sequence
          // over hand-placed strips would bury one under the other, and which survives
          // would depend on lane order rather than on intent.
          timelineStrips: plan.map((strip) => ({
            id: generateId(),
            stateId: ids[strip.variationIndex],
            startTime: strip.startTime,
            duration: strip.duration,
            lane: 0,
          })),
        },
      }
    })

    return plan.length
  },

  placeMarker: (time, type) => {
    recordChange('Add marker', ['project'])
    const id = generateId()
    set((s) => ({
      project: {
        ...s.project,
        markers: [...s.project.markers, { id, time: Math.max(0, time), type, label: type }].sort(
          (a, b) => a.time - b.time,
        ),
      },
    }))
    return id
  },

  removeMarker: (id) => {
    recordChange('Delete marker', ['project'])
    set((s) => ({
      project: { ...s.project, markers: s.project.markers.filter((m) => m.id !== id) },
    }))
  },

  updateMarker: (id, patch) => {
    recordChange('Move marker', ['project'], `marker:${id}`)
    set((s) => ({
      project: {
        ...s.project,
        markers: s.project.markers
          .map((m) => (m.id === id ? { ...m, ...patch } : m))
          .sort((a, b) => a.time - b.time),
      },
    }))
  },

  setProjectName: (name) => {
    // Deliberately not an undo step. Nobody reaches for Ctrl+Z to un-rename a document, and
    // recording it would bury the edit they actually wanted back.
    set((s) => ({ project: { ...s.project, name: name.trim() || 'Untitled Project' } }))
  },

  setBpm: (bpm) => set((s) => ({ project: { ...s.project, bpm } })),
}))
