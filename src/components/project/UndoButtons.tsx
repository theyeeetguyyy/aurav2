import { useSyncExternalStore } from 'react'
import { Redo2, Undo2 } from 'lucide-react'
import { CommandHistory } from '@/engine/commands/CommandHistory'
import { redo, undo } from '@/project/history'

/** Undo / redo, with the pending action's name in the tooltip.
 *
 *  `useSyncExternalStore` rather than a store subscription: the history is an engine
 *  singleton, not Zustand, and this is the supported way for React to read one without
 *  polling. */
export function UndoButtons() {
  const state = useSyncExternalStore(
    (onChange) => CommandHistory.subscribe(onChange),
    () =>
      `${CommandHistory.canUndo ? '1' : '0'}${CommandHistory.canRedo ? '1' : '0'}` +
      `${CommandHistory.undoLabel ?? ''}|${CommandHistory.redoLabel ?? ''}`,
    () => '00|',
  )
  void state

  const canUndo = CommandHistory.canUndo
  const canRedo = CommandHistory.canRedo

  return (
    <div className="flex items-center">
      <button
        onClick={() => undo()}
        disabled={!canUndo}
        title={canUndo ? `Undo ${CommandHistory.undoLabel} (Ctrl+Z)` : 'Nothing to undo'}
        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
          canUndo ? 'text-slate-400 hover:text-slate-100 hover:bg-aura-surface' : 'text-slate-700'
        }`}
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => redo()}
        disabled={!canRedo}
        title={canRedo ? `Redo ${CommandHistory.redoLabel} (Ctrl+Y)` : 'Nothing to redo'}
        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
          canRedo ? 'text-slate-400 hover:text-slate-100 hover:bg-aura-surface' : 'text-slate-700'
        }`}
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
