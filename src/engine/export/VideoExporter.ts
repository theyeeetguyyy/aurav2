import { FrameClock } from '@/engine/time/Clock'
import { setActiveClock } from '@/engine/time/timeAuthority'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { Mp4Encoder } from './Mp4Encoder'
import { getFrameSource, type ExportProgress, type ExportSettings } from './types'

/** The render loop.
 *
 *  Installs a `FrameClock` as the active clock, steps it one frame at a time, and asks the
 *  renderer to draw at each step. Everything downstream — modulation, deformers, cloners,
 *  camera behaviours, post — reads `activeClock()` and has no idea it is not playback.
 *  That indirection (D-45) is the entire reason this is possible without a second engine.
 *
 *  Runs on the main thread and yields periodically so the progress bar can paint. It is
 *  faster than real time, but it is not free: the UI is deliberately gated while it runs
 *  rather than pretending to stay interactive. */

export interface ExportInputs {
  settings: ExportSettings
  /** Mixed stems, or null for a silent render. */
  audio: AudioBuffer | null
  onProgress?(progress: ExportProgress): void
  signal?: AbortSignal
}

/** How often to hand the main thread back. Every frame would halve throughput; never
 *  would freeze the tab for the length of the render. */
const YIELD_EVERY = 4

export async function exportVideo(inputs: ExportInputs): Promise<Uint8Array> {
  const { settings, audio, onProgress, signal } = inputs
  const source = getFrameSource()
  if (!source) throw new Error('No viewport is mounted to render from')

  const duration = Math.max(0, settings.endTime - settings.startTime)
  const totalFrames = Math.max(1, Math.round(duration * settings.fps))

  const report = (
    stage: ExportProgress['stage'],
    frame: number,
    etaSeconds: number | null = null,
    message?: string,
  ) => {
    onProgress?.({
      stage,
      // Rendering is the bulk of the work; the tail is audio and muxing.
      progress: stage === 'rendering' ? (frame / totalFrames) * 0.9 : frame / totalFrames,
      frame,
      totalFrames,
      etaSeconds,
      message,
    })
  }

  report('preparing', 0)

  const encoder = new Mp4Encoder({
    width: settings.width,
    height: settings.height,
    fps: settings.fps,
    bitrate: settings.bitrate,
    audio:
      audio && settings.includeAudio
        ? { sampleRate: audio.sampleRate, channels: Math.min(2, audio.numberOfChannels) }
        : null,
  })

  const clock = new FrameClock(settings.fps)
  const restore = source.begin(settings.width, settings.height)

  // Envelopes carry memory from whatever the user was doing before pressing Export.
  // Without this the first second of the render ramps in from stale playback state.
  ModulationMatrix.resetEnvelopes()
  setActiveClock(clock)

  try {
    await encoder.configure({
      width: settings.width,
      height: settings.height,
      fps: settings.fps,
      bitrate: settings.bitrate,
      audio:
        audio && settings.includeAudio
          ? { sampleRate: audio.sampleRate, channels: Math.min(2, audio.numberOfChannels) }
          : null,
    })

    const startedAt = performance.now()

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        report('cancelled', frame)
        throw new DOMException('Export cancelled', 'AbortError')
      }

      clock.setFrame(frame)
      source.renderFrame(settings.startTime + frame / settings.fps)

      // Constructed in the SAME task as the draw. A WebGL drawing buffer is cleared at
      // compositing time, which happens when the task yields — reading it later would
      // capture black.
      const videoFrame = new VideoFrame(source.canvas, {
        timestamp: Math.round((frame * 1e6) / settings.fps),
        duration: Math.round(1e6 / settings.fps),
      })

      try {
        encoder.encodeFrame(videoFrame, frame)
      } finally {
        videoFrame.close()
      }

      await encoder.drain()

      if (frame % YIELD_EVERY === 0) {
        const elapsed = (performance.now() - startedAt) / 1000
        const rate = frame > 0 ? frame / elapsed : 0
        report('rendering', frame, rate > 0 ? (totalFrames - frame) / rate : null)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    if (audio && settings.includeAudio) {
      report('encoding-audio', totalFrames)
      encodeAudioBuffer(encoder, audio, duration)
    }

    report('finalising', totalFrames)
    const bytes = await encoder.finish()
    report('done', totalFrames)
    return bytes
  } finally {
    // Always, on every path. Leaving a FrameClock installed would freeze the viewport at
    // whatever frame the render stopped on, which reads as the app having hung.
    setActiveClock(null)
    restore()
    encoder.dispose()
    ModulationMatrix.resetEnvelopes()
  }
}

/** Feed the mixdown to the audio encoder in chunks.
 *
 *  Planar float is what an `AudioBuffer` already holds, so this copies rather than
 *  converts. Chunked because one `AudioData` spanning a four-minute track would be a
 *  40 MB allocation for no benefit. */
function encodeAudioBuffer(encoder: Mp4Encoder, buffer: AudioBuffer, duration: number): void {
  const channels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const total = Math.min(buffer.length, Math.ceil(duration * sampleRate))
  const CHUNK = sampleRate // one second

  const planes: Float32Array[] = []
  for (let c = 0; c < channels; c++) planes.push(buffer.getChannelData(c))

  for (let offset = 0; offset < total; offset += CHUNK) {
    const frames = Math.min(CHUNK, total - offset)
    const interleaved = new Float32Array(frames * channels)

    // AudioData's f32-planar layout is channel-major: all of channel 0, then channel 1.
    for (let c = 0; c < channels; c++) {
      interleaved.set(planes[c].subarray(offset, offset + frames), c * frames)
    }

    const data = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1e6),
      data: interleaved,
    })

    try {
      encoder.encodeAudio(data)
    } finally {
      data.close()
    }
  }
}
