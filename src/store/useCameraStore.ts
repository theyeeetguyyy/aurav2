import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import type { CameraMode, CameraControlMode } from '@/types/camera'
import type { ID } from '@/types/audio'
import type { ParamValue } from '@/types/params'
import type { EffectInstance } from '@/types/visual'
import { CAMERA_STACK_ID, behaviourDefaults, getBehaviour } from '@/engine/camera/behaviours'
import {
  CAMERA_TRANSFORM_DEFAULTS,
  cameraTransformFromQuaternion,
  type CameraTransformKey,
} from '@/engine/camera/cameraTransform'
import type { CameraWaypoint } from '@/engine/camera/cameraPath'
import { DualCameraEngine } from '@/engine/camera/DualCameraEngine'
import { useModulationStore } from '@/store/useModulationStore'
import { generateId } from '@/utils/stemColors'

interface CameraState {
  /** Active camera: 'scene' (locked render cam) or 'preview' (WASD fly) */
  activeCamera: CameraMode
  /** Control mode for preview camera */
  controlMode: CameraControlMode
  /** The Scene Camera's authored transform — position, rotation in degrees, and fov.
   *  Ordinary parameters (HC-5), so they are routing targets and automation lanes can draw
   *  them, which is what makes the camera keyframable without a keyframe engine. */
  transform: Record<string, number>

  /** The path the Follow Path behaviour reads. Geometry only — *when* the camera is where is a
   *  parameter, not a property of a waypoint (see `cameraPath.ts`). */
  waypoints: CameraWaypoint[]
  /** Whether the path loops back on itself. */
  pathClosed: boolean

  /** Ordered behaviour stack on the Scene Camera — orbit, sway, shake, dolly, lens.
   *  Every behaviour is a pure function of time, so they sum and the order is cosmetic. */
  behaviours: EffectInstance[]
  /** Object the Scene Camera orbits and aims at. null = the world origin. */
  lookAtId: ID | null
  /** Whether the Scene Camera aims at its target at all. Off means it holds its
   *  authored rotation, which is what you want for a locked-off shot. */
  lookAtEnabled: boolean

  setActiveCamera: (mode: CameraMode) => void
  setControlMode: (mode: CameraControlMode) => void

  /** Add a waypoint where the preview camera is now — the fastest way to build a path is to
   *  fly to each place you want the camera to be. */
  addWaypointHere: () => void
  removeWaypoint: (id: ID) => void
  moveWaypoint: (id: ID, position: [number, number, number]) => void
  reorderWaypoint: (id: ID, delta: number) => void
  setPathClosed: (closed: boolean) => void

  setTransformParam: (key: CameraTransformKey, value: number) => void
  /** Copy the preview camera's framing onto the authored transform. */
  alignToPreview: () => void
  resetTransform: () => void

  addBehaviour: (brickId: string) => ID | null
  removeBehaviour: (id: ID) => void
  reorderBehaviour: (id: ID, delta: number) => void
  setBehaviourEnabled: (id: ID, enabled: boolean) => void
  setBehaviourParam: (id: ID, paramKey: string, value: ParamValue) => void

  setLookAt: (objectId: ID | null) => void
  setLookAtEnabled: (enabled: boolean) => void
  clear: () => void
}

