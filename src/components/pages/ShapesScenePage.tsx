import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { LayerStack } from '@/components/scene/LayerStack'
import { Inspector } from '@/components/scene/Inspector'

/** Workspace 2 — Scene & Shapes.
 *  Left: layer stack + shape library. Centre: the shared viewport. Right: inspector.
 *
 *  The centre is a slot, not a Canvas — one renderer serves every 3D page (HC-9).
 *
 *  World and post used to live in this page's left dock and have moved to their own
 *  workspace (`LookPage`). Four unrelated jobs in one 280px column meant each of them
 *  got a sliver, and the shape library — a fixed-size grid — overflowed onto the rows
 *  beneath it. This page is about WHAT is in the scene; Look is about how it looks.
 */
export function ShapesScenePage() {
  return <WorkspaceLayout left={<LayerStack />} center={<ViewportSlot />} right={<Inspector />} />
}
