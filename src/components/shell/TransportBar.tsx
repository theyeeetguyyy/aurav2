import { Play, Pause, Repeat, SkipBack } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'

/** Persistent slim transport strip visible across all 5 workspace tabs.
 *  Per Design System v2 §1: always know where you are in the piece. */
export function TransportBar() {
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const currentTime = useAudioStore((s) => s.currentTime)
  const loopEnabled = useAudioStore((s) => s.loopEnabled)
  const setPlaying = useAudioStore((s) => s.setPlaying)
  const setCurrentTime = useAudioStore((s) => s.setCurrentTime)
  const toggleLoop = useAudioStore((s) => s.toggleLoop)

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
  }

  return (
    <div
      id="transport-bar"
      className="h-8 bg-aura-base border-t border-aura-line flex items-center justify-center gap-3 px-4 select-none shrink-0"
    >
      {/* Return to start */}
      <button
        id="btn-skip-back"
        onClick={() => setCurrentTime(0)}
        className="text-slate-500 hover:text-slate-200 transition-colors duration-150"
        title="Return to start"
      >
        <SkipBack className="w-3.5 h-3.5" />
      </button>

      {/* Play / Pause */}
      <button
        id="btn-play-pause"
        onClick={() => setPlaying(!isPlaying)}
        className="text-slate-300 hover:text-white transition-colors duration-150"
        title={`${isPlaying ? 'Pause' : 'Play'} (Hotkey: Space)`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Timecode display — tabular-nums for stable width */}
      <span
        id="timecode-display"
        className="font-mono tabular-nums text-[11px] text-slate-300 w-20 text-center"
      >
        {formatTime(currentTime)}
      </span>

      {/* Loop toggle */}
      <button
        id="btn-loop"
        onClick={toggleLoop}
        className={`transition-colors duration-150 ${
          loopEnabled ? 'text-aura-accent' : 'text-slate-500 hover:text-slate-200'
        }`}
        title={`Loop ${loopEnabled ? 'on' : 'off'} (Hotkey: L)`}
      >
        <Repeat className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
