import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { SceneCamera } from './SceneCamera'
import { DefaultScene } from './DefaultScene'
import { ViewportHUD } from './ViewportHUD'
import { PreviewCameraControls } from './PreviewCamera'
import { useCameraStore } from '@/store/useCameraStore'

interface SceneViewportProps {
  showHUD?: boolean
}

/** 3D Viewport component containing R3F Canvas, Scene Camera, studio environment,
 *  and optional Camera HUD overlay. */
export function SceneViewport({ showHUD = true }: SceneViewportProps) {
  const activeCamera = useCameraStore((s) => s.activeCamera)

  return (
    <div className="relative w-full h-full bg-aura-void overflow-hidden select-none">
      {/* Camera HUD Overlay */}
      {showHUD && <ViewportHUD />}

      {/* R3F 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        className="w-full h-full"
      >
        {/* Color background */}
        <color attach="background" args={['#09090b']} />

        {/* Scene Camera */}
        <SceneCamera position={[0, 0, 50]} fov={45} />

        {/* Default Lighting & Grid */}
        <DefaultScene />

        {/* WASD Fly controls */}
        {activeCamera === 'preview' && <PreviewCameraControls />}

        {/* Orbit controls when Preview camera active */}
        {activeCamera === 'preview' && (
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={5}
            maxDistance={200}
          />
        )}
      </Canvas>
    </div>
  )
}
