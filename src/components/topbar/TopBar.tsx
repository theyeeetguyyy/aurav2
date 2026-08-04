import { useState } from 'react'
import { Circle, Settings } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { ShortcutSettingsModal } from '@/components/common/ShortcutSettingsModal'
import { ProjectActions } from '@/components/project/ProjectActions'
import { UndoButtons } from '@/components/project/UndoButtons'

export function TopBar() {
  const projectName = useProjectStore((s) => s.project.name)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <>
      <header
        id="topbar"
        className="h-9 bg-aura-base border-b border-aura-line flex items-center justify-between px-3 select-none shrink-0"
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wider text-aura-accent">AURA</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Studio</span>
        </div>

        {/* Center: Project name */}
        <div className="text-[11px] text-slate-400 font-medium truncate max-w-[300px]">
          {projectName}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <UndoButtons />
          <ProjectActions />
          <button
            id="btn-record"
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-aura-hot hover:bg-aura-surface transition-colors duration-150"
            title="Record — Start capture (Hotkey: R)"
          >
            <Circle className="w-2.5 h-2.5 fill-current" />
            REC
          </button>
          <button
            id="btn-settings"
            onClick={() => setIsSettingsOpen(true)}
            className="text-slate-500 hover:text-slate-200 transition-colors duration-150"
            title="Settings (Shortcuts & Options)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Shortcut Settings Modal */}
      <ShortcutSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  )
}
