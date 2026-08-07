import { useState, useCallback, useMemo, useRef } from 'react'
import { Upload, Music, PenLine } from 'lucide-react'
import { useAudioStore, projectDuration } from '@/store/useAudioStore'
import { useAutomationStore } from '@/store/useAutomationStore'
import { useProjectStore } from '@/store/useProjectStore'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { platform, type PickedAudio } from '@/engine/platform/PlatformAdapter'
import { TrackRow } from '@/components/audio/TrackRow'
import { RackPlayhead } from '@/components/audio/RackPlayhead'
import { AutomationPanel } from '@/components/automation/AutomationPanel'
import { getNextStemColor, generateId } from '@/utils/stemColors'
import type { Track } from '@/types/audio'

/** Media & Stems workspace page.
 *  Handles drag-and-drop audio file import, decoding, and track rack display. */
export function MediaStemsPage() {
  const tracks = useAudioStore((s) => s.tracks)
  const addTrack = useAudioStore((s) => s.addTrack)
  const ensureStemLane = useAutomationStore((s) => s.ensureStemLane)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const rackRef = useRef<HTMLDivElement>(null)

  // The longest trimmed stem IS the project. Every waveform is drawn against it, so the
  // rack is one timeline rather than N independent ones.
  const duration = useMemo(() => projectDuration(tracks), [tracks])
  const hasDetachedLane = useAutomationStore((s) => s.lanes.some((l) => !l.source))
  const addLane = useAutomationStore((s) => s.addLane)

  const importFiles = useCallback(async (picked: PickedAudio[]) => {
    const audioFiles = picked.filter(
      ({ file }) =>
        file.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(file.name),
    )

    if (audioFiles.length === 0) return

    setIsLoading(true)
    const rack = MultiTrackRack.getInstance()

    for (const { file, handleKey } of audioFiles) {
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
          // Lets a reopened project find this exact file again without re-picking.
          handleKey,
        }

        rack.registerTrack(trackId, buffer)
        addTrack(track)
        // The stem's modulation curve exists from the moment it is imported, in
        // `analysis` mode — no points, deferring to the feature timeline.
        ensureStemLane(trackId, name, track.color)
        // Register the live tap after the track exists in the store, so the pre-fader
        // node chain is fully built.
        RealtimeAnalyser.register(trackId)

        // Offline MIR runs once, in a worker, and is what modulation actually reads
        // (HC-3). Deliberately not awaited — decoding the next stem should not wait on
        // the previous one's analysis, and the UI reflects arrival via onProgress.
        void AudioFeatures.analyse(trackId, buffer).then((features) => {
          // The first stem to report a tempo sets the project's. Later stems in the same
          // beat agree with it, and overwriting on every arrival would make the readout
          // depend on which worker happened to finish last.
          if (features.bpm !== null && useProjectStore.getState().project.bpm === null) {
            useProjectStore.getState().setBpm(features.bpm)
          }
        })
      } catch (err) {
        console.error(`Failed to decode ${file.name}:`, err)
      }
    }

    rack.refreshDuration()
    setIsLoading(false)
  }, [addTrack, ensureStemLane])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    // Dropped files carry no handle, so a project built from a drop needs a manual
    // relink on reopen. Picking through the button is the path that remembers.
    importFiles(Array.from(e.dataTransfer.files).map((file) => ({ file })))
  }, [importFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // Through the adapter, not a hidden <input>: nothing outside engine/platform may touch
  // a file picker, or a second host becomes impossible to add later (03-ARCHITECTURE §1).
  const openPicker = useCallback(async () => {
    const files = await platform().pickAudioFiles()
    if (files.length > 0) await importFiles(files)
  }, [importFiles])

  return (
    <div className="w-full h-full flex flex-col">
      {/* ─── Track Rack ─── */}
      {tracks.length > 0 && (
        <div ref={rackRef} className="relative flex-1 overflow-y-auto p-3 space-y-1.5">
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} projectDuration={duration} />
          ))}
          <RackPlayhead containerRef={rackRef} duration={duration} />
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
          onClick={openPicker}
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

      {/* Detached lanes — for a shape the music does not contain. A stem's own curve
          lives under its row, where its waveform gives it a time reference. */}
      {/* Detached lanes only, and only once one exists. Every stem already has its curve
          under its own waveform, so an empty dock here would be furniture. */}
      {hasDetachedLane && <AutomationPanel duration={duration} />}

      {/* ─── Add more (when tracks exist) ─── */}
      {tracks.length > 0 && (
        <div className="mx-3 mb-3 flex gap-2 shrink-0">
          <div
            className={[
              'flex-1 p-2 rounded border border-dashed flex items-center justify-center gap-2 text-xs cursor-pointer transition-colors',
              isDragOver
                ? 'border-aura-accent bg-aura-accent/5 text-aura-accent'
                : 'border-aura-line text-slate-500 hover:border-slate-500 hover:text-slate-300',
            ].join(' ')}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={openPicker}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Add more stems</span>
          </div>

          {/* The way in to a detached lane. The panel that used to own this button now hides
              itself when empty, and a creation affordance inside the thing it creates is a
              door on the inside of the room. */}
          <button
            onClick={() => addLane(duration)}
            title="Draw a curve the music does not contain — an entrance sweep, a manual build"
            className="p-2 px-3 rounded border border-dashed border-aura-line flex items-center gap-2 text-xs text-slate-500 hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Draw a curve</span>
          </button>
        </div>
      )}

    </div>
  )
}
