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
import { generateId, paletteColor } from '@/utils/stemColors'
import { buildObject } from '@/engine/scene/buildObject'
import { DEFAULT_PALETTE } from '@/engine/scene/palette'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import type { SceneObject } from '@/types/visual'
import { projectDuration, useAudioStore } from './useAudioStore'

/** States, strips and markers.
 *
 *  `captureState()` is the action that matters: a state records what is *currently* on and
 *  what is currently wired, as a **selection**. It does not copy the objects (HC-7) or the
 *  routing (HC-8) — so editing a shape changes it in every state that shows it, which is
 *  the entire point of the Blender NLA model this follows. */

interface ProjectState {
  project: Project

  /** The state currently loaded into the scene. Everything you edit edits this one. */
  activeStateId: ID | null

  /** Create a state from the default scene and switch to it. */
  newState: (name?: string) => ID
  /** Create a state that starts as a copy of an existing one, and switch to it. */
  duplicateState: (id: ID) => ID | null
  /** Save the current scene into the active state, then load `id`. */
  switchState: (id: ID) => void
  removeState: (id: ID) => void
  renameState: (id: ID, name: string) => void
  /** Write the live scene back into the active state. Called before anything reads states. */
  commitActiveState: () => void
  /** Make sure something is loaded. A project with no state has no scene, which is not a state
   *  the app should ever be in — so this is called at startup and after opening a file. */
  ensureState: () => void
  /** Switch because the *timeline* said so, not because the user asked.
   *
   *  Identical to `switchState` minus the history entry: playing across four cuts must not leave
   *  four things to undo, and undoing "the playhead moved" is not a coherent request. */
  activateState: (id: ID) => void

  placeStrip: (stateId: ID, startTime: number, duration: number, lane?: number) => ID
  removeStrip: (id: ID) => void
  updateStrip: (id: ID, patch: Partial<Strip>) => void

  placeMarker: (time: number, type: SectionMarker['type']) => ID
  removeMarker: (id: ID) => void
  updateMarker: (id: ID, patch: Partial<SectionMarker>) => void

  setProjectName: (name: string) => void
  setBpm: (bpm: number | null) => void
}

/** What a new state starts as: one sphere, lit by the default rig, nothing else.
 *
 *  A blank scene is a worse starting point than it sounds — an empty viewport gives you nothing
 *  to judge a material or a light against, so the first thing anyone does is add a sphere. Doing
 *  it for them costs nothing and means *New state* lands somewhere you can immediately work. */
function defaultScene(): SceneObject[] {
  // `proc-sphere`, the morphable one — it can become any of the other procedural shapes without
  // being replaced, so the starting object is the one with the most room to become something else.
  return [buildObject('proc-sphere')]
}

const EMPTY_PROJECT: Project = {
  name: 'Untitled Project',
  bpm: null,
  statesLibrary: {},
  timelineStrips: [],
  markers: [],
}

/** Put a state's scene on screen. The one place that writes the three stores at once. */
function loadState(state: VisualState): void {
  useSceneStore.setState({ objects: state.objects, palette: state.palette, selectedId: null })
  useModulationStore.setState({ connections: state.connections })
  usePostStore.setState({ effects: state.post, bypassed: state.postBypassed, selectedId: null })
  // Followers carry envelope memory keyed by connection id. Restoring a different set of wires
  // without dropping them leaves a resurrected wire mid-envelope, so the first frame would be
  // wrong (same reason the undo path resets).
  ModulationMatrix.reset()
}

