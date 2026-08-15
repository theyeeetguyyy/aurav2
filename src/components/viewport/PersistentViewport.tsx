import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { DualCameraRig } from './DualCameraRig'
import { EnvironmentRig } from './EnvironmentRig'
import { SceneObjects } from './SceneObjects'
import { ModulationDriver } from './ModulationDriver'
import { TimelineDriver } from './TimelineDriver'
import { CameraRigDriver } from './CameraRigDriver'
import { CameraPathGizmo } from './CameraPathGizmo'
import { SceneCameraGizmo } from './SceneCameraGizmo'
import { PostChain } from './PostChain'
import { ExportBridge } from './ExportBridge'
import { ViewportHUD } from './ViewportHUD'
import {
  getViewportSlot,
  getViewportSlotOptions,
  subscribeViewportSlot,
  type ViewportSlotOptions,
} from './viewportSlotRegistry'
import { useSceneStore } from '@/store/useSceneStore'

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Ceiling on the preview's drawing buffer, in pixels.
 *
 *  Chosen from what the post chain costs rather than from what a GPU can draw: every effect in the
 *  chain is sized from this buffer, and the two half-float composer buffers alone are eight bytes a
 *  pixel each before multisampling. 4 M pixels is a 2560×1560-ish buffer — sharper than any laptop
 *  panel at 1× and comfortably inside what a mid-range GPU will allocate several times over. */
const MAX_BUFFER_PIXELS = 4_000_000

/** The one and only 3D viewport (docs/03-ARCHITECTURE.md HC-9).
 *
 *  Mounted once at the app shell and never unmounted. It positions itself over whichever
 *  `ViewportSlot` is currently on screen, so Scene & Shapes and Camera become two views
 *  of ONE scene rather than two renderers.
 *
 *  Previously each page mounted its own Canvas. Every tab switch therefore destroyed and
 *  rebuilt the WebGL context, the scene graph and every GPU resource — visible in the
 *  console as `THREE.WebGLRenderer: Context Lost`. Browsers also cap live contexts at
 *  roughly 16, so switching tabs enough times would have failed outright. */
export function PersistentViewport() {
  const [rect, setRect] = useState<Rect | null>(null)
  const [options, setOptions] = useState<Required<ViewportSlotOptions>>(getViewportSlotOptions)
  const select = useSceneStore((s) => s.select)

  useEffect(() => {
    let observer: ResizeObserver | null = null

    const measure = () => {
      const element = getViewportSlot()
      if (!element) {
        setRect(null)
        return
      }
      const box = element.getBoundingClientRect()
      setRect((previous) =>
        previous &&
        previous.x === box.x &&
        previous.y === box.y &&
        previous.width === box.width &&
        previous.height === box.height
          ? previous // Bail out — an unchanged rect must not re-render the canvas host.
          : { x: box.x, y: box.y, width: box.width, height: box.height },
      )
    }

    // Re-observe whenever the active slot changes (page switch), and re-measure on
    // anything that can move it (dock resize, panel collapse, window resize).
    const rebind = () => {
      observer?.disconnect()
      const element = getViewportSlot()
      if (element) {
        observer = new ResizeObserver(measure)
        observer.observe(element)
      }
      setOptions(getViewportSlotOptions())
      measure()
    }

    const unsubscribe = subscribeViewportSlot(rebind)
    rebind()
    window.addEventListener('resize', measure)

    return () => {
      unsubscribe()
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const visible = rect !== null

  // Device pixels per CSS pixel, capped by AREA rather than by a constant.
  //
  // A flat `dpr={[1, 2]}` is right for a docked panel and dangerous full screen: 1920×1080 at 2×
  // is a 3840×2160 drawing buffer, and the post chain allocates two half-float buffers over it —
  // 265 MB each before any effect's own targets. That allocation is refused by the driver and takes
  // the WebGL context with it, which is how adding one post effect in full screen killed the
  // viewport. `PostChain` steps its sample count down as a second line of defence; this is the first.
  //
  // At any normal panel size the budget is not reached and this returns 2 exactly as before.
  const dpr = Math.min(
    2,
    Math.max(1, Math.sqrt(MAX_BUFFER_PIXELS / Math.max(1, (rect?.width ?? 1) * (rect?.height ?? 1)))),
  )

  return (
    <div
      className="fixed z-0 overflow-hidden"
      style={{
        left: rect?.x ?? 0,
        top: rect?.y ?? 0,
        // A zero-size drawing buffer is invalid, so keep at least one pixel while hidden.
        width: Math.max(1, rect?.width ?? 1),
        height: Math.max(1, rect?.height ?? 1),
        visibility: visible ? 'visible' : 'hidden',
        // A monitor is for watching, not for orbiting — dragging in it would move the
        // preview camera while the user is trying to read a routing list.
        pointerEvents: visible && options.interactive ? 'auto' : 'none',
      }}
    >
      <Canvas
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        // R3F renders at 1 device pixel per CSS pixel unless told otherwise, so on any HiDPI screen
        // the viewport was the one soft, aliased panel in an otherwise crisp interface — and thin
        // geometry paid for it most: a point sprite four CSS pixels across had four pixels to be a
        // circle in, and became a square. Capped at 2 because the fourth pixel of a 4× display buys
        // nothing visible and costs sixteen times the fragments — and capped again by area above.
        dpr={dpr}
        // 'percentage' = PCFShadowMap. R3F's default (`shadows` / 'soft') maps to
        // PCFSoftShadowMap, which Three has deprecated.
        shadows="percentage"
        className="w-full h-full"
        // Stop rendering entirely on pages with no viewport, instead of burning GPU
        // behind an opaque panel.
        frameloop={visible ? 'always' : 'never'}
        onPointerMissed={() => select(null)}
      >
        {/* Resolves which state is live before the matrix decides which wires to run. */}
        <TimelineDriver />

        {/* Before SceneObjects, so the matrix is evaluated before it is read. */}
        <ModulationDriver />
        {/* Before DualCameraRig: it resolves the Scene Camera transform the rig copies. */}
        <CameraRigDriver />
        <DualCameraRig gizmos={options.gizmos} cameraGizmos={options.cameraGizmos} />
        {/* Mounted only where it belongs. The layer mask alone would be enough to hide it, but not
            building the curve at all is cheaper and says the intent more plainly. */}
        {options.cameraGizmos && (
          <>
            <CameraPathGizmo />
            <SceneCameraGizmo />
          </>
        )}
        {/* Owns scene.background now — a routable gradient, not a fixed token colour. */}
        <EnvironmentRig />
        <SceneObjects />
        {/* Last in the tree: it takes over the render loop, so everything that writes to
            the scene must have run first. */}
        <PostChain />
        {/* Last: it publishes the finished render path to the exporter. */}
        <ExportBridge />
      </Canvas>

      {visible && !options.compact && <ViewportHUD />}
    </div>
  )
}
