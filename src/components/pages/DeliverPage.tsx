import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, Loader2, Square } from 'lucide-react'
import { canExport } from '@/engine/export/Mp4Encoder'
import { mixStems } from '@/engine/export/audioMixdown'
import { exportVideo } from '@/engine/export/VideoExporter'
import {
  DEFAULT_EXPORT_SETTINGS,
  FPS_PRESETS,
  RESOLUTION_PRESETS,
  type ExportProgress,
  type ExportSettings,
} from '@/engine/export/types'
import { platform } from '@/engine/platform/PlatformAdapter'
import { projectFileName } from '@/engine/project/projectFile'
import { useAudioStore, projectDuration } from '@/store/useAudioStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useUIStore } from '@/store/useUIStore'
import { ViewportSlot } from '@/components/viewport/ViewportSlot'

/** Workspace 7 — Deliver. One job: write the file.
 *
 *  Arranging moved to its own page. Encoding and editing are different work, and sharing a
 *  page made the encoder look like the point when the timeline is where the video is decided.
 *  What is left is a settings form and the frame it will render.
 *
 *  Sequencing is optional. A project with no strips is one continuous scene, and rendering
 *  that is the same job as rendering a sequenced one.
 *
 *  The monitor is **not decoration**. The exporter drives the live renderer (HC-9), so this
 *  page has to host the viewport. Without a slot here the canvas had no on-screen box, R3F
 *  reported a 1×1 size, and every post-processing render target was allocated one pixel wide
 *  and upscaled into the file (D-67). It is also the frame you are about to commit to. */
