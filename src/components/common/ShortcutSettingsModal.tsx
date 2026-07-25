import { useState, useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { ShortcutManager, type ShortcutBinding } from '@/engine/shortcuts/ShortcutManager'

interface ShortcutSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ShortcutSettingsModal({ isOpen, onClose }: ShortcutSettingsModalProps) {
  const [bindings, setBindings] = useState<ShortcutBinding[]>([])

  useEffect(() => {
    if (isOpen) {
      setBindings(ShortcutManager.getInstance().getBindings())
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-aura-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-aura-elevated border border-aura-line rounded-lg w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
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
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
          {bindings.map((b) => (
            <div
              key={b.actionId}
              className="flex items-center justify-between p-2 rounded bg-aura-surface border border-aura-line text-xs"
            >
              <div>
                <p className="font-medium text-slate-200">{b.label}</p>
                <p className="text-[10px] text-slate-500">{b.category}</p>
              </div>

              <kbd className="px-2 py-1 bg-aura-base border border-aura-line rounded font-mono text-[11px] text-aura-accent">
                {b.currentKey}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-aura-line flex justify-end">
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
