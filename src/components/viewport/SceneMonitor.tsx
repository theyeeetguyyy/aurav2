import { Video } from 'lucide-react'
import { ViewportSlot } from './ViewportSlot'
import { useSceneStore } from '@/store/useSceneStore'

/** Live scene monitor for pages that are not the 3D viewport.
 *
 *  Uses the same `ViewportSlot` mechanism as the full viewport, so the ONE renderer
 *  simply moves here (HC-9). There is no second Canvas and no second WebGL context —
 *  which is also why what you see is exactly the real scene, modulation included, rather
 *  than a preview of it.
 *
 *  Non-interactive on purpose: dragging inside a monitor while reading a routing list
 *  would fly the preview camera by accident. */
export function SceneMonitor() {
  const objectCount = useSceneStore((s) => s.objects.length)

  return (
    <div className="shrink-0 border-t border-aura-line">
      <header className="flex items-center gap-1.5 px-2 py-1.5">
        <Video className="w-3 h-3 text-slate-500" />
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500 flex-1">Scene</h3>
        <span className="text-[9px] font-mono tabular-nums text-slate-600">
          {objectCount} {objectCount === 1 ? 'obj' : 'objs'}
        </span>
      </header>

      <div className="h-40 relative">
        {objectCount === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-aura-void">
            <p className="text-[10px] text-slate-600 text-center px-3">
              Scene is empty
            </p>
          </div>
        ) : (
          <ViewportSlot compact interactive={false} />
        )}
      </div>
    </div>
  )
}
