import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { registerFrameSource } from '@/engine/export/types'
import { GIZMO_LAYER } from './SceneLight'

/** Publishes the live renderer to the exporter.
 *
 *  Mounted inside the Canvas so it can reach R3F's renderer, scene and `advance()`. The
 *  exporter drives THIS renderer rather than building its own, which is what makes
 *  "preview is exactly what renders" true by construction rather than by discipline. */
export function ExportBridge() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const advance = useThree((s) => s.advance)
  const get = useThree((s) => s.get)
  const set = useThree((s) => s.set)

  useEffect(() => {
    registerFrameSource({
      canvas: gl.domElement,

      begin(width, height) {
        const previous = new THREE.Vector2()
        gl.getSize(previous)
        const previousCamera = get().camera
        const previousFrameloop = get().frameloop

        // The exporter drives every frame by hand. Leaving R3F's rAF running would
        // interleave wall-clock frames into the same useFrame subscribers, and anything
        // reading `delta` — feedback decay, grain — would see garbage between real frames.
        set({ frameloop: 'never' })

        // HC-10: the Scene Camera is the only camera that renders output. Whatever the
        // user happens to be looking through, the export uses that one.
        const sceneCamera = scene.getObjectByName(SCENE_CAMERA_NAME) as
          | THREE.PerspectiveCamera
          | undefined

        if (sceneCamera) {
          sceneCamera.aspect = width / Math.max(1, height)
          sceneCamera.updateProjectionMatrix()
          // Authoring gizmos are viewport furniture. They must never reach the file.
          sceneCamera.layers.disable(GIZMO_LAYER)
          set({ camera: sceneCamera })
        }

        // `updateStyle: false` — the drawing buffer changes size, the CSS box does not,
        // so the viewport does not visibly resize while rendering.
        gl.setSize(width, height, false)

        return () => {
          gl.setSize(previous.x, previous.y, false)
          if (sceneCamera) {
            sceneCamera.aspect = previous.x / Math.max(1, previous.y)
            sceneCamera.updateProjectionMatrix()
            sceneCamera.layers.enable(GIZMO_LAYER)
          }
          set({ camera: previousCamera, frameloop: previousFrameloop })
        }
      },

      renderFrame(time) {
        // `advance` runs every useFrame subscriber and then renders — modulation, scene
        // objects, camera behaviours and the post chain, in their normal order. The
        // timestamp is derived from the frame's own time, never from a wall clock.
        advance(time * 1000, true)
      },
    })

    return () => registerFrameSource(null)
  }, [gl, scene, advance, get, set])

  return null
}

/** The Scene Camera identifies itself by name so the exporter can find it without the
 *  camera rig having to publish a ref through a store. */
export const SCENE_CAMERA_NAME = 'aura-scene-camera'
