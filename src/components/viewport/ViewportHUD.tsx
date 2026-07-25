import { useCameraStore } from '@/store/useCameraStore'

/** Viewport overlay framing the 3D canvas with corner reticles and bottom camera mode switcher. */
export function ViewportHUD() {
  const activeCamera = useCameraStore((s) => s.activeCamera)
  const controlMode = useCameraStore((s) => s.controlMode)
  const setActiveCamera = useCameraStore((s) => s.setActiveCamera)

  return (
    <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between select-none z-10">
      {/* ─── Top Reticles ─── */}
      <div className="flex items-start justify-between">
        <div className="text-slate-600 font-mono text-xs leading-none">┌</div>
        <div className="text-slate-600 font-mono text-xs leading-none">┐</div>
      </div>

      {/* ─── Bottom HUD Row ─── */}
      <div className="flex items-end justify-between">
        {/* Bottom-Left Corner Reticle */}
        <div className="text-slate-600 font-mono text-xs leading-none">└</div>

        {/* Bottom-Center Camera Mode Selector */}
        <div className="flex items-center gap-1 p-1 bg-aura-void/80 border border-aura-line rounded text-[10px] font-mono pointer-events-auto backdrop-blur-sm">
          <button
            onClick={() => setActiveCamera('scene')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeCamera === 'scene'
                ? 'bg-aura-accent text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to locked Scene Camera at (0,0,50)"
          >
            SCENE CAM
          </button>
          <button
            onClick={() => setActiveCamera('preview')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeCamera === 'preview'
                ? 'bg-aura-accent text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to interactive Preview Camera"
          >
            PREVIEW ({controlMode.toUpperCase()})
          </button>
        </div>

        {/* Bottom-Right Corner Reticle */}
        <div className="text-slate-600 font-mono text-xs leading-none">┘</div>
      </div>
    </div>
  )
}
