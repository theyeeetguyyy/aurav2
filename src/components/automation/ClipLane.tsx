import { useMemo } from 'react'
import { MAX_CLIP_REPEAT, clipAt, clipPhase } from '@/engine/automation/clips'
import type { LaneInterpolation } from '@/engine/automation/lane'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import type { FeatureKey } from '@/engine/audio/featureTypes'
import { useAutomationStore, type AutomationLane } from '@/store/useAutomationStore'
import { ClipTrack } from './ClipTrack'
import { PatternEditor } from './PatternEditor'
import { INTERPOLATIONS } from './interpolations'

/** A lane's clip track, plus the editor for whichever clip is selected.
 *
 *  Shared by stem lanes and drawn lanes because at this level they are the same thing: a row of
 *  clips on the project timeline. The only difference is what sits *behind* the clips — a stem
 *  has its analysed signal there and a drawn lane has nothing — and that is one optional prop,
 *  not a second component.
 *
 *  The pattern editor appears below the track only while a clip is selected. Always-on, it
 *  would double every row's height for something you are not editing; and with nothing selected
 *  there is no correct thing to show, since a lane has no single curve any more. */
export function ClipLane({
  lane,
  duration,
  beatGrid,
}: {
  lane: AutomationLane
  duration: number
  beatGrid: readonly number[]
}) {
  const patterns = useAutomationStore((s) => s.patterns)
  const selectedClipId = useAutomationStore((s) => s.selectedClipId)
  const setPatternPoints = useAutomationStore((s) => s.setPatternPoints)
  const setPatternInterpolation = useAutomationStore((s) => s.setPatternInterpolation)
  const renamePattern = useAutomationStore((s) => s.renamePattern)
  const setClipRepeat = useAutomationStore((s) => s.setClipRepeat)

  const source = lane.source
  const analysed = source && AudioFeatures.has(source.trackId)

  /** The stem's own signal. Behind the clips, and — outside every clip — the thing that
   *  actually drives the parameter. */
  const signal = useMemo(() => {
    if (!source || !analysed) return undefined
    const { trackId, metric } = source
    return (t: number) => AudioFeatures.sample(trackId, metric as FeatureKey, t)
  }, [source, analysed])

  // Only this lane's selection counts: one clip is selected across the whole project, so a row
  // must not open an editor for a clip that belongs to a different row.
  const clip = lane.clips.find((c) => c.id === selectedClipId) ?? null
  const pattern = clip ? patterns[clip.patternId] : null

  /** Where in the pattern the transport is, so the editor's playhead tracks the current cycle
   *  rather than the whole project. Null while the transport is outside the clip. */
  const phaseAt = useMemo(() => {
    if (!clip) return undefined
    return (time: number) => (clipAt([clip], time) ? clipPhase(clip, time) : null)
  }, [clip])

  /** The analysed shape over this clip's span, in pattern time — so an edit reads as a
   *  departure from what the music does rather than as an unanchored line. */
  const ghost = useMemo(() => {
    if (!clip || !signal) return undefined
    return (phase: number) => signal(clip.startTime + phase * clip.duration)
  }, [clip, signal])

  return (
    <div className="space-y-1">
      <ClipTrack lane={lane} duration={duration} signal={signal} beatGrid={beatGrid} />

      {clip && pattern && (
        <div className="rounded border border-aura-line bg-aura-base/60 p-1.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <input
              value={pattern.name}
              onChange={(e) => renamePattern(pattern.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
              }}
              aria-label="Pattern name"
              spellCheck={false}
              className="w-28 h-5 bg-transparent border border-transparent rounded px-1 text-[10px] text-slate-200 truncate outline-none hover:border-aura-line focus:border-aura-focus transition-colors"
            />

            <select
              value={pattern.interpolation}
              onChange={(e) =>
                setPatternInterpolation(pattern.id, e.target.value as LaneInterpolation)
              }
              className="h-5 bg-aura-surface border border-aura-line rounded px-1 text-[10px] text-slate-300 outline-none focus:border-aura-focus"
              title="How the curve moves between points — Step is what makes a snap rather than a ramp"
            >
              {INTERPOLATIONS.map(({ value, label, hint }) => (
                <option key={value} value={value} title={hint} className="bg-aura-elevated">
                  {label}
                </option>
              ))}
            </select>

            {/* The control that answers "I drew a one-second shape and want it every second".
                Length and cycle count are separate on purpose: dragging the clip's edge retimes
                every cycle at once, which stretching a hand-copied row of clips cannot do. */}
            <label className="flex items-center gap-1 text-[10px] text-slate-500">
              <span title="How many times the pattern cycles inside this clip">×</span>
              <input
                type="number"
                min={1}
                max={MAX_CLIP_REPEAT}
                step={1}
                value={clip.repeat}
                onChange={(e) => setClipRepeat(lane.id, clip.id, Number(e.target.value))}
                aria-label="Repeat count"
                className="w-11 h-5 bg-aura-surface border border-aura-line rounded px-1 text-[10px] text-slate-300 outline-none focus:border-aura-focus"
              />
            </label>

            <span className="flex-1 text-[10px] text-slate-600 truncate text-right font-mono tabular-nums">
              {clip.duration.toFixed(2)}s
              {clip.repeat > 1 && ` · ${(clip.duration / clip.repeat).toFixed(2)}s each`}
            </span>
          </div>

          <PatternEditor
            points={pattern.points}
            interpolation={pattern.interpolation}
            color={pattern.color}
            height={72}
            ghost={ghost}
            phaseAt={phaseAt}
            onChange={(points) => setPatternPoints(pattern.id, points)}
          />

        </div>
      )}
    </div>
  )
}
