import { create } from 'zustand'

/** Workspace tabs matching DaVinci Resolve page model */
export type WorkspacePage =
  | 'media-stems'
  | 'scene-shapes'
  | 'routing'
  | 'camera'
  | 'deliver'

interface UIState {
  /** Currently active workspace page */
  activePage: WorkspacePage
  /** Whether immersive view is active (H key) */
  immersiveView: boolean
  /** Left panel collapsed */
  leftPanelCollapsed: boolean
  /** Right panel collapsed */
  rightPanelCollapsed: boolean
  /** Bottom panel collapsed */
  bottomPanelCollapsed: boolean
  /** Left panel width */
  leftPanelWidth: number
  /** Right panel width */
  rightPanelWidth: number
  /** Bottom panel height */
  bottomPanelHeight: number

  // Actions
  setActivePage: (page: WorkspacePage) => void
  toggleImmersiveView: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleBottomPanel: () => void
  setLeftPanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  setBottomPanelHeight: (h: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  activePage: 'scene-shapes',
  immersiveView: false,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  bottomPanelCollapsed: false,
  leftPanelWidth: 260,
  rightPanelWidth: 320,
  bottomPanelHeight: 240,

  setActivePage: (page) => set({ activePage: page }),
  toggleImmersiveView: () =>
    set((s) => ({
      immersiveView: !s.immersiveView,
      leftPanelCollapsed: !s.immersiveView ? true : false,
      rightPanelCollapsed: !s.immersiveView ? true : false,
      bottomPanelCollapsed: !s.immersiveView ? true : false,
    })),
  toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelCollapsed: !s.bottomPanelCollapsed })),
  setLeftPanelWidth: (w) => set({ leftPanelWidth: Math.max(200, Math.min(480, w)) }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: Math.max(200, Math.min(480, w)) }),
  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(120, Math.min(400, h)) }),
}))
