import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { FEATURE_KEYS, type FeatureKey } from '@/engine/audio/featureTypes'
import type { LaneInterpolation } from '@/engine/automation/lane'
import { useAutomationStore } from '@/store/useAutomationStore'
import { LaneEditor } from './LaneEditor'
import type { Track } from '@/types/audio'

/** One stem's editable modulation curve, drawn directly under its waveform.
 *
 *  This is the point of the whole feature: the curve is *this stem's*, on *this stem's*
 *  timeline, aligned pixel-for-pixel with the waveform above it. You can see where the
 *  kick lands, so you know what moment you are editing — which a detached lane on its own
 *  timeline can never tell you.
 *
 *  It starts as whatever the analyser produced. Drawing on it takes ownership; Reset gives
 *  it back. Either way it wires from the patchbay as one source. */
export function StemAutomation({ track, duration }: { track: Track; duration: number }) {
  const lanes = useAutomationStore((s) => s.lanes)
  const setPoints = useAutomationStore((s) => s.setPoints)
  const setMetric = useAutomationStore((s) => s.setMetric)
  const resetToAnalysis = useAutomationStore((s) => s.resetToAnalysis)
  const setInterpolation = useAutomationStore((s) => s.setInterpolation)
  const materialise = useAutomationStore((s) => s.materialise)

  const lane = lanes.find((l) => l.source?.trackId === track.id)
  const analysed = AudioFeatures.has(track.id)

  // The analysed curve, drawn faintly behind the live one, so an edit is always visible
  // as a departure from what the analyser heard rather than as an unanchored shape.
  const ghost = useMemo(() => {
    if (!lane?.source || !analysed || lane.mode !== 'edited') return undefined
    const { trackId, metric } = lane.source
    return (t: number) => AudioFeatures.sample(trackId, metric as FeatureKey, t)
  }, [lane?.source, lane?.mode, analysed])

  if (!lane) return null

  if (!analysed) {
    return (
      <div className="px-2 py-2 text-[10px] text-slate-600">
        Analysing this stem… its curve appears here when the worker finishes.
      </div>
    )
  }

  // In analysis mode the lane holds no points, so the editor is handed the feature
  // timeline directly — what is drawn is exactly what modulation reads.
  const displayLane =
    lane.mode === 'analysis' && lane.source
      ? {
          ...lane,
          points: materialise(lane.id, duration),
        }
      : lane

  return (
    <div className="space-y-1 pb-1">
      <LaneEditor
        lane={displayLane}
        duration={duration}
        color={lane.color}
        ghost={ghost}
        height={64}
        onChange={(points) => setPoints(lane.id, points)}
      />

      <div className="flex items-center gap-1.5 px-0.5">
        <select
          value={lane.source?.metric ?? 'envelope'}
          onChange={(e) => setMetric(lane.id, e.target.value as FeatureKey)}
          className="h-5 bg-aura-surface border border-aura-line rounded px-1 text-[10px] text-slate-300 outline-none focus:border-aura-focus"
          title="Which analysed signal this curve starts from"
        >
          {FEATURE_KEYS.map((key) => (
            <option key={key} value={key} className="bg-aura-elevated">
              {metricLabel(key)}
            </option>
          ))}
        </select>

        {/* Interpolation belongs here, not only on the detached-lane panel. This is the
            primary authoring path (D-55), and without a `step` option a drawn curve can only
            ease — so the one camera move this genre is built on, the snap, could not be
            drawn at all. The engine has supported all three modes from the start. */}
        <select
          value={lane.interpolation}
          onChange={(e) => setInterpolation(lane.id, e.target.value as LaneInterpolation)}
          className="h-5 bg-aura-surface border border-aura-line rounded px-1 text-[10px] text-slate-300 outline-none focus:border-aura-focus"
          title="How the curve moves between points — Step is what makes a snap rather than a ramp"
        >
          {INTERPOLATIONS.map(({ value, label, hint }) => (
            <option key={value} value={value} title={hint} className="bg-aura-elevated">
              {label}
            </option>
          ))}
        </select>

        <span
          className={`text-[9px] font-mono px-1 rounded ${
            lane.mode === 'edited' ? 'text-aura-state-solo' : 'text-slate-600'
          }`}
        >
          {lane.mode === 'edited' ? 'edited' : 'from analysis'}
        </span>

        {lane.mode === 'edited' && (
          <button
            onClick={() => resetToAnalysis(lane.id)}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-200 transition-colors"
            title="Discard the edit and follow the analysis again"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Reset
          </button>
        )}

        <span className="flex-1 text-[10px] text-slate-600 truncate text-right">
          Drag to reshape · wire it from Routing
        </span>
      </div>
    </div>
  )
}

/** The three modes the sampler implements, with the reason each exists. */
const INTERPOLATIONS: { value: LaneInterpolation; label: string; hint: string }[] = [
  { value: 'smooth', label: 'Smooth', hint: 'Flat entering and leaving each point — the default, and what a hand-drawn curve should feel like' },
  { value: 'linear', label: 'Linear', hint: 'Straight ramps. Predictable, and right for a steady sweep' },
  { value: 'step', label: 'Step', hint: 'Holds, then jumps. This is how you draw a snap — a zoom that hits rather than eases' },
]

function metricLabel(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
