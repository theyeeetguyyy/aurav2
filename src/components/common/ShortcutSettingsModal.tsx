import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { X, Keyboard, RotateCcw } from 'lucide-react'
import {
  ShortcutManager,
  chordFromEvent,
  formatChord,
  type ActionID,
  type ShortcutBinding,
} from '@/engine/shortcuts/ShortcutManager'

interface ShortcutSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

/** Subscribe to the manager's bindings so a rebind re-renders the list.
 *  Previously `rebind()` mutated in place with no notification, so the modal never
 *  reflected a change the user had just made. */
function useBindings(): ShortcutBinding[] {
  const manager = ShortcutManager.getInstance()
  const [snapshot, setSnapshot] = useState(() => manager.getBindings())

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      manager.onChange(() => {
        setSnapshot(manager.getBindings())
        onStoreChange()
      }),
    [manager],
  )

  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
  return snapshot
}

export function ShortcutSettingsModal({ isOpen, onClose }: ShortcutSettingsModalProps) {
  const manager = ShortcutManager.getInstance()
  const bindings = useBindings()
  const [capturing, setCapturing] = useState<ActionID | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)

  // While capturing, swallow the next chord and assign it.
  useEffect(() => {
    if (!capturing) return

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.code === 'Escape') {
        setCapturing(null)
        setConflict(null)
        return
      }

      const chord = chordFromEvent(e)
      if (!chord) return // Modifier held alone — keep waiting.

      const clash = manager.rebind(capturing, chord)
      if (clash) {
        setConflict(`${formatChord(chord)} is already used by "${clash.label}"`)
        return
      }
      setCapturing(null)
      setConflict(null)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [capturing, manager])

  // Reset transient UI when the modal closes.
  useEffect(() => {
    if (!isOpen) {
      setCapturing(null)
      setConflict(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const categories = [...new Set(bindings.map((b) => b.category))]

  return (
    // Flat scrim, no backdrop blur — see docs/05-DESIGN-SYSTEM.md §1.
    <div className="fixed inset-0 bg-aura-void/90 z-50 flex items-center justify-center p-4">
      <div className="bg-aura-elevated border border-aura-line rounded-lg w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-aura-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-aura-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-aura-line text-[10px] text-slate-500">
          Click a shortcut to rebind it, then press the new key combination.
          <span className="text-slate-400"> Esc</span> cancels.
        </div>

        {conflict && (
          <div className="px-4 py-2 bg-aura-hot/10 border-b border-aura-line text-[11px] text-aura-hot">
            {conflict}
          </div>
        )}

        <div className="p-4 space-y-4 max-h-105 overflow-y-auto">
          {categories.map((category) => (
            <section key={category}>
              <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                {category}
              </h3>
              <div className="space-y-1">
                {bindings
                  .filter((b) => b.category === category)
                  .map((b) => {
                    const isCapturing = capturing === b.actionId
                    return (
                      <button
                        key={b.actionId}
                        onClick={() => {
                          setCapturing(b.actionId)
                          setConflict(null)
                        }}
                        className="w-full flex items-center justify-between p-2 rounded bg-aura-surface border border-aura-line hover:border-aura-accent text-xs transition-colors text-left"
                      >
                        <span className="font-medium text-slate-200">{b.label}</span>
                        <kbd
                          className={`px-2 py-1 rounded font-mono text-[11px] tabular-nums border ${
                            isCapturing
                              ? 'bg-aura-accent border-aura-accent text-white animate-pulse'
                              : 'bg-aura-base border-aura-line text-aura-accent'
                          }`}
                        >
                          {isCapturing ? 'Press keys…' : formatChord(b.currentChord)}
                        </kbd>
                      </button>
                    )
                  })}
              </div>
            </section>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-aura-line flex justify-between items-center">
          <button
            onClick={() => {
              manager.resetToDefaults()
              setConflict(null)
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-aura-accent hover:bg-indigo-600 rounded text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
