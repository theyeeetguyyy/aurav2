import { Eraser } from 'lucide-react'
import { metricLabel, useAutomationStore, type AutomationLane } from '@/store/useAutomationStore'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { ClipLane } from './ClipLane'
import type { Track } from '@/types/audio'

/** One selected signal of one stem, as a row under that stem.
 *
 *  Aligned pixel-for-pixel with the stem above it, which is the whole reason it lives here: you
 *  are drawing against a kick you can see, so you know what moment you are editing. A row on its
 *  own timeline could never tell you that.
 *
 *  With nothing on it the row **is** the analysed signal — no separate curve, nothing to keep in
 *  sync. A clip overrides that signal for exactly the span it covers, and the analysis resumes
 *  on either side (D-84). So there is no mode to enter and reset out of; there are clips, and
 *  there is the absence of clips. */
export function StemLaneRow({
  lane,
  track,
  duration,
  beatGrid,
}: {
  lane: AutomationLane
  track: Track
  duration: number
  beatGrid: readonly number[]
}) {
  const clearClips = useAutomationStore((s) => s.clearClips)
  const analysed = AudioFeatures.has(track.id)

  if (!analysed) {
    return (
      <p className="text-[10px] text-slate-600 py-2">
        Analysing {metricLabel(lane.source?.metric ?? '')}… this row fills in when the worker
        finishes.
      </p>
    )
  }

  return (
    <div className="space-y-1 pb-1">
      <div className="flex items-center gap-1.5 px-0.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: lane.color }}
        />
        <span className="text-[10px] text-slate-300">
          {metricLabel(lane.source?.metric ?? '')}
        </span>

        <span className="text-[9px] font-mono text-slate-600">
          {lane.clips.length === 0
            ? 'following analysis'
            : `${lane.clips.length} clip${lane.clips.length === 1 ? '' : 's'}`}
        </span>

        {lane.clips.length > 0 && (
          <button
            onClick={() => clearClips(lane.id)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-200 transition-colors"
            title="Remove every clip and follow the analysis again"
          >
            <Eraser className="w-2.5 h-2.5" />
            Clear
          </button>
        )}
        <span className="flex-1" />
      </div>

      <ClipLane lane={lane} duration={duration} beatGrid={beatGrid} />
    </div>
  )
}
