import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildPath } from '@/engine/camera/cameraPath'
import { useCameraStore } from '@/store/useCameraStore'
import { CAMERA_GIZMO_LAYER } from './SceneLight'
import { readToken } from '@/utils/tokens'

/** The camera path, drawn in the scene.
 *
 *  A path you cannot see is a list of numbers. This is the same curve the behaviour samples —
 *  built by the same `buildPath`, so what you see is what the camera will travel, including the
 *  centripetal parameterisation that stops it lurching between unevenly spaced waypoints.
 *
 *  On `CAMERA_GIZMO_LAYER`, which only the Camera and Timeline pages enable — it was previously on
 *  the general gizmo layer and therefore drawn on every page, including the export monitor. The
 *  exporter disables it too, so it never reaches the file. */

const CURVE_SEGMENTS = 128

export function CameraPathGizmo() {
  const waypoints = useCameraStore((s) => s.waypoints)
  const pathClosed = useCameraStore((s) => s.pathClosed)

  const curve = useMemo(() => buildPath(waypoints, pathClosed), [waypoints, pathClosed])

  const geometry = useMemo(() => {
    if (!curve) return null
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(CURVE_SEGMENTS))
  }, [curve])

  // Owned here, so it has to be freed here — a new geometry every waypoint edit would otherwise
  // leak a GPU buffer per keystroke.
  useEffect(() => () => geometry?.dispose(), [geometry])

  const accent = readToken('--color-aura-accent', '#6366f1')

  return (
    <>
      {geometry && (
        <line layers-mask={1 << CAMERA_GIZMO_LAYER}>
          <primitive object={geometry} attach="geometry" />
          <lineBasicMaterial color={accent} transparent opacity={0.7} />
        </line>
      )}

      {/* A marker per waypoint, numbered by position in the list rather than labelled — a label
          in 3D needs to face the camera, and the order is already legible from the curve. */}
      {waypoints.map((waypoint, index) => (
        <mesh
          key={waypoint.id}
          position={waypoint.position}
          layers-mask={1 << CAMERA_GIZMO_LAYER}
          raycast={() => {}}
        >
          <sphereGeometry args={[0.6, 12, 8]} />
          <meshBasicMaterial
            color={accent}
            transparent
            // The first waypoint reads solid so the direction of travel is obvious at a glance.
            opacity={index === 0 ? 1 : 0.5}
          />
        </mesh>
      ))}
    </>
  )
}
