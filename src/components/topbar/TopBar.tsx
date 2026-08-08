import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { ShortcutSettingsModal } from '@/components/common/ShortcutSettingsModal'
import { ProjectActions } from '@/components/project/ProjectActions'
import { UndoButtons } from '@/components/project/UndoButtons'
import { StateSelector } from './StateSelector'

/** The document bar: which project, which state, and the actions that operate on both.
 *
 *  Everything here is document-level, and nothing else is. That is the rule that decides what
 *  belongs — a control that acts on the *contents* of a state goes in that state's workspace, not
 *  up here where it would be present on every page whether or not it applies.
 *
 *  Two things were removed rather than restyled. **REC** was a button with no handler, wired to
 *  nothing since Phase 1 — it looked like a feature and was a picture of one. And the state
 *  selector came *in*, from a side dock, because which state you are editing is a property of the
 *  document, not of the scene page. */
export function TopBar() {
  const projectName = useProjectStore((s) => s.project.name)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <>
      <header
        id="topbar"
        className="h-9 bg-aura-base border-b border-aura-line flex items-center gap-3 px-3 select-none shrink-0"
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm font-bold tracking-wider text-aura-accent">AURA</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Studio</span>
        </div>

        {/* The project name IS the filename it saves to and the video it exports, so it is a
            field rather than a label. */}
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
          aria-label="Project name"
          title="Used for the saved file and the exported video"
          spellCheck={false}
          className="w-45 shrink-0 h-6 px-1.5 bg-transparent border border-transparent rounded text-[11px] text-slate-300 truncate outline-none hover:border-aura-line focus:border-aura-focus focus:bg-aura-surface transition-colors"
        />

        <StateSelector />

        <span className="flex-1" />

        <div className="flex items-center gap-3 shrink-0">
          <UndoButtons />
          <ProjectActions />
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-slate-500 hover:text-slate-200 transition-colors"
            title="Keyboard shortcuts"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <ShortcutSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}
