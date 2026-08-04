import { useState } from 'react'
import { Volume2, VolumeX, Headphones, Trash2, ChevronDown, ChevronRight, Activity } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrimHandles } from './TrimHandles'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { platform } from '@/engine/platform/PlatformAdapter'
import { useAutomationStore } from '@/store/useAutomationStore'
import { StemAutomation } from '@/components/automation/StemAutomation'
import type { Track } from '@/types/audio'

interface TrackRowProps {
  track: Track
  /** Shared timeline span for the whole rack, so every stem is drawn to one time scale. */
  projectDuration: number
}

/** Single track row in the stem rack.
 *  Stem colour, name, solo/mute, volume, waveform with trim handles, delete. */
export function TrackRow({ track, projectDuration }: TrackRowProps) {
  const [showAutomation, setShowAutomation] = useState(false)
  const removeLanesForTrack = useAutomationStore((s) => s.removeLanesForTrack)
  const lane = useAutomationStore((s) => s.lanes.find((l) => l.source?.trackId === track.id))
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
          against, so the line stays aligned without anyone hardcoding a control width. */}
      <div data-stem-lane className="flex-1 min-w-0 relative">
        {track.buffer ? (
          <>
            <WaveformCanvas
              buffer={track.buffer}
              color={track.color}
              height={32}
              duration={projectDuration}
            />
            <TrimHandles
              duration={projectDuration}
              trimBounds={track.trimBounds}
              onTrimChange={handleTrimChange}
              color={track.color}
              height={32}
            />
          </>
        ) : (
          <div className="h-8 bg-aura-base rounded animate-pulse" />
        )}
      </div>

      {/* Automation toggle. The curve belongs to this stem, so it lives on this row. */}
      <button
        onClick={() => setShowAutomation((v) => !v)}
        className={`shrink-0 flex items-center gap-0.5 transition-colors ${
          showAutomation || lane?.mode === 'edited'
            ? 'text-aura-accent'
            : 'text-slate-600 hover:text-slate-300'
        }`}
        title="Show this stem's modulation curve"
      >
        {showAutomation ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Activity className="w-3 h-3" />
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

      {/* Aligned with the lane above by the same left padding, so the curve sits under
          the waveform it came from rather than merely near it. */}
      {showAutomation && (
        <div className="border-t border-aura-line pl-[196px] pr-3 pt-1">
          <StemAutomation track={track} duration={projectDuration} />
        </div>
      )}
    </div>
  )
}
