import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { DualCameraEngine } from '@/engine/camera/DualCameraEngine'
import { useCameraStore } from '@/store/useCameraStore'
import { GIZMO_LAYER } from './SceneLight'

/** DualCameraRig — two real cameras, one output (docs/03-ARCHITECTURE.md HC-10).
 *
 *  Both PerspectiveCameras exist for the whole session. The `activeCamera` store value
 *  only chooses which one R3F renders through; it never transfers state between them.
 *
 *  This replaces an earlier single-camera implementation in which "preview" moved the
 *  render camera itself — the exact inverse of the specification — and in which
 *  OrbitControls and the WASD fly loop were both mounted at once, fighting over
 *  `camera.position` every frame. Control schemes are now mutually exclusive. */
export function DualCameraRig() {
  const activeCamera = useCameraStore((s) => s.activeCamera)
  const controlMode = useCameraStore((s) => s.controlMode)

  const engine = DualCameraEngine.getInstance()
  const sceneCamRef = useRef<THREE.PerspectiveCamera>(null)
  // State, not a ref: OrbitControls needs the camera instance during render, and a
  // ref alone would still be null on the first pass.
  const [previewCam, setPreviewCam] = useState<THREE.PerspectiveCamera | null>(null)

  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const domElement = useThree((s) => s.gl.domElement)

  const isPreview = activeCamera === 'preview'
  const isFlying = isPreview && controlMode === 'fly'

  // Restore the stored preview transform once the camera object exists.
  useEffect(() => {
    if (previewCam) engine.restorePreview(previewCam)
  }, [previewCam, engine])

  // Authoring gizmos — light positions, and anything else with no geometry of its own —
  // live on their own layer. Both cameras show it while authoring so a light can be seen
  // and clicked from either view; the exporter disables it on the Scene Camera so none of
  // it reaches the rendered video.
  useEffect(() => {
    sceneCamRef.current?.layers.enable(GIZMO_LAYER)
    previewCam?.layers.enable(GIZMO_LAYER)
  }, [previewCam])

  // Bind whichever camera is active as R3F's render camera, and keep aspect correct.
  // Done explicitly rather than via drei's `makeDefault` on two components, whose
  // mount/unmount effect ordering would race when toggling between them.
  useEffect(() => {
    const camera = activeCamera === 'scene' ? sceneCamRef.current : previewCam
    if (!camera) return
    camera.aspect = size.width / Math.max(1, size.height)
    camera.updateProjectionMatrix()
    set({ camera })
  }, [activeCamera, previewCam, set, size])

  // Attach fly input only while actually flying.
  useEffect(() => {
    if (!isFlying) return
    return engine.attach(domElement)
  }, [isFlying, engine, domElement])

  useFrame((_, delta) => {
    // Scene camera is authoritative from the engine and is never touched by controls.
    const sceneCam = sceneCamRef.current
    if (sceneCam) {
      sceneCam.position.copy(engine.scenePosition)
      sceneCam.quaternion.copy(engine.sceneQuaternion)
      if (sceneCam.fov !== engine.sceneFov) {
        sceneCam.fov = engine.sceneFov
        sceneCam.updateProjectionMatrix()
      }
    }

    if (!isPreview || !previewCam) return

    if (controlMode === 'fly') {
      // Clamp delta so a backgrounded tab does not launch the camera on return.
      engine.updateFlyMovement(previewCam, Math.min(delta, 0.1))
    }
    // Persist preview state each frame so switching Fly <-> Orbit is seamless.
    engine.capturePreview(previewCam)
  })

  return (
    <>
      <perspectiveCamera ref={sceneCamRef} fov={45} near={0.1} far={2000} />
      <perspectiveCamera ref={setPreviewCam} fov={50} near={0.1} far={2000} />

      {isPreview && controlMode === 'orbit' && previewCam && (
        <OrbitControls
          camera={previewCam}
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={500}
          onEnd={() => engine.syncAnglesFrom(previewCam.quaternion)}
        />
      )}
    </>
  )
}
