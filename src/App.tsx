import { useEffect } from 'react'
import { TopBar } from '@/components/topbar/TopBar'
import { WorkspaceNavBar } from '@/components/workspace/WorkspaceNavBar'
import { TransportBar } from '@/components/shell/TransportBar'
import { MediaStemsPage } from '@/components/pages/MediaStemsPage'
import { ShapesScenePage } from '@/components/pages/ShapesScenePage'
import { LookPage } from '@/components/pages/LookPage'
import { NodeGraphPage } from '@/components/pages/NodeGraphPage'
import { CameraPage } from '@/components/pages/CameraPage'
import { DeliverPage } from '@/components/pages/DeliverPage'
import { PersistentViewport } from '@/components/viewport/PersistentViewport'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useUIStore } from '@/store/useUIStore'
import { useAudioStore } from '@/store/useAudioStore'
import { useProjectStore } from '@/store/useProjectStore'
import { ShortcutManager } from '@/engine/shortcuts/ShortcutManager'
import { DEFAULT_SECTION_TYPE } from '@/types/project'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { TransportClock } from '@/engine/time/TransportClock'
import { initHistory, redo, undo } from '@/project/history'

function ActivePage() {
  const activePage = useUIStore((s) => s.activePage)

  switch (activePage) {
    case 'media-stems':
      return <MediaStemsPage />
    case 'scene-shapes':
      return <ShapesScenePage />
    case 'look':
      return <LookPage />
    case 'routing':
      return <NodeGraphPage />
    case 'camera':
      return <CameraPage />
    case 'deliver':
      return <DeliverPage />
  }
}

export default function App() {
  useEffect(() => {
    initHistory()
    const sm = ShortcutManager.getInstance()

    const unsubscribers = [
      sm.subscribe('play-pause', () => {
        const rack = MultiTrackRack.getInstance()
        if (useAudioStore.getState().isPlaying) {
          rack.pause()
        } else {
          rack.play()
        }
      }),
      // Registered in ShortcutManager since Phase 1 and never wired to anything.
      sm.subscribe('undo', () => undo()),
      sm.subscribe('redo', () => redo()),

      sm.subscribe('add-marker', () => {
        useProjectStore
          .getState()
          .placeMarker(TransportClock.time, DEFAULT_SECTION_TYPE)
      }),

      sm.subscribe('toggle-loop', () => {
        useAudioStore.getState().toggleLoop()
      }),
      sm.subscribe('toggle-immersive', () => {
        useUIStore.getState().toggleImmersiveView()
      }),
    ]

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [])

  return (
    <div
      id="app-shell"
      className="h-screen w-screen bg-aura-void flex flex-col overflow-hidden"
    >
      {/* ─── Top Bar ─── */}
      <TopBar />

      {/* ─── Main Content Area ─── */}
      {/* Boundaries are separate so a crashing panel cannot take the renderer with it —
          unmounting the whole tree destroys the one WebGL context and every GPU resource
          in it, which then reports as `Context Lost` and hides the real cause. */}
      <main className="flex-1 min-h-0 bg-aura-base">
        <ErrorBoundary label="This page">
          <ActivePage />
        </ErrorBoundary>
      </main>

      {/* One long-lived 3D renderer for the whole app (HC-9). It positions itself over
          whichever page exposes a ViewportSlot, so switching tabs moves the viewport
          instead of destroying and rebuilding the WebGL context. */}
      <ErrorBoundary label="The viewport">
        <PersistentViewport />
      </ErrorBoundary>

      {/* ─── Persistent Transport Strip ─── */}
      <TransportBar />

      {/* ─── Workspace Navigation ─── */}
      <WorkspaceNavBar />
    </div>
  )
}
