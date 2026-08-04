/** Offline video export (docs/04-ENGINE-SPECS.md §4.6).
 *
 *  **A render, not a recording.** Frames are stepped by a `FrameClock`, so the exporter
 *  runs as fast as the GPU allows rather than in real time, and every frame is evaluated
 *  at an exact `frameIndex / fps` — never a wall-clock instant.
 *
 *  This is also the first thing to actually exercise HC-2 and HC-3. Those two constraints
 *  exist solely to make offline rendering possible, and until now nothing had ever driven
 *  the render path from anything but the live transport. Every "pure function of time"
 *  note in this codebase is a promise that gets called in here. */

export interface ExportSettings {
  width: number
  height: number
  fps: number
  /** Video bitrate in bits per second. */
  bitrate: number
  /** Include the mixed stems. Off produces a silent file, which is useful for iterating. */
  includeAudio: boolean
  /** Seconds. Defaults to the project duration. */
  startTime: number
  endTime: number
}

export type ExportStage =
  | 'preparing'
  | 'mixing-audio'
  | 'rendering'
  | 'encoding-audio'
  | 'finalising'
  | 'done'
  | 'cancelled'
  | 'failed'

export interface ExportProgress {
  stage: ExportStage
  /** 0–1 across the whole job, not just the current stage. */
  progress: number
  frame: number
  totalFrames: number
  /** Seconds remaining, or null before there is enough data to estimate. */
  etaSeconds: number | null
  message?: string
}

/** What the exporter needs from the renderer.
 *
 *  Deliberately tiny. The scene is built by React components, so reproducing it inside a
 *  worker would mean a second scene-construction codepath — and two codepaths is exactly
 *  how "what you preview is what renders" stops being true. The exporter therefore drives
 *  the SAME renderer that draws the viewport, and only the encoding is separate. */
export interface FrameSource {
  /** Reconfigure for the export resolution. Returns a restore function. */
  begin(width: number, height: number): () => void
  /** Advance every per-frame system to `time` and draw one frame. Synchronous — the
   *  caller reads the canvas immediately afterwards, in the same task. */
  renderFrame(time: number): void
  /** The canvas holding the frame just drawn. */
  readonly canvas: HTMLCanvasElement
}

export const DEFAULT_EXPORT_SETTINGS: Omit<ExportSettings, 'endTime'> = {
  width: 1920,
  height: 1080,
  fps: 60,
  // 12 Mbps at 1080p60 — high enough that YouTube's re-encode is not working from a
  // degraded source, which is the only quality number that actually matters here.
  bitrate: 12_000_000,
  includeAudio: true,
  startTime: 0,
}

/** Resolution presets (resolves Q9).
 *
 *  Vertical is first-class rather than an afterthought: the primary audience posts to
 *  Shorts and TikTok at least as often as to YouTube proper (01-VISION). */
export const RESOLUTION_PRESETS = [
  { id: '1080p', label: '1080p · 16:9', width: 1920, height: 1080, bitrate: 12_000_000 },
  { id: '1440p', label: '1440p · 16:9', width: 2560, height: 1440, bitrate: 24_000_000 },
  { id: '2160p', label: '4K · 16:9', width: 3840, height: 2160, bitrate: 45_000_000 },
  { id: '720p', label: '720p · 16:9', width: 1280, height: 720, bitrate: 6_000_000 },
  { id: 'vertical', label: '1080×1920 · 9:16', width: 1080, height: 1920, bitrate: 12_000_000 },
  { id: 'square', label: '1080×1080 · 1:1', width: 1080, height: 1080, bitrate: 10_000_000 },
] as const

export const FPS_PRESETS = [24, 30, 60] as const

/** Registry for the one live frame source. Set by the viewport, read by the exporter. */
let source: FrameSource | null = null

export function registerFrameSource(next: FrameSource | null): void {
  source = next
}

export function getFrameSource(): FrameSource | null {
  return source
}
