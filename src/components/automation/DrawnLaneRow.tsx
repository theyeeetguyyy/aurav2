import { PenLine, Trash2 } from 'lucide-react'
import { useAutomationStore, type AutomationLane } from '@/store/useAutomationStore'
import { ClipLane } from './ClipLane'

/** A drawn curve, as a row in the stem rack.
 *
 *  Shaped exactly like a stem's row on purpose. A drawn lane and a stem lane are the same kind
 *  of thing — a signal on this project's timeline that anything can be wired from — and the only
 *  difference is where the shape came from and whether there is an analysed signal behind it.
 *  Keeping them in one column, in one visual language, is what makes "stems are automation
 *  sources" true in the UI and not just in the architecture.
 *
 *  It used to be a dock at the bottom of the page, which made it read as a separate feature. */
export function DrawnLaneRow({
  lane,
  duration,
  beatGrid,
}: {
  lane: AutomationLane
  duration: number
  beatGrid: readonly number[]
}) {
  const renameLane = useAutomationStore((s) => s.renameLane)
  const removeLane = useAutomationStore((s) => s.removeLane)

  return (
    <div className="group bg-aura-base border border-aura-line rounded">
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span className="shrink-0 text-slate-600" title="A curve you drew">
          <PenLine className="w-3 h-3" />
        </span>
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: lane.color }}
        />
        <input
          value={lane.name}
          onChange={(e) => renameLane(lane.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
          aria-label="Curve name"
          spellCheck={false}
          className="w-32 shrink-0 h-5 bg-transparent border border-transparent rounded px-1 text-[11px] text-slate-200 truncate outline-none hover:border-aura-line focus:border-aura-focus transition-colors"
        />

        <span className="text-[9px] font-mono text-slate-600">
          {lane.clips.length === 0
            ? 'empty — double-click below'
            : `${lane.clips.length} clip${lane.clips.length === 1 ? '' : 's'}`}
        </span>

        <span className="flex-1" />

        <button
          onClick={() => removeLane(lane.id)}
          title="Delete this curve and the wires drawn from it"
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-aura-hot transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Same left inset as a stem's row, so drawn and analysed curves share one time axis
          down the page. */}
      <div className="border-t border-aura-line pl-[196px] pr-3 py-1">
        <ClipLane lane={lane} duration={duration} beatGrid={beatGrid} />
      </div>
    </div>
  )
}