export function DeliverPage() {
  const tracks = useAudioStore((s) => s.tracks)
  const projectName = useProjectStore((s) => s.project.name)
  const setActivePage = useUIStore((s) => s.setActivePage)

  const duration = useMemo(
    () => projectDuration(tracks),
    [tracks],
  )

  const [preset, setPreset] = useState<string>('1080p')
  const [fps, setFps] = useState<number>(60)
  const [includeAudio, setIncludeAudio] = useState(true)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const support = canExport()
  const resolution = RESOLUTION_PRESETS.find((r) => r.id === preset) ?? RESOLUTION_PRESETS[0]
  const missingAudio = tracks.some((t) => t.buffer === null)
  const running = progress !== null && !['done', 'cancelled', 'failed'].includes(progress.stage)

  const run = useCallback(async () => {
    setError(null)
    const controller = new AbortController()
    abort.current = controller

    const settings: ExportSettings = {
      ...DEFAULT_EXPORT_SETTINGS,
      width: resolution.width,
      height: resolution.height,
      bitrate: resolution.bitrate,
      fps,
      includeAudio,
      startTime: 0,
      endTime: duration,
    }

    try {
      setProgress({
        stage: 'mixing-audio',
        progress: 0,
        frame: 0,
        totalFrames: Math.round(duration * fps),
        etaSeconds: null,
      })

      const audio = includeAudio
        ? await mixStems(
            tracks
              .filter((t) => t.buffer)
              .map((t) => ({
                buffer: t.buffer!,
                trimStart: t.trimBounds.start,
                trimEnd: t.trimBounds.end,
                volume: t.volume,
                // Solo isolates: if anything is soloed, everything else is silent.
                muted: t.mute || (tracks.some((o) => o.solo) && !t.solo),
              })),
            duration,
          )
        : null

      const bytes = await exportVideo({
        settings,
        audio,
        signal: controller.signal,
        onProgress: setProgress,
      })

      await platform().writeVideo(
        projectFileName(projectName).replace(/\.aura\.json$/, '.mp4'),
        bytes,
      )
      setProgress((p) => (p ? { ...p, stage: 'done', progress: 1 } : null))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setProgress((p) => (p ? { ...p, stage: 'cancelled' } : null))
      } else {
        console.error('[export] Failed', caught)
        setError(caught instanceof Error ? caught.message : String(caught))
        setProgress((p) => (p ? { ...p, stage: 'failed' } : null))
      }
    } finally {
      abort.current = null
    }
  }, [duration, fps, includeAudio, projectName, resolution, tracks])

  const blocked =
    !support.ok
      ? support.reason
      : duration <= 0
        ? 'Import stems on the Media & Stems page first — the project has no length yet.'
        : missingAudio
          ? 'Some stems have no audio. Relink them before exporting, or the render will be silent where they play.'
          : null

  return (
    <div className="w-full h-full flex min-h-0">
      {/* Non-interactive: this is a proof, not a viewfinder. Dragging here would fly the
          preview camera and change nothing about the render. */}
      <div className="flex-1 min-w-0 min-h-0">
        {/* No gizmos of any kind: this is a proof of the file, so anything that will not be in
            the file has no business in it. */}
        <ViewportSlot compact interactive={false} gizmos={false} />
      </div>

      <aside className="w-80 shrink-0 border-l border-aura-line overflow-y-auto p-4 space-y-4">
        <header>
          <h1 className="text-sm font-medium text-slate-200">Export</h1>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
            A render, not a screen capture. Frames are stepped deterministically, so the
            file matches what you previewed — and two exports of the same project are the
            same file.
          </p>
        </header>

        {blocked && (
          <div className="flex items-start gap-2 p-2 rounded border border-aura-line bg-aura-surface">
            <AlertTriangle className="w-3.5 h-3.5 text-aura-state-solo shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-snug">
              {blocked}
              {duration <= 0 && (
                <button
                  onClick={() => setActivePage('media-stems')}
                  className="ml-1 text-aura-accent hover:underline"
                >
                  Go there
                </button>
              )}
            </p>
          </div>
        )}

        <Field label="Resolution">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            disabled={running}
            className="w-full h-7 px-1.5 bg-aura-surface border border-aura-line rounded text-[11px] text-slate-300 outline-none focus:border-aura-focus"
          >
            {RESOLUTION_PRESETS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Frame rate">
          <div className="flex gap-1">
            {FPS_PRESETS.map((value) => (
              <button
                key={value}
                onClick={() => setFps(value)}
                disabled={running}
                className={`flex-1 h-7 rounded border text-[11px] transition-colors ${
                  fps === value
                    ? 'border-aura-accent text-aura-accent bg-aura-surface'
                    : 'border-aura-line text-slate-400 hover:text-slate-200'
                }`}
              >
                {value} fps
              </button>
            ))}
          </div>
        </Field>

        <label className="flex items-center justify-between h-7 px-2 bg-aura-surface border border-aura-line rounded text-[11px] cursor-pointer">
          <span className="text-slate-400 font-medium">Include audio</span>
          <input
            type="checkbox"
            checked={includeAudio}
            onChange={(e) => setIncludeAudio(e.target.checked)}
            disabled={running}
            className="accent-aura-accent"
          />
        </label>

        <dl className="text-[10px] text-slate-500 font-mono tabular-nums space-y-0.5">
          <Row label="Duration" value={`${duration.toFixed(2)}s`} />
          <Row label="Frames" value={`${Math.round(duration * fps)}`} />
          <Row label="Bitrate" value={`${(resolution.bitrate / 1_000_000).toFixed(0)} Mbps`} />
        </dl>

        {progress && (
          <div className="space-y-1">
            <div className="h-1 bg-aura-surface rounded overflow-hidden">
              <div
                className="h-full bg-aura-accent transition-[width] duration-150"
                style={{ width: `${Math.round(progress.progress * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono tabular-nums">
              {stageLabel(progress)}
            </p>
          </div>
        )}

        {error && <p className="text-[10px] text-aura-hot leading-snug">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={run}
            disabled={running || blocked !== null}
            className={`flex-1 h-8 flex items-center justify-center gap-1.5 rounded border text-[11px] font-medium transition-colors ${
              running || blocked
                ? 'border-aura-line text-slate-600'
                : 'border-aura-accent text-aura-accent hover:bg-aura-surface'
            }`}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {running ? 'Rendering…' : 'Export MP4'}
          </button>

          {running && (
            <button
              onClick={() => abort.current?.abort()}
              className="h-8 px-3 flex items-center gap-1.5 rounded border border-aura-line text-[11px] text-slate-400 hover:text-aura-hot transition-colors"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-600 leading-snug">
          The viewport renders the export, so keep this tab in front — a backgrounded tab
          is throttled and the render will crawl.
        </p>
      </aside>
    </div>
  )
}

function stageLabel(progress: ExportProgress): string {
  switch (progress.stage) {
    case 'mixing-audio':
      return 'Mixing stems…'
    case 'rendering': {
      const eta =
        progress.etaSeconds !== null && Number.isFinite(progress.etaSeconds)
          ? ` · ${Math.ceil(progress.etaSeconds)}s left`
          : ''
      return `Frame ${progress.frame} / ${progress.totalFrames}${eta}`
    }
    case 'encoding-audio':
      return 'Encoding audio…'
    case 'finalising':
      return 'Writing file…'
    case 'done':
      return 'Done'
    case 'cancelled':
      return 'Cancelled'
    case 'failed':
      return 'Failed'
    default:
      return 'Preparing…'
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="text-slate-400">{value}</dd>
    </div>
  )
}
