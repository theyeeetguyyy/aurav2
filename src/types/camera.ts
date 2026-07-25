import type { ID } from './audio'

export type CameraMode = 'scene' | 'preview'
export type CameraControlMode = 'fly' | 'orbit'

export interface SceneCamera {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  fov: number
}

export interface PreviewCamera {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  fov: number
  controlMode: CameraControlMode
}

export interface CameraKeyframe {
  id: ID
  time: number
  position: [number, number, number]
  quaternion: [number, number, number, number]
  fov: number
  easing: EasingType
}

export type EasingType = 'linear' | 'smooth' | 'bezier' | 'step'

export interface SplineWaypoint {
  id: ID
  position: [number, number, number]
  /** Optional look-at target point */
  lookAt: [number, number, number] | null
}

export type CameraConstraintType = 'follow-path' | 'look-at' | 'child-of'

export interface CameraConstraint {
  id: ID
  type: CameraConstraintType
  /** Target shape ID for look-at, or spline ID for follow-path */
  targetId: ID | null
  /** Blend influence 0–1 */
  influence: number
  enabled: boolean
}
