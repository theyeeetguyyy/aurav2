import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Layers, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

/** Which state you are editing — in the top bar, next to the document it belongs to.
 *
 *  A state is the scene plus its routing, and the whole project is a sequence of them. That makes
 *  it a **document-level selector**, which is where Blender puts its Scene picker and why this is
 *  not a panel in a side dock. It also stops the left dock — which is for bringing visual elements
 *  in — from carrying a second, unrelated job.
 *
 *  There is no *Load* or *Save*. Picking a state loads it; leaving it saves it. A state is the
 *  thing you are editing, not a snapshot you have to remember to commit — and two buttons asking
 *  you to manage that by hand was the tell that the old model was wrong. */
export function StateSelector() {
  const states = useProjectStore((s) => s.project.statesLibrary)
  const activeStateId = useProjectStore((s) => s.activeStateId)
  const switchState = useProjectStore((s) => s.switchState)
  const newState = useProjectStore((s) => s.newState)
  const duplicateState = useProjectStore((s) => s.duplicateState)
  const removeState = useProjectStore((s) => s.removeState)
  const renameState = useProjectStore((s) => s.renameState)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const list = Object.values(states)
  const active = activeStateId ? states[activeStateId] : null

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-6 pl-1.5 pr-1 flex items-center gap-1.5 rounded border border-aura-line hover:border-slate-500 transition-colors max-w-[200px]"
        title="Switch state"
      >
        <Layers className="w-3 h-3 text-slate-500 shrink-0" />
        {active && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: active.color }}
          />
        )}
        <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">
          {active?.name ?? 'No state'}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-40 w-60 rounded border border-aura-line bg-aura-elevated shadow-lg p-1">
          <div className="max-h-72 overflow-y-auto">
            {list.map((state) => {
              const current = state.id === activeStateId
              return (
                <div
                  key={state.id}
                  className={`group flex items-center gap-1 px-1 py-0.5 rounded ${
                    current ? 'bg-aura-surface' : 'hover:bg-aura-surface'
                  }`}
                >
                  <span className="w-3 shrink-0">
                    {current && <Check className="w-3 h-3 text-aura-accent" />}
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: state.color }}
                  />

                  {/* Click to switch, type to rename. One control, because a state's name is not
                      a different kind of thing from the state. */}
                  <input
                    value={state.name}
                    onChange={(e) => renameState(state.id, e.target.value)}
                    onFocus={() => !current && switchState(state.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
                    }}
                    aria-label="State name"
                    spellCheck={false}
                    className="flex-1 min-w-0 h-5 bg-transparent border border-transparent rounded px-1 text-[11px] text-slate-200 truncate outline-none focus:border-aura-focus transition-colors cursor-pointer focus:cursor-text"
                  />

                  <span className="text-[9px] font-mono tabular-nums text-slate-600 shrink-0">
                    {state.objects.length}
                  </span>
                  <button
                    onClick={() => duplicateState(state.id)}
                    title="Duplicate — an independent copy"
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-aura-accent transition-all"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeState(state.id)}
                    disabled={list.length === 1}
                    title={
                      list.length === 1
                        ? 'A project needs at least one state'
                        : 'Delete, with every strip using it'
                    }
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-aura-hot disabled:text-slate-800 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => {
              newState()
              setOpen(false)
            }}
            className="w-full mt-1 h-6 flex items-center justify-center gap-1.5 rounded border border-aura-line text-[11px] text-slate-300 hover:border-aura-accent hover:text-aura-accent transition-colors"
          >
            <Plus className="w-3 h-3" />
            New state
          </button>
        </div>
      )}
    </div>
  )
}
