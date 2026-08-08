import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { LayerStack } from '@/components/scene/LayerStack'
import { Inspector } from '@/components/scene/Inspector'

/** Workspace 2 — Scene & Shapes. Where a **state** gets built.
 *
 *  Left: the layer stack and shape library, with the state selector beneath. Centre: the
 *  shared viewport. Right: the inspector.
 *
 *  The centre is a slot, not a Canvas — one renderer serves every 3D page (HC-9).
 *
 *  The left dock is for bringing visual elements IN — the shape library and the layer stack of
 *  what is here. Nothing else. Which state you are editing is a document-level choice and lives in
 *  the top bar; putting it here gave one 280px column two unrelated jobs.
 *
 *  World and post live on their own page (`LookPage`). Four unrelated jobs in one 280px
 *  column meant each got a sliver, and the shape library — a fixed grid — overflowed onto the
 *  rows beneath it. This page is about WHAT is in the scene; Look is about how it looks. */
export function ShapesScenePage() {
  return (
    <WorkspaceLayout
      left={<LayerStack />}
      center={<ViewportSlot />}
      right={<Inspector />}
    />
  )
}
