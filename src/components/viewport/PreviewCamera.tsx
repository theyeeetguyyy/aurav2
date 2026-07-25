import { useFrame } from '@react-three/fiber'
import { DualCameraEngine } from '@/engine/camera/DualCameraEngine'

/** Frame hook that updates Preview Camera position via WASD fly movement */
export function PreviewCameraControls() {
  const engine = DualCameraEngine.getInstance()

  useFrame(({ camera }) => {
    engine.updateFlyMovement(camera, 0.4)
  })

  return null
}
