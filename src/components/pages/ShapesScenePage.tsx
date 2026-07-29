import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { LayerStack } from '@/components/scene/LayerStack'
import { Inspector } from '@/components/scene/Inspector'

/** Workspace 2 — Scene & Shapes.
 *  Left: layer stack + brick library. Centre: the shared viewport. Right: inspector.
 *
 *  The centre is a slot, not a Canvas — one renderer serves every 3D page (HC-9). */
export function ShapesScenePage() {
  return <WorkspaceLayout left={<LayerStack />} center={<ViewportSlot />} right={<Inspector />} />
}
