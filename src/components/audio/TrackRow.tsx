import { Volume2, VolumeX, Headphones, Trash2 } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrimHandles } from './TrimHandles'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import type { Track } from '@/types/audio'

interface TrackRowProps {
  track: Track
  progress: number
}

/** Single track row in the stem rack.
 *  Displays stem color indicator, track name, solo/mute buttons,
 *  volume slider, waveform, and delete button. */
export function TrackRow({ track, progress }: TrackRowProps) {
  const toggleSolo = useAudioStore((s) => s.toggleSolo)
  const toggleMute = useAudioStore((s) => s.toggleMute)
  const setVolume = useAudioStore((s) => s.setVolume)
  const removeTrack = useAudioStore((s) => s.removeTrack)
  const setTrimBounds = useAudioStore((s) => s.setTrimBounds)

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(track.id, vol)
    MultiTrackRack.getInstance().applySoloMuteState()
  }

  const handleSolo = () => {
    toggleSolo(track.id)
    // Defer applySoloMuteState to next tick so Zustand state is committed
    setTimeout(() => MultiTrackRack.getInstance().applySoloMuteState(), 0)
  }

  const handleMute = () => {
    toggleMute(track.id)
    setTimeout(() => MultiTrackRack.getInstance().applySoloMuteState(), 0)
  }

  const handleDelete = () => {
    RealtimeAnalyser.unregister(track.id)
    MultiTrackRack.getInstance().unregisterTrack(track.id)
    removeTrack(track.id)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-aura-surface border border-aura-line rounded group hover:border-aura-elevated transition-colors">
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

      {/* Waveform + Trim Handles */}
      <div className="flex-1 min-w-0 relative">
        {track.buffer ? (
          <>
            <WaveformCanvas
              buffer={track.buffer}
              color={track.color}
              progress={progress}
              height={32}
            />
            <TrimHandles
              duration={track.buffer.duration}
              trimBounds={track.trimBounds}
              onTrimChange={(bounds) => setTrimBounds(track.id, bounds)}
              color={track.color}
              height={32}
            />
          </>
        ) : (
          <div className="h-8 bg-aura-base rounded animate-pulse" />
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-aura-hot transition-all shrink-0"
        title="Remove track"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
