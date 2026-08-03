import { useState, useCallback, useMemo, useRef } from 'react'
import { Upload, Music } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { TrackRow } from '@/components/audio/TrackRow'
import { RackPlayhead } from '@/components/audio/RackPlayhead'
import { getNextStemColor, generateId } from '@/utils/stemColors'
import type { Track } from '@/types/audio'

/** Media & Stems workspace page.
 *  Handles drag-and-drop audio file import, decoding, and track rack display. */
export function MediaStemsPage() {
  const tracks = useAudioStore((s) => s.tracks)
  const addTrack = useAudioStore((s) => s.addTrack)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const rackRef = useRef<HTMLDivElement>(null)

  // The longest trimmed stem IS the project. Every waveform is drawn against it, so the
  // rack is one timeline rather than N independent ones.
  const projectDuration = useMemo(
    () => tracks.reduce((max, t) => Math.max(max, t.trimBounds.end), 0),
    [tracks],
  )

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter((f) =>
      f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(f.name)
    )

    if (audioFiles.length === 0) return

    setIsLoading(true)
    const rack = MultiTrackRack.getInstance()

    for (const file of audioFiles) {
      try {
        const buffer = await rack.decodeFile(file)
        const trackId = generateId()
        const name = file.name.replace(/\.[^.]+$/, '')

        const track: Track = {
          id: trackId,
          name,
          fileName: file.name,
          color: getNextStemColor(),
          buffer,
          volume: 0.8,
          solo: false,
          mute: false,
          trimBounds: { start: 0, end: buffer.duration },
          analysis: null,
        }

        rack.registerTrack(trackId, buffer)
        addTrack(track)
        // Register the live tap after the track exists in the store, so the pre-fader
        // node chain is fully built.
        RealtimeAnalyser.register(trackId)

        // Offline MIR runs once, in a worker, and is what modulation actually reads
        // (HC-3). Deliberately not awaited — decoding the next stem should not wait on
        // the previous one's analysis, and the UI reflects arrival via onProgress.
        void AudioFeatures.analyse(trackId, buffer)
      } catch (err) {
        console.error(`Failed to decode ${file.name}:`, err)
      }
    }

    rack.refreshDuration()
    setIsLoading(false)
  }, [addTrack])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    importFiles(e.dataTransfer.files)
  }, [importFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      importFiles(e.target.files)
    }
  }, [importFiles])

  return (
    <div className="w-full h-full flex flex-col">
      {/* ─── Track Rack ─── */}
      {tracks.length > 0 && (
        <div ref={rackRef} className="relative flex-1 overflow-y-auto p-3 space-y-1.5">
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} projectDuration={projectDuration} />
          ))}
          <RackPlayhead containerRef={rackRef} duration={projectDuration} />
        </div>
      )}

      {/* ─── Drop Zone / Empty State ─── */}
      {tracks.length === 0 && (
        <div
          className={[
            'flex-1 flex items-center justify-center m-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
            isDragOver
              ? 'border-aura-accent bg-aura-accent/5'
              : 'border-aura-line hover:border-slate-500',
          ].join(' ')}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <div className="text-center">
            {isLoading ? (
              <>
                <div className="w-8 h-8 border-2 border-aura-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-400">Decoding audio…</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-300 mb-1">
                  Drop audio stems here
                </p>
                <p className="text-xs text-slate-500">
                  MP3, WAV, OGG, FLAC, AAC — or click to browse
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Add More Button (when tracks exist) ─── */}
      {tracks.length > 0 && (
        <div
          className={[
            'mx-3 mb-3 p-2 rounded border border-dashed flex items-center justify-center gap-2 text-xs cursor-pointer transition-colors',
            isDragOver
              ? 'border-aura-accent bg-aura-accent/5 text-aura-accent'
              : 'border-aura-line text-slate-500 hover:border-slate-500 hover:text-slate-300',
          ].join(' ')}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Add more stems</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        id="file-input"
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  )
}
