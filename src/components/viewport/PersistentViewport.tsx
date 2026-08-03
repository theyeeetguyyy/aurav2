import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { DualCameraRig } from './DualCameraRig'
import { EnvironmentRig } from './EnvironmentRig'
import { SceneObjects } from './SceneObjects'
import { ModulationDriver } from './ModulationDriver'
import { PostChain } from './PostChain'
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
        // 'percentage' = PCFShadowMap. R3F's default (`shadows` / 'soft') maps to
        // PCFSoftShadowMap, which Three has deprecated.
        shadows="percentage"
        className="w-full h-full"
        // Stop rendering entirely on pages with no viewport, instead of burning GPU
        // behind an opaque panel.
        frameloop={visible ? 'always' : 'never'}
        onPointerMissed={() => select(null)}
      >
        {/* Before SceneObjects, so the matrix is evaluated before it is read. */}
        <ModulationDriver />
        <DualCameraRig />
        {/* Owns scene.background now — a routable gradient, not a fixed token colour. */}
        <EnvironmentRig />
        <SceneObjects />
        {/* Last in the tree: it takes over the render loop, so everything that writes to
            the scene must have run first. */}
        <PostChain />
      </Canvas>

      {visible && !options.compact && <ViewportHUD />}
    </div>
  )
}
