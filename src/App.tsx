import { TopBar } from '@/components/topbar/TopBar'
import { WorkspaceNavBar } from '@/components/workspace/WorkspaceNavBar'
import { TransportBar } from '@/components/shell/TransportBar'
import { MediaStemsPage } from '@/components/pages/MediaStemsPage'
import { ShapesScenePage } from '@/components/pages/ShapesScenePage'
import { NodeGraphPage } from '@/components/pages/NodeGraphPage'
import { CameraPage } from '@/components/pages/CameraPage'
import { DeliverPage } from '@/components/pages/DeliverPage'
import { useUIStore } from '@/store/useUIStore'

function ActivePage() {
  const activePage = useUIStore((s) => s.activePage)

  switch (activePage) {
    case 'media-stems':
      return <MediaStemsPage />
    case 'scene-shapes':
      return <ShapesScenePage />
    case 'routing':
      return <NodeGraphPage />
    case 'camera':
      return <CameraPage />
    case 'deliver':
      return <DeliverPage />
  }
}

export default function App() {
  return (
    <div
      id="app-shell"
      className="h-screen w-screen bg-aura-void flex flex-col overflow-hidden"
    >
      {/* ─── Top Bar ─── */}
      <TopBar />

      {/* ─── Main Content Area ─── */}
      <main className="flex-1 min-h-0 bg-aura-base">
        <ActivePage />
      </main>

      {/* ─── Persistent Transport Strip ─── */}
      <TransportBar />

      {/* ─── Workspace Navigation ─── */}
      <WorkspaceNavBar />
    </div>
  )
}
