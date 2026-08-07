import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAMERA_STACK_ID,
  emptyRig,
  getBehaviour,
  resetRig,
  type BehaviourContext,
} from '@/engine/camera/behaviours'
import {
  CAMERA_TRANSFORM_DEFAULTS,
  cameraQuaternionFrom,
} from '@/engine/camera/cameraTransform'
import { DualCameraEngine } from '@/engine/camera/DualCameraEngine'
import { ModulationMatrix, addressKey } from '@/engine/modulation/ModulationMatrix'
import { activeClock } from '@/engine/time/timeAuthority'
import { useCameraStore } from '@/store/useCameraStore'
import { useSceneStore } from '@/store/useSceneStore'
import type { ParamValue } from '@/types/params'

/** Drives the Scene Camera from its behaviour stack.
 *
 *  This is the piece the whole look was waiting on. Feedback trails, zoom blur and
 *  kaleidoscope are all effects on *motion* — and the only camera that renders had no way
 *  to move. Preview flying looked alive and the actual output did not, which is exactly
 *  what an export would have shown.
 *
 *  Two layers, in order. First the **authored** transform: position, rotation and fov are
 *  ordinary parameters (HC-5), so this resolves them base-plus-modulation exactly like any
 *  other — which is what makes a stem able to drive a dolly and an automation lane able to
 *  keyframe a camera move. Then the **behaviour stack** offsets that result, so orbit and
 *  shake add to where you put the camera rather than replacing it.
 *
 *  Writes to `DualCameraEngine.scene*`, which is the authoritative Scene Camera transform
 *  (HC-10) — `DualCameraRig` copies it onto the real camera object each frame. Nothing
 *  here touches the preview camera, and no interactive control is ever mounted on the
 *  Scene Camera; that inversion is the bug D-26 already fixed once.
 *
 *  Runs before anything reads the camera. Every behaviour is a pure function of clock
 *  time (HC-3), so this is re-entrant: evaluating twice at the same `t` gives the same
 *  camera, which is what makes an out-of-order offline render possible. */
export function CameraRigDriver() {
  const engine = DualCameraEngine.getInstance()

  // Scratch, reused every frame.
  const rig = useMemo(() => emptyRig(), [])
  const context = useRef<BehaviourContext>({ time: 0, params: {}, rig })
  const resolved = useRef<Record<string, ParamValue>>({})
  const basePosition = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const spherical = useMemo(() => new THREE.Spherical(), [])
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const rollQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const forward = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const { behaviours, lookAtId, lookAtEnabled, transform } = useCameraStore.getState()
    const M = ModulationMatrix

    // ─── The authored transform, base plus modulation ───
    // Resolved every frame rather than only on edit, because a wire or a drawn lane changes
    // it without anything touching the store.
    const value = (key: string) =>
      (transform[key] ?? CAMERA_TRANSFORM_DEFAULTS[key as keyof typeof CAMERA_TRANSFORM_DEFAULTS]) +
      M.getOffset(addressKey(CAMERA_STACK_ID, key))

    engine.baseScenePosition.set(value('position.x'), value('position.y'), value('position.z'))
    cameraQuaternionFrom(
      value('rotation.x'),
      value('rotation.y'),
      value('rotation.z'),
      engine.baseSceneQuaternion,
    )
    engine.baseSceneFov = THREE.MathUtils.clamp(value('fov'), 5, 150)

    // ─── The behaviour stack, offsetting that result ───
    // No early return for an empty stack. An empty rig is the identity — zero offsets,
    // distanceScale 1 — so the same path produces the authored transform, and *Aim at target*
    // then works whether or not a behaviour happens to be present. It previously did not,
    // which made a checkbox that is on by default do nothing until you added an Orbit.
    const time = activeClock().time
    resetRig(rig)
    context.current.time = time

    for (const behaviour of behaviours) {
      if (!behaviour.enabled) continue
      const brick = getBehaviour(behaviour.effectId)
      if (!brick) continue

      const values = resolved.current
      for (const key in behaviour.params) {
        const base = behaviour.params[key]
        values[key] =
          typeof base === 'number'
            ? base + M.getOffset(addressKey(CAMERA_STACK_ID, key, behaviour.id))
            : base
      }
      context.current.params = values
      brick.apply(context.current)
    }

    // ─── Resolve the target the camera orbits and aims at ───
    target.set(0, 0, 0)
    if (lookAtId) {
      const object = useSceneStore.getState().objects.find((o) => o.id === lookAtId)
      if (object) {
        const [x, y, z] = object.transform.position
        target.set(
          x + M.getOffset(addressKey(object.id, 'position.x')),
          y + M.getOffset(addressKey(object.id, 'position.y')),
          z + M.getOffset(addressKey(object.id, 'position.z')),
        )
      }
    }

    // Orbit is expressed in spherical coordinates around the target, derived from where
    // the camera already is. That way adding an Orbit behaviour continues from the
    // authored framing instead of teleporting to a canonical starting angle.
    //
    // Skipped entirely when nothing orbits, because the round trip is not a no-op: a camera
    // sitting exactly on its target has radius 0, which the clamp below would push to 0.01
    // and nudge the framing of a shot that asked for no orbit at all.
    basePosition.copy(engine.baseScenePosition)
    if (rig.azimuth !== 0 || rig.elevation !== 0 || rig.distanceScale !== 1) {
      basePosition.sub(target)
      spherical.setFromVector3(basePosition)
      spherical.theta += rig.azimuth
      spherical.phi = THREE.MathUtils.clamp(spherical.phi - rig.elevation, 0.01, Math.PI - 0.01)
      spherical.radius = Math.max(0.01, spherical.radius * rig.distanceScale)
      basePosition.setFromSpherical(spherical).add(target)
    }

    engine.scenePosition.set(
      basePosition.x + rig.offsetX,
      basePosition.y + rig.offsetY,
      basePosition.z + rig.offsetZ,
    )

    if (lookAtEnabled) {
      matrix.lookAt(engine.scenePosition, target, up)
      engine.sceneQuaternion.setFromRotationMatrix(matrix)
    } else {
      engine.sceneQuaternion.copy(engine.baseSceneQuaternion)
    }

    if (rig.roll !== 0) {
      // Roll about the camera's own view axis, applied after aiming. Rolling before
      // would be undone by the look-at.
      forward.set(0, 0, -1).applyQuaternion(engine.sceneQuaternion)
      rollQuaternion.setFromAxisAngle(forward, rig.roll)
      engine.sceneQuaternion.premultiply(rollQuaternion)
    }

    engine.sceneFov = THREE.MathUtils.clamp(engine.baseSceneFov + rig.fovOffset, 5, 150)

  })

  return null
}
