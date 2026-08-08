import { useEffect, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { FEATURE_KEYS, type FeatureKey } from '@/engine/audio/featureTypes'
import { metricLabel, useAutomationStore } from '@/store/useAutomationStore'
import type { Track } from '@/types/audio'

/** Which of a stem's analysed signals you actually want.
 *
 *  The analyser produces thirteen signals per stem. Routing used to list all of them, for every
 *  stem — four stems meant sixty-four rows of things nobody was going to wire, and the two or
 *  three that mattered were somewhere in the middle of it.
 *
 *  So selecting happens **here**, once, next to the audio it came from, and Routing lists only
 *  what was selected. This is the Select CHOP pattern: single out the channels you want before
 *  anything downstream sees them.
 *
 *  Each selected metric becomes a lane, which is what makes it a source — and a lane is also
 *  what clips are placed on, so choosing a metric and shaping it are the same object seen from
 *  two pages. */
export function MetricPicker({ track }: { track: Track }) {
  const lanes = useAutomationStore((s) => s.lanes)
  const toggleStemMetric = useAutomationStore((s) => s.toggleStemMetric)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = new Set(
    lanes.filter((l) => l.source?.trackId === track.id).map((l) => l.source!.metric),
  )

  // Close on any click outside. A picker that stays open while you work elsewhere is a panel,
  // and this is not big enough to earn being one.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Choose which of this stem's signals you want as sources"
        className={`flex items-center gap-1 h-5 px-1.5 rounded border text-[10px] leading-none transition-colors ${
          open
            ? 'border-aura-accent text-aura-accent'
            : 'border-aura-line text-slate-400 hover:text-slate-100 hover:border-slate-500'
        }`}
      >
        <Plus className="w-2.5 h-2.5" />
        {selected.size} signal{selected.size === 1 ? '' : 's'}
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-30 w-44 max-h-64 overflow-y-auto rounded border border-aura-line bg-aura-elevated shadow-lg p-1">
          {FEATURE_KEYS.map((key) => {
            const on = selected.has(key)
            return (
              <button
                key={key}
                onClick={() => toggleStemMetric(track.id, track.name, track.color, key as FeatureKey)}
                className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left text-[11px] transition-colors ${
                  on ? 'text-slate-100 bg-aura-surface' : 'text-slate-400 hover:bg-aura-surface'
                }`}
              >
                <span className="w-3 shrink-0">
                  {on && <Check className="w-3 h-3 text-aura-accent" />}
                </span>
                {metricLabel(key)}
              </button>
            )
          })}

        </div>
      )}
    </div>
  )
}
