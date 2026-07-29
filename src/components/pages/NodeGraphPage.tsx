import { useState } from 'react'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { Patchbay } from '@/components/routing/patchbay/Patchbay'
import { WireInspector } from '@/components/routing/WireInspector'
import { SceneMonitor } from '@/components/viewport/SceneMonitor'

/** Workspace 3 — Routing.
 *
 *  Patchbay in the centre: sources left, parameters right, live wires between. One drag
 *  connects. See docs/11-ROUTING-UX.md for why this rather than a node canvas (D-34).
 *
 *  The scene monitor stays pinned bottom-left — wiring while watching the result is the
 *  entire point, and it costs no extra WebGL context (HC-9). */
export function NodeGraphPage() {
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null)

  return (
    <WorkspaceLayout
      center={
        <Patchbay
          selectedWireId={selectedWireId}
          onSelectWire={setSelectedWireId}
          bottomLeft={<SceneMonitor />}
        />
      }
      right={<WireInspector wireId={selectedWireId} onClear={() => setSelectedWireId(null)} />}
    />
  )
}
