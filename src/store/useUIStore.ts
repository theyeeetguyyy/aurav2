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
  /** Dock collapse state captured on entering immersive view, restored on exit. */
  preImmersiveDocks: { left: boolean; right: boolean; bottom: boolean } | null
  /** Patchbay column widths. Separate from the dock widths — the patchbay lives inside
   *  the centre area and has its own two resizable columns. */
  patchSourceWidth: number
  patchTargetWidth: number

  // Actions
  setActivePage: (page: WorkspacePage) => void
  toggleImmersiveView: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleBottomPanel: () => void
  setLeftPanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  setBottomPanelHeight: (h: number) => void
  setPatchSourceWidth: (w: number) => void
  setPatchTargetWidth: (w: number) => void
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
  preImmersiveDocks: null,
  patchSourceWidth: 280,
  patchTargetWidth: 300,

  setActivePage: (page) => set({ activePage: page }),

  /** Immersive view hides all docks, then restores exactly what was open before.
   *  Previously it force-expanded all three on exit, discarding any panel the user
   *  had deliberately collapsed. */
  toggleImmersiveView: () =>
    set((s) => {
      if (!s.immersiveView) {
        return {
          immersiveView: true,
          preImmersiveDocks: {
            left: s.leftPanelCollapsed,
            right: s.rightPanelCollapsed,
            bottom: s.bottomPanelCollapsed,
          },
          leftPanelCollapsed: true,
          rightPanelCollapsed: true,
          bottomPanelCollapsed: true,
        }
      }

      const previous = s.preImmersiveDocks
      return {
        immersiveView: false,
        preImmersiveDocks: null,
        leftPanelCollapsed: previous?.left ?? false,
        rightPanelCollapsed: previous?.right ?? false,
        bottomPanelCollapsed: previous?.bottom ?? false,
      }
    }),
  toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelCollapsed: !s.bottomPanelCollapsed })),
  setLeftPanelWidth: (w) => set({ leftPanelWidth: Math.max(200, Math.min(480, w)) }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: Math.max(200, Math.min(480, w)) }),
  setBottomPanelHeight: (h) => set({ bottomPanelHeight: Math.max(120, Math.min(400, h)) }),
  setPatchSourceWidth: (w) => set({ patchSourceWidth: clampColumn(w) }),
  setPatchTargetWidth: (w) => set({ patchTargetWidth: clampColumn(w) }),
}))

/** Keep a patchbay column wide enough to read a label and narrow enough to leave a wire
 *  gutter. Below ~160px the parameter names truncate to uselessness. */
function clampColumn(width: number): number {
  return Math.max(160, Math.min(600, width))
}
