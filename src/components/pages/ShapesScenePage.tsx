import { SceneViewport } from '@/components/viewport/SceneViewport'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { LayerStack } from '@/components/scene/LayerStack'
import { Inspector } from '@/components/scene/Inspector'

/** Workspace 2 — Scene & Shapes.
 *  Left: layer stack + brick library. Centre: viewport. Right: parameter inspector. */
export function ShapesScenePage() {
  return (
    <WorkspaceLayout
      left={<LayerStack />}
      center={<SceneViewport />}
      right={<Inspector />}
    />
  )
}
