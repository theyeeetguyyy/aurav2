import { Canvas } from '@react-three/fiber'
import { DualCameraRig } from './DualCameraRig'
import { DefaultScene } from './DefaultScene'
import { SceneObjects } from './SceneObjects'
import { ViewportHUD } from './ViewportHUD'
import { useSceneStore } from '@/store/useSceneStore'
import { readToken } from '@/utils/tokens'

interface SceneViewportProps {
  showHUD?: boolean
}

/** 3D viewport shell: R3F canvas, dual camera rig, studio environment, HUD overlay.
 *
 *  TODO (Phase 3D / HC-9): this still mounts a Canvas per page, so switching between
 *  the Scene and Camera tabs tears down and rebuilds the WebGL context and every GPU
 *  resource. Both tabs are views of ONE scene. The canvas moves to the app shell and
 *  pages contribute overlays once the SceneGraph singleton lands. */
export function SceneViewport({ showHUD = true }: SceneViewportProps) {
  const select = useSceneStore((s) => s.select)

  return (
    <div className="relative w-full h-full bg-aura-void overflow-hidden select-none">
      {showHUD && <ViewportHUD />}

      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        shadows
        className="w-full h-full"
        // Clicking empty space clears the selection, as in any 3D editor.
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[readToken('--color-aura-viewport-bg', '#09090b')]} />
        <DualCameraRig />
        <DefaultScene />
        <SceneObjects />
      </Canvas>
    </div>
  )
}
