import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { LayerStack } from '@/components/scene/LayerStack'
import { WorldPanel } from '@/components/scene/WorldPanel'
import { PostStack } from '@/components/scene/PostStack'
import { Inspector } from '@/components/scene/Inspector'

/** Workspace 2 — Scene & Shapes.
 *  Left: layer stack + brick library, with the post chain beneath it. Centre: the shared
 *  viewport. Right: inspector.
 *
 *  The centre is a slot, not a Canvas — one renderer serves every 3D page (HC-9).
 *
 *  Post sits under the object list because that is what it is: the last stage of the same
 *  stack, applied after every object has drawn (docs/10-ELEMENTS.md §H). */
export function ShapesScenePage() {
  return (
    <WorkspaceLayout
      left={
        // Ordered the way the frame is built: objects, then the world they sit in, then
        // what happens to the picture afterwards.
        //
        // The layer stack takes the remaining space and scrolls; the two panels below
        // size to their content and cap themselves. Wrapping them in sized divs instead
        // let their content overflow the box and draw over the rows above.
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <LayerStack />
          </div>
          <WorldPanel />
          <PostStack />
        </div>
      }
      center={<ViewportSlot />}
      right={<Inspector />}
    />
  )
}
