import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { WorldPanel } from '@/components/scene/WorldPanel'
import { PostStack } from '@/components/scene/PostStack'

/** Workspace 3 — Look.
 *
 *  Everything about how the frame LOOKS, as opposed to what is in it. World and lighting
 *  on the left, the post chain on the right, the same one viewport in the middle (HC-9).
 *
 *  Split out from Scene & Shapes because that page's left dock had become the place
 *  everything went: layer stack, shape library, world settings and the post chain in one
 *  280px column, each squeezing the others. These are a different job done at a different
 *  time — you build the scene, then you light and grade it — and they need room for the
 *  detail each deserves rather than a shared sliver. */
export function LookPage() {
  return (
    <WorkspaceLayout
      left={
        <div className="flex flex-col h-full min-h-0">
          <header className="px-3 py-2 border-b border-aura-line shrink-0">
            <h2 className="text-[10px] uppercase tracking-wider text-slate-500">World</h2>
            <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
              What the objects sit in and are lit by.
            </p>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <WorldPanel embedded />
          </div>
        </div>
      }
      center={<ViewportSlot />}
      right={
        <div className="flex flex-col h-full min-h-0">
          <header className="px-3 py-2 border-b border-aura-line shrink-0">
            <h2 className="text-[10px] uppercase tracking-wider text-slate-500">Post</h2>
            <p className="text-[10px] text-slate-600 leading-snug mt-0.5">
              Applied to the whole frame, in order, after everything has drawn.
            </p>
          </header>
          <div className="flex-1 min-h-0 overflow-hidden">
            <PostStack embedded />
          </div>
        </div>
      }
    />
  )
}
