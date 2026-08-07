import { useMemo } from 'react'
import { Plus, PenLine, Trash2 } from 'lucide-react'
import { useAutomationStore } from '@/store/useAutomationStore'
import { flatLane, rampLane } from '@/engine/automation/lane'
import { LaneEditor } from './LaneEditor'

/** **Detached** automation lanes — curves the music does not contain.
 *
 *  Deliberately only the detached ones. A lane belonging to a stem lives under that stem's
 *  own waveform (D-55, `StemAutomation`), because a curve without the waveform above it has
 *  no visual cue for *when* — which was the original complaint about detached tracks. Listing
 *  stem lanes here as well put every curve in two places and re-created exactly that.
 *
 *  So this panel is the exception, not the norm: it exists for a shape you want that no stem
 *  is the shape of. It hides itself when there are none.
 *
 *  A lane is a Field, so once drawn it appears in the patchbay beside the stems and wires
 *  to anything — including summing with a stem through the same weighted N:1. */
export function AutomationPanel({ duration }: { duration: number }) {
  const allLanes = useAutomationStore((s) => s.lanes)
  const selectedId = useAutomationStore((s) => s.selectedId)
  const addLane = useAutomationStore((s) => s.addLane)
  const removeLane = useAutomationStore((s) => s.removeLane)
  const setPoints = useAutomationStore((s) => s.setPoints)
  const setInterpolation = useAutomationStore((s) => s.setInterpolation)
  const select = useAutomationStore((s) => s.select)

  // Filtered here rather than in the selector: a selector that builds a new array returns a
  // fresh reference every call, the equality check can never pass, and React re-renders
  // forever — which is precisely how D9 crashed the Routing page.
  const lanes = useMemo(() => allLanes.filter((l) => !l.source), [allLanes])

  const selected = lanes.find((l) => l.id === selectedId) ?? lanes[0] ?? null

  return (
    <section className="border-t border-aura-line shrink-0 flex flex-col min-h-0">
      <header className="flex items-center gap-1.5 px-3 py-1.5 shrink-0">
        <PenLine className="w-3 h-3 text-slate-500" />
        <h2 className="text-[10px] uppercase tracking-wider text-slate-500">Automation</h2>

        <div className="flex-1 flex items-center gap-1 min-w-0 overflow-x-auto">
          {lanes.map((lane) => (
            <button
              key={lane.id}
              onClick={() => select(lane.id)}
              className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                selected?.id === lane.id
                  ? 'border-aura-accent text-slate-100 bg-aura-surface'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: lane.color }}
              />
              {lane.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => addLane(duration)}
          className="shrink-0 text-slate-500 hover:text-aura-accent transition-colors"
          title="New lane"
        >
          <Plus className="w-3 h-3" />
        </button>
      </header>

      {selected ? (
        <div className="px-3 pb-2 space-y-1.5">
          <LaneEditor
            lane={selected}
            duration={duration}
            color={selected.color}
            onChange={(points) => setPoints(selected.id, points)}
          />

          <div className="flex items-center gap-1.5">
            <select
              value={selected.interpolation}
              onChange={(e) =>
                setInterpolation(selected.id, e.target.value as typeof selected.interpolation)
              }
              className="h-6 px-1.5 bg-aura-surface border border-aura-line rounded text-[10px] text-slate-300 outline-none focus:border-aura-focus"
              title="How the curve moves between points"
            >
              <option value="smooth">Smooth</option>
              <option value="linear">Linear</option>
              <option value="step">Step</option>
            </select>

            <button
              onClick={() => setPoints(selected.id, flatLane(duration, 0.5))}
              className="h-6 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[10px] text-slate-400 transition-colors"
            >
              Flat
            </button>
            <button
              onClick={() => setPoints(selected.id, rampLane(duration, 0, 1))}
              className="h-6 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[10px] text-slate-400 transition-colors"
            >
              Ramp
            </button>

            <span className="flex-1 text-[10px] text-slate-600 truncate">
              Drag to draw. Wire it from Routing like any stem.
            </span>

            <button
              onClick={() => removeLane(selected.id)}
              className="shrink-0 text-slate-600 hover:text-aura-hot transition-colors"
              title="Delete lane"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <p className="px-3 pb-2 text-[10px] text-slate-600 leading-snug">
          No lanes. A drawn curve is a signal like a stem — use one when the music does not
          already do what the visual needs.
        </p>
      )}
    </section>
  )
}
