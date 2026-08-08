import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DualCameraEngine } from '@/engine/camera/DualCameraEngine'
import { useCameraStore } from '@/store/useCameraStore'
import { CAMERA_GIZMO_LAYER } from './SceneLight'
import { readToken } from '@/utils/tokens'

/** The Scene Camera, drawn in the scene — and where it will be over time.
 *
 *  Blender always draws the camera object, and draws its animated trajectory as a **motion path**
 *  with a marker per frame. Both exist for the same reason: while you are flying the preview around,
 *  the camera that actually renders is invisible, so you are composing a shot you cannot see the
 *  edge of.
 *
 *  Two things here:
 *
 *  - **A frustum**, at the Scene Camera's resolved position, so you can see where it is and roughly
 *    what it can see. It follows behaviours and modulation, because it reads the resolved transform
 *    rather than the authored one.
 *  - **A motion trail** — where the camera goes across the project. Sampled by walking the path the
 *    Follow Path behaviour would take, which is the part of the movement that is a *shape* rather
 *    than a per-frame sum. Behaviour noise and audio-driven wobble deliberately do not appear: they
 *    are not a trajectory, and drawing a sum of them would be a scribble.
 *
 *  On `CAMERA_GIZMO_LAYER`, so only the pages that asked for camera furniture draw it and the
 *  exporter never does. */

const TRAIL_SAMPLES = 96

export function SceneCameraGizmo() {
  const engine = DualCameraEngine.getInstance()
  const activeCamera = useCameraStore((s) => s.activeCamera)
  const waypoints = useCameraStore((s) => s.waypoints)

  const groupRef = useRef<THREE.Group>(null)
  const accent = readToken('--color-aura-accent', '#6366f1')

  /** A unit frustum, drawn as edges. Scaled to something readable rather than to the real far
   *  plane, which at 2000 m would fill the world. */
  const frustum = useMemo(() => {
    const near = 0
    const far = 8
    const half = 5
    const corners = [
      new THREE.Vector3(-half, -half * 0.56, -far),
      new THREE.Vector3(half, -half * 0.56, -far),
      new THREE.Vector3(half, half * 0.56, -far),
      new THREE.Vector3(-half, half * 0.56, -far),
    ]
    const apex = new THREE.Vector3(0, 0, near)

    const points: THREE.Vector3[] = []
    for (const corner of corners) {
      points.push(apex.clone(), corner.clone())
    }
    for (let i = 0; i < corners.length; i++) {
      points.push(corners[i].clone(), corners[(i + 1) % corners.length].clone())
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])

  useEffect(() => () => frustum.dispose(), [frustum])

  /** The trajectory, from the waypoints the camera would travel. Rebuilt only when they change. */
  const trail = useMemo(() => {
    if (waypoints.length < 2) return null
    const points = waypoints.map(
      ({ position }) => new THREE.Vector3(position[0], position[1], position[2]),
    )
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(TRAIL_SAMPLES))
  }, [waypoints])

  useEffect(() => () => trail?.dispose(), [trail])

  // Follows the RESOLVED transform, so it shows where the camera actually is — including whatever
  // a behaviour or a wire is doing to it this frame. Imperative: it moves every frame (HC-1).
  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    group.position.copy(engine.scenePosition)
    group.quaternion.copy(engine.sceneQuaternion)
  })

  // Pointless while looking through it — you would be inside your own frustum.
  if (activeCamera === 'scene') return null

  return (
    <>
      <group ref={groupRef}>
        <lineSegments layers-mask={1 << CAMERA_GIZMO_LAYER}>
          <primitive object={frustum} attach="geometry" />
          <lineBasicMaterial color={accent} transparent opacity={0.55} />
        </lineSegments>

        {/* A solid nub at the apex, so the camera reads as an object and not only as an outline. */}
        <mesh layers-mask={1 << CAMERA_GIZMO_LAYER} raycast={() => {}}>
          <boxGeometry args={[1.1, 0.8, 1.6]} />
          <meshBasicMaterial color={accent} transparent opacity={0.8} />
        </mesh>
      </group>

      {trail && (
        <line layers-mask={1 << CAMERA_GIZMO_LAYER}>
          <primitive object={trail} attach="geometry" />
          <lineDashedMaterial color={accent} transparent opacity={0.35} dashSize={2} gapSize={2} />
        </line>
      )}
    </>
  )
}
