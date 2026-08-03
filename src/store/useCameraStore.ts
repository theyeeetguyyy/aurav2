import { create } from 'zustand'
import type { CameraKeyframe, SplineWaypoint, CameraConstraint, CameraMode, CameraControlMode } from '@/types/camera'
import type { ID } from '@/types/audio'
import type { ParamValue } from '@/types/params'
import type { EffectInstance } from '@/types/visual'
import { behaviourDefaults, getBehaviour } from '@/engine/camera/behaviours'
import { generateId } from '@/utils/stemColors'

interface CameraState {
  /** Active camera: 'scene' (locked render cam) or 'preview' (WASD fly) */
  activeCamera: CameraMode
  /** Control mode for preview camera */
  controlMode: CameraControlMode
  /** Camera keyframes for timeline interpolation */
  keyframes: CameraKeyframe[]
  /** Spline path waypoints */
  waypoints: SplineWaypoint[]
  /** Camera constraints stack */
  constraints: CameraConstraint[]

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

  addKeyframe: (kf: CameraKeyframe) => void
  removeKeyframe: (id: ID) => void
  updateKeyframe: (id: ID, patch: Partial<CameraKeyframe>) => void

  addWaypoint: (wp: SplineWaypoint) => void
  removeWaypoint: (id: ID) => void
  updateWaypoint: (id: ID, patch: Partial<SplineWaypoint>) => void

  addConstraint: (c: CameraConstraint) => void
  removeConstraint: (id: ID) => void
  updateConstraint: (id: ID, patch: Partial<CameraConstraint>) => void

  addBehaviour: (brickId: string) => ID | null
  removeBehaviour: (id: ID) => void
  reorderBehaviour: (id: ID, delta: number) => void
  setBehaviourEnabled: (id: ID, enabled: boolean) => void
  setBehaviourParam: (id: ID, paramKey: string, value: ParamValue) => void

  setLookAt: (objectId: ID | null) => void
  setLookAtEnabled: (enabled: boolean) => void
}

export const useCameraStore = create<CameraState>((set) => ({
  activeCamera: 'preview',
  controlMode: 'orbit',
  keyframes: [],
  waypoints: [],
  constraints: [],
  behaviours: [],
  lookAtId: null,
  lookAtEnabled: true,

  setActiveCamera: (mode) => set({ activeCamera: mode }),
  setControlMode: (mode) => set({ controlMode: mode }),

  addKeyframe: (kf) => set((s) => ({ keyframes: [...s.keyframes, kf] })),
  removeKeyframe: (id) =>
    set((s) => ({ keyframes: s.keyframes.filter((k) => k.id !== id) })),
  updateKeyframe: (id, patch) =>
    set((s) => ({
      keyframes: s.keyframes.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    })),

  addWaypoint: (wp) => set((s) => ({ waypoints: [...s.waypoints, wp] })),
  removeWaypoint: (id) =>
    set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),
  updateWaypoint: (id, patch) =>
    set((s) => ({
      waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    })),

  addBehaviour: (brickId) => {
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

  removeBehaviour: (id) =>
    set((s) => ({ behaviours: s.behaviours.filter((b) => b.id !== id) })),

  reorderBehaviour: (id, delta) =>
    set((s) => {
      const from = s.behaviours.findIndex((b) => b.id === id)
      if (from === -1) return s
      const to = Math.max(0, Math.min(s.behaviours.length - 1, from + delta))
      if (from === to) return s
      const behaviours = [...s.behaviours]
      const [moved] = behaviours.splice(from, 1)
      behaviours.splice(to, 0, moved)
      return { behaviours }
    }),

  setBehaviourEnabled: (id, enabled) =>
    set((s) => ({
      behaviours: s.behaviours.map((b) => (b.id === id ? { ...b, enabled } : b)),
    })),

  setBehaviourParam: (id, paramKey, value) =>
    set((s) => ({
      behaviours: s.behaviours.map((b) =>
        b.id === id ? { ...b, params: { ...b.params, [paramKey]: value } } : b,
      ),
    })),

  setLookAt: (objectId) => set({ lookAtId: objectId }),
  setLookAtEnabled: (enabled) => set({ lookAtEnabled: enabled }),

  addConstraint: (c) => set((s) => ({ constraints: [...s.constraints, c] })),
  removeConstraint: (id) =>
    set((s) => ({ constraints: s.constraints.filter((c) => c.id !== id) })),
  updateConstraint: (id, patch) =>
    set((s) => ({
      constraints: s.constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
}))