export const useCameraStore = create<CameraState>((set) => ({
  activeCamera: 'preview',
  controlMode: 'orbit',
  transform: { ...CAMERA_TRANSFORM_DEFAULTS },
  waypoints: [],
  pathClosed: false,
  behaviours: [],
  lookAtId: null,
  lookAtEnabled: true,

  setActiveCamera: (mode) => set({ activeCamera: mode }),
  setControlMode: (mode) => set({ controlMode: mode }),

  addWaypointHere: () => {
    recordChange('Add waypoint', ['camera'])
    const { previewPosition } = DualCameraEngine.getInstance()
    set((s) => ({
      waypoints: [
        ...s.waypoints,
        {
          id: generateId(),
          position: [previewPosition.x, previewPosition.y, previewPosition.z],
        },
      ],
    }))
  },

  removeWaypoint: (id) => {
    recordChange('Remove waypoint', ['camera'])
    set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) }))
  },

  moveWaypoint: (id, position) => {
    recordChange('Move waypoint', ['camera'], `waypoint:${id}`)
    set((s) => ({
      waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, position } : w)),
    }))
  },

  reorderWaypoint: (id, delta) => {
    recordChange('Reorder waypoint', ['camera'])
    set((s) => {
      const from = s.waypoints.findIndex((w) => w.id === id)
      if (from === -1) return s
      const to = Math.max(0, Math.min(s.waypoints.length - 1, from + delta))
      if (from === to) return s
      const waypoints = [...s.waypoints]
      const [moved] = waypoints.splice(from, 1)
      waypoints.splice(to, 0, moved)
      return { waypoints }
    })
  },

  setPathClosed: (closed) => {
    recordChange(closed ? 'Close path' : 'Open path', ['camera'])
    set({ pathClosed: closed })
  },

  setTransformParam: (key, value) => {
    // Coalesced per parameter, so dragging a field is one undo step rather than one per pixel.
    recordChange('Move camera', ['camera'], `camtx:${key}`)
    set((s) => ({ transform: { ...s.transform, [key]: value } }))
  },

  alignToPreview: () => {
    recordChange('Align camera to view', ['camera'])
    const engine = DualCameraEngine.getInstance()
    set((s) => ({
      transform: {
        ...s.transform,
        'position.x': engine.previewPosition.x,
        'position.y': engine.previewPosition.y,
        'position.z': engine.previewPosition.z,
        ...cameraTransformFromQuaternion(engine.previewQuaternion),
        fov: engine.previewFov,
      },
    }))
  },

  resetTransform: () => {
    recordChange('Reset camera', ['camera'])
    set({ transform: { ...CAMERA_TRANSFORM_DEFAULTS } })
  },

  addBehaviour: (brickId) => {
    recordChange('Add camera behaviour', ['camera'])
    const brick = getBehaviour(brickId)
    if (!brick) return null
    const id = generateId()
    set((s) => ({
      behaviours: [
        ...s.behaviours,
        {
          id,
          effectId: brickId,
          name: brick.label,
          family: 'instancing',
          params: behaviourDefaults(brickId),
          enabled: true,
        },
      ],
    }))
    return id
  },

  removeBehaviour: (id) => {
    recordChange('Remove camera behaviour', ['camera', 'modulation'])
    // A behaviour's parameters are modulation targets, so removing it must drop the
    // wires pointing at them — exactly as removing a deformer does.
    useModulationStore.getState().releaseEffect(CAMERA_STACK_ID, id)
    set((s) => ({ behaviours: s.behaviours.filter((b) => b.id !== id) }))
  },

  reorderBehaviour: (id, delta) => {
    recordChange('Reorder behaviour', ['camera'])
    set((s) => {
      const from = s.behaviours.findIndex((b) => b.id === id)
      if (from === -1) return s
      const to = Math.max(0, Math.min(s.behaviours.length - 1, from + delta))
      if (from === to) return s
      const behaviours = [...s.behaviours]
      const [moved] = behaviours.splice(from, 1)
      behaviours.splice(to, 0, moved)
      return { behaviours }
    })
  },

  setBehaviourEnabled: (id, enabled) => {
    recordChange(enabled ? 'Enable behaviour' : 'Disable behaviour', ['camera'])
    set((s) => ({
      behaviours: s.behaviours.map((b) => (b.id === id ? { ...b, enabled } : b)),
    }))
  },

  setBehaviourParam: (id, paramKey, value) => {
    recordChange('Edit camera behaviour', ['camera'], `cam:${id}:${paramKey}`)
    set((s) => ({
      behaviours: s.behaviours.map((b) =>
        b.id === id ? { ...b, params: { ...b.params, [paramKey]: value } } : b,
      ),
    }))
  },

  setLookAt: (objectId) => {
    recordChange('Change look-at target', ['camera'])
    set({ lookAtId: objectId })
  },
  setLookAtEnabled: (enabled) => {
    recordChange(enabled ? 'Enable aiming' : 'Disable aiming', ['camera'])
    set({ lookAtEnabled: enabled })
  },

  clear: () =>
    set({
      behaviours: [],
      transform: { ...CAMERA_TRANSFORM_DEFAULTS },
      waypoints: [],
      pathClosed: false,
      lookAtId: null,
    }),
}))
