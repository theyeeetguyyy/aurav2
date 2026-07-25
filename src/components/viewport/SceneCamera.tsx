import { useEffect } from 'react'
import { PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCameraStore } from '@/store/useCameraStore'
import * as THREE from 'three'

interface SceneCameraProps {
  position?: [number, number, number]
  fov?: number
}

/** Locked Scene Camera at position (default: 0, 0, 50) looking at origin (0, 0, 0).
 *  When active camera switches back to 'scene', it resets position & orientation
 *  to the locked scene camera coordinates. */
export function SceneCamera({ position = [0, 0, 50], fov = 45 }: SceneCameraProps) {
  const activeCamera = useCameraStore((s) => s.activeCamera)
  const { camera } = useThree()

  useEffect(() => {
    if (activeCamera === 'scene') {
      // Reset camera position to locked Scene Camera coordinates
      camera.position.set(position[0], position[1], position[2])
      camera.rotation.set(0, 0, 0)
      camera.lookAt(new THREE.Vector3(0, 0, 0))
      camera.updateMatrixWorld()
    }
  }, [activeCamera, camera, position])

  return (
    <PerspectiveCamera
      makeDefault
      position={position}
      fov={fov}
      near={0.1}
      far={1000}
    />
  )
}
