import { useMemo, useState } from 'react'
import { Volume2, VolumeX, Headphones, Trash2, Activity, AudioWaveform } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrimHandles } from './TrimHandles'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { platform } from '@/engine/platform/PlatformAdapter'
import { useAutomationStore } from '@/store/useAutomationStore'
import { StemLaneRow } from '@/components/automation/StemLaneRow'
import { MetricPicker } from './MetricPicker'
import type { Track } from '@/types/audio'

interface TrackRowProps {
  track: Track
  /** Shared timeline span for the whole rack, so every stem is drawn to one time scale. */
  projectDuration: number
}

/** One stem in the rack.
 *
 *  **A stem is a set of automation sources, not a waveform.** So the row shows its curves by
 *  default and the waveform is a *view* of the same strip, switched with one control rather than
 *  revealed by a second one. The waveform is genuinely useful — it is how you find the drop — but
 *  it is not what anything downstream reads, and defaulting to it put the least actionable
 *  picture in the most prominent place.
 *
 *  One row per selected signal, chosen with the picker. Trimming stays on the waveform view,
 *  because trimming is an audio edit and the handles belong on the audio. */
export function TrackRow({ track, projectDuration }: TrackRowProps) {
  const [showWaveform, setShowWaveform] = useState(false)
  const removeLanesForTrack = useAutomationStore((s) => s.removeLanesForTrack)
  const allLanes = useAutomationStore((s) => s.lanes)
  // Filtered outside the selector: one that built an array would return a fresh reference every
  // call and re-render forever (D9).
  const lanes = useMemo(
    () => allLanes.filter((l) => l.source?.trackId === track.id),
    [allLanes, track.id],
  )
  const beatGrid = useMemo(() => AudioFeatures.getBeatGrid(track.id), [track.id])
  const toggleSolo = useAudioStore((s) => s.toggleSolo)
  const toggleMute = useAudioStore((s) => s.toggleMute)
  const setVolume = useAudioStore((s) => s.setVolume)
  const removeTrack = useAudioStore((s) => s.removeTrack)
  const setTrimBounds = useAudioStore((s) => s.setTrimBounds)

  // Zustand's set() is synchronous, so the rack reads committed state immediately.
  // (The previous setTimeout(…, 0) deferral was a race-condition smell, not a fix.)
  const applyGains = () => MultiTrackRack.getInstance().applySoloMuteState()

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(track.id, parseFloat(e.target.value))
    applyGains()
  }

  const handleSolo = () => {
    toggleSolo(track.id)
    applyGains()
  }

  const handleMute = () => {
    toggleMute(track.id)
    applyGains()
  }

  const handleTrimChange = (bounds: { start: number; end: number }) => {
    setTrimBounds(track.id, bounds)
    // Trimming changes the project's overall length.
    MultiTrackRack.getInstance().refreshDuration()
  }

  const handleDelete = () => {
    // The stem's automation lane goes with it, and the wires drawn from that lane.
    removeLanesForTrack(track.id)
    // And its remembered file handle, or storage accumulates entries for files nothing
    // references any more.
    if (track.handleKey) void platform().forgetAudioFile(track.handleKey)
    RealtimeAnalyser.unregister(track.id)
    AudioFeatures.release(track.id)
    MultiTrackRack.getInstance().unregisterTrack(track.id)
    removeTrack(track.id)
  }

  return (
    <div className="bg-aura-surface border border-aura-line rounded group hover:border-aura-elevated transition-colors">
      <div className="flex items-center gap-2 px-3 py-1.5">
      {/* Stem color indicator */}
      <div
        className="w-1 h-8 rounded-full shrink-0"
        style={{ backgroundColor: track.color }}
      />

      {/* Track name */}
      <div className="w-24 shrink-0 truncate text-[11px] font-medium text-slate-300">
        {track.name}
      </div>

      {/* Solo button */}
      <button
        onClick={handleSolo}
        className={[
          'w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors shrink-0',
          track.solo
            ? 'bg-aura-state-solo text-aura-void'
            : 'text-slate-500 hover:text-slate-200 hover:bg-aura-elevated',
        ].join(' ')}
        title="Solo"
      >
        <Headphones className="w-3 h-3" />
      </button>

      {/* Mute button */}
      <button
        onClick={handleMute}
        className={[
          'w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0',
          track.mute
            ? 'bg-aura-hot text-white'
            : 'text-slate-500 hover:text-slate-200 hover:bg-aura-elevated',
        ].join(' ')}
        title="Mute"
      >
        {track.mute ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={track.volume}
        onChange={handleVolumeChange}
        className="w-16 h-1 shrink-0 accent-aura-accent"
        title={`Volume: ${Math.round(track.volume * 100)}%`}
      />

      {/* Waveform + trim handles. `data-stem-lane` is what the rack playhead measures
          against, so the line stays aligned without anyone hardcoding a control width.
          Clicking it seeks: it is a picture of time, so it should behave like one. The trim
          handles sit above and stop propagation, so grabbing an edge still trims. */}
      <MetricPicker track={track} />

      {/* One control, two views of the same strip. `data-stem-lane` is what the rack playhead
          measures against, so it stays on whichever view is showing. */}
      <div
        data-stem-lane
        onPointerDown={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          if (box.width === 0 || projectDuration <= 0) return
          const fraction = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
          MultiTrackRack.getInstance().seek(fraction * projectDuration)
        }}
        title="Click to seek"
        className="flex-1 min-w-0 relative cursor-pointer"
      >
        {!track.buffer ? (
          <div className="h-8 bg-aura-base rounded animate-pulse" />
        ) : showWaveform ? (
          <>
            <WaveformCanvas
              buffer={track.buffer}
              color={track.color}
              height={32}
              duration={projectDuration}
            />
            {/* Trimming is an audio edit, so its handles live on the audio view. */}
            <TrimHandles
              duration={projectDuration}
              trimBounds={track.trimBounds}
              onTrimChange={handleTrimChange}
              color={track.color}
              height={32}
            />
          </>
        ) : (
          <div className="h-8 flex items-center">
            <span className="text-[10px] text-slate-600">
              {lanes.length === 0
                ? 'No signals selected — pick one to the left'
                : `${lanes.length} signal${lanes.length === 1 ? '' : 's'} below`}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowWaveform((v) => !v)}
        className={`shrink-0 transition-colors ${
          showWaveform ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-300'
        }`}
        title={showWaveform ? 'Hide the waveform' : 'Show the waveform and trim handles'}
      >
        {showWaveform ? <AudioWaveform className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
      </button>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-aura-hot transition-all shrink-0"
        title="Remove track"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      </div>

      {/* One row per selected signal, aligned to the same left inset so every curve on the
          page reads against one time axis. */}
      {lanes.map((lane) => (
        <div key={lane.id} className="border-t border-aura-line pl-[196px] pr-3 pt-1">
          <StemLaneRow
            lane={lane}
            track={track}
            duration={projectDuration}
            beatGrid={beatGrid}
          />
        </div>
      ))}
    </div>
  )
}
