import { useEffect, useRef } from 'react'
import { setViewportSlot, type ViewportSlotOptions } from './viewportSlotRegistry'

/** Reserves space for the persistent 3D viewport (HC-9).
 *
 *  Renders nothing but an empty div. The single app-wide Canvas measures this element
 *  and positions itself over it, so moving the viewport — to another tab, or to a small
 *  monitor panel — never destroys or rebuilds a WebGL context. */
export function ViewportSlot({
  compact,
  interactive,
  gizmos,
  cameraGizmos,
}: ViewportSlotOptions = {}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setViewportSlot(ref.current, { compact, interactive, gizmos, cameraGizmos })
    return () => setViewportSlot(null)
  }, [compact, interactive, gizmos, cameraGizmos])

  return <div ref={ref} className="w-full h-full bg-aura-void" />
}
