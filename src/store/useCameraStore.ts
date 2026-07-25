import { create } from 'zustand'
import type { CameraKeyframe, SplineWaypoint, CameraConstraint, CameraMode, CameraControlMode } from '@/types/camera'
import type { ID } from '@/types/audio'

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
}

export const useCameraStore = create<CameraState>((set) => ({
  activeCamera: 'preview',
  controlMode: 'orbit',
  keyframes: [],
  waypoints: [],
  constraints: [],

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

  addConstraint: (c) => set((s) => ({ constraints: [...s.constraints, c] })),
  removeConstraint: (id) =>
    set((s) => ({ constraints: s.constraints.filter((c) => c.id !== id) })),
  updateConstraint: (id, patch) =>
    set((s) => ({
      constraints: s.constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
}))
