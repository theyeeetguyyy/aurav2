import * as THREE from 'three'
import type { ParamDescriptor } from '@/types/params'

/** The Scene Camera's own transform, as ordinary parameters (HC-5).
 *
 *  This is the piece that was missing. The camera that renders had a transform, but it
 *  lived as raw vectors on `DualCameraEngine` and the only way to change it was
 *  *Align to this view*. That made the one camera that matters the single least controllable
 *  object in the product: no numbers to type, no wires to attach, no curve to draw. The
 *  behaviour stack — orbit, sway, shake — was the *only* way to make it move, so a camera
 *  move had to be picked from a list of five shapes rather than authored.
 *
 *  Registering it here changes that in one move, because everything downstream addresses
 *  parameters rather than enumerating them:
 *
 *  - the panel gets numeric fields, because it renders descriptors
 *  - the patchbay gets nine new targets, so a stem can drive a dolly
 *  - the automation lanes become **camera keyframes** — drawing a curve against `position.z`
 *    is a camera move on a time axis, which is what keyframing is, using the editor that
 *    already exists rather than a second one that would need to agree with it
 *
 *  Behaviours keep working and stay additive on top: they offset the authored value, and
 *  the authored value is now something you can actually author.
 *
 *  Addressed as `@camera` with **no effect id** — same shape as an object's own transform,
 *  where a behaviour id would name a member of the stack instead. */

export const CAMERA_TRANSFORM_KEYS = [
  'position.x',
  'position.y',
  'position.z',
  'rotation.x',
  'rotation.y',
  'rotation.z',
  'fov',
] as const

export type CameraTransformKey = (typeof CAMERA_TRANSFORM_KEYS)[number]

/** Where the camera starts: back along +Z, level, looking at the origin. Matches the
 *  preview camera's default framing so *Align to this view* is not a jump on a fresh file. */
export const CAMERA_TRANSFORM_DEFAULTS: Record<CameraTransformKey, number> = {
  'position.x': 0,
  'position.y': 0,
  'position.z': 50,
  'rotation.x': 0,
  'rotation.y': 0,
  'rotation.z': 0,
  fov: 45,
}

function axis(key: CameraTransformKey, label: string, group: string): ParamDescriptor {
  return {
    key,
    label,
    group,
    type: 'float',
    // Wide enough to leave the scene and get back, and a soft range — a slider bound, not
    // a clamp, so typing a number outside it still works.
    min: -500,
    max: 500,
    step: 0.1,
    defaultValue: CAMERA_TRANSFORM_DEFAULTS[key],
    unit: 'm',
    exposed: true,
    realtime: true,
  }
}

function angle(key: CameraTransformKey, label: string): ParamDescriptor {
  return {
    key,
    label,
    group: 'Rotation',
    type: 'float',
    min: -180,
    max: 180,
    step: 0.5,
    defaultValue: CAMERA_TRANSFORM_DEFAULTS[key],
    unit: 'deg',
    exposed: true,
    realtime: true,
  }
}

export const CAMERA_TRANSFORM_DESCRIPTORS: readonly ParamDescriptor[] = [
  axis('position.x', 'X', 'Position'),
  axis('position.y', 'Y', 'Position'),
  axis('position.z', 'Z', 'Position'),
  angle('rotation.x', 'Pitch'),
  angle('rotation.y', 'Yaw'),
  angle('rotation.z', 'Roll'),
  {
    key: 'fov',
    label: 'Field of view',
    group: 'Lens',
    type: 'float',
    // 5° is a long lens that flattens everything; 150° is a fisheye. Outside that the
    // projection stops being usable rather than becoming more extreme.
    min: 5,
    max: 150,
    step: 0.5,
    defaultValue: CAMERA_TRANSFORM_DEFAULTS.fov,
    unit: 'deg',
    exposed: true,
    realtime: true,
  },
]

export function getCameraTransformDescriptor(key: string): ParamDescriptor | null {
  return CAMERA_TRANSFORM_DESCRIPTORS.find((d) => d.key === key) ?? null
}

/** Rotation order for the camera's Euler angles.
 *
 *  `YXZ` — yaw, then pitch, then roll. The same order every fly camera and every DCC uses
 *  for a camera, and the reason is that pitch stays horizon-relative: with the default
 *  `XYZ`, yawing a pitched camera tilts the horizon, which reads as a bug rather than as
 *  a rotation. */
export const CAMERA_EULER_ORDER = 'YXZ' as const

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

const scratchEuler = new THREE.Euler(0, 0, 0, CAMERA_EULER_ORDER)

/** Authored Euler angles, in degrees, to a quaternion. */
export function cameraQuaternionFrom(
  pitch: number,
  yaw: number,
  roll: number,
  out: THREE.Quaternion,
): THREE.Quaternion {
  scratchEuler.set(pitch * DEG_TO_RAD, yaw * DEG_TO_RAD, roll * DEG_TO_RAD)
  return out.setFromEuler(scratchEuler)
}

/** A quaternion back to the authored parameter values.
 *
 *  Needed by *Align to this view*: the preview camera is flown as a quaternion, and the
 *  authored transform is degrees, so aligning has to convert rather than copy. */
export function cameraTransformFromQuaternion(
  quaternion: THREE.Quaternion,
): { 'rotation.x': number; 'rotation.y': number; 'rotation.z': number } {
  scratchEuler.setFromQuaternion(quaternion, CAMERA_EULER_ORDER)
  return {
    'rotation.x': scratchEuler.x * RAD_TO_DEG,
    'rotation.y': scratchEuler.y * RAD_TO_DEG,
    'rotation.z': scratchEuler.z * RAD_TO_DEG,
  }
}

/** How far animating a camera parameter should move it, by default.
 *
 *  Deliberately **not** the descriptor's `min`/`max`. Those are slider bounds — position runs
 *  ±500m so you can leave the scene and come back — and a drawn 0–1 curve mapped onto ±500 would
 *  fling the camera into the void on its first keyframe. These are the ranges a *move* lives in:
 *  ten metres is a real dolly, forty-five degrees is a real pan.
 *
 *  Centred on zero because the chain's output is **added** to the authored value, so a curve
 *  sitting at 0.5 means "stay where I put it". Widening it afterwards is one field in the wire
 *  inspector; starting somewhere usable is what stops the first attempt looking broken. */
export function cameraAnimationRange(key: string): { min: number; max: number } {
  if (key === 'fov') return { min: -20, max: 20 }
  if (key.startsWith('rotation')) return { min: -45, max: 45 }
  return { min: -10, max: 10 }
}