/** An independent copy of a state: new ids throughout, so editing one cannot reach the other. */
function cloneState(source: VisualState, id: ID, name: string): VisualState {
  const objectIds = new Map<ID, ID>()
  const objects = source.objects.map((object) => {
    const newId = generateId()
    objectIds.set(object.id, newId)
    return { ...object, id: newId, effects: object.effects.map((e) => ({ ...e })) }
  })

  return {
    id,
    name,
    color: source.color,
    objects,
    // Wires whose target object was copied are re-pointed at the copy. One aimed at something
    // outside this state's scene — the camera, the world — keeps its address, because those are
    // project-global and the copy should drive them too.
    connections: source.connections.map((connection) => ({
      ...connection,
      id: generateId(),
      target: {
        ...connection.target,
        objectId: objectIds.get(connection.target.objectId) ?? connection.target.objectId,
      },
    })),
    post: source.post.map((effect) => ({ ...effect, id: generateId() })),
    postBypassed: source.postBypassed,
    // Copied by value: a duplicate that shared its palette would recolour the original.
    palette: { ...source.palette, colors: [...source.palette.colors] },
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: EMPTY_PROJECT,
  activeStateId: null,

  newState: (name) => {
    recordChange('New state', ['project', 'scene', 'modulation', 'post'])
    get().commitActiveState()

    const id = generateId()
    const state: VisualState = {
      id,
      name: name ?? `State ${Object.keys(get().project.statesLibrary).length + 1}`,
      color: paletteColor(Object.keys(get().project.statesLibrary).length),
      objects: defaultScene(),
      connections: [],
      post: [],
      postBypassed: false,
      palette: DEFAULT_PALETTE,
    }

    set((s) => ({
      project: { ...s.project, statesLibrary: { ...s.project.statesLibrary, [id]: state } },
      activeStateId: id,
    }))
    loadState(state)
    return id
  },

  duplicateState: (id) => {
    get().commitActiveState()
    const source = get().project.statesLibrary[id]
    if (!source) return null

    recordChange('Duplicate state', ['project', 'scene', 'modulation', 'post'])
    const newId = generateId()

    // Deep enough to be independent: ids are regenerated for objects and wires, so editing the
    // copy cannot reach back into the original. A shallow copy would share object identity, and
    // the two states would silently be one.
    const state = cloneState(source, newId, `${source.name} copy`)

    set((s) => ({
      project: { ...s.project, statesLibrary: { ...s.project.statesLibrary, [newId]: state } },
      activeStateId: newId,
    }))
    loadState(state)
    return newId
  },

  switchState: (id) => {
    if (get().activeStateId === id) return
    const target = get().project.statesLibrary[id]
    if (!target) return

    recordChange('Switch state', ['project', 'scene', 'modulation', 'post'])
    get().commitActiveState()
    set({ activeStateId: id })
    loadState(target)
  },

  activateState: (id) => {
    const target = get().project.statesLibrary[id]
    if (!target || get().activeStateId === id) return
    get().commitActiveState()
    set({ activeStateId: id })
    loadState(target)
  },

  ensureState: () => {
    const { activeStateId, project } = get()
    if (activeStateId && project.statesLibrary[activeStateId]) return

    const existing = Object.values(project.statesLibrary)[0]
    if (existing) {
      set({ activeStateId: existing.id })
      loadState(existing)
      return
    }
    get().newState('State 1')
  },

  commitActiveState: () => {
    const id = get().activeStateId
    if (!id || !get().project.statesLibrary[id]) return

    const scene = useSceneStore.getState()
    const modulation = useModulationStore.getState()
    const post = usePostStore.getState()

    set((s) => ({
      project: {
        ...s.project,
        statesLibrary: {
          ...s.project.statesLibrary,
          [id]: {
            ...s.project.statesLibrary[id],
            objects: scene.objects,
            connections: modulation.connections,
            post: post.effects,
            postBypassed: post.bypassed,
            palette: scene.palette,
          },
        },
      },
    }))
  },

  removeState: (id) => {
    recordChange('Delete state', ['project', 'scene', 'modulation', 'post'])
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

    // Deleting what you were editing has to leave you somewhere, not in a scene belonging to
    // nothing. The next remaining state, or a fresh one.
    if (get().activeStateId === id) {
      const next = Object.values(get().project.statesLibrary)[0]
      if (next) {
        set({ activeStateId: next.id })
        loadState(next)
      } else {
        set({ activeStateId: null })
        get().newState()
      }
    }
  },

  renameState: (id, name) => {
    recordChange('Rename state', ['project'], `state:${id}`)
    set((s) => ({
      project: {
        ...s.project,
        statesLibrary: {
          ...s.project.statesLibrary,
          [id]: { ...s.project.statesLibrary[id], name: name.trim() || s.project.statesLibrary[id].name },
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

/** Section markers and the project's length, for the narrative fields (6C).
 *
 *  Passed into the engine, never imported by it — the same rule as `getLane` and `getPatterns`.
 *  The duration comes from the audio rather than the project: a section's arc has to run to the end
 *  of the song, and the last marker has no end of its own. */
export function getSections(): { markers: readonly SectionMarker[]; duration: number } {
  return {
    markers: useProjectStore.getState().project.markers,
    duration: projectDuration(useAudioStore.getState().tracks),
  }
}
