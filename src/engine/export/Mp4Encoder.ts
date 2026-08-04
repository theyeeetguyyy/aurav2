import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

/** WebCodecs encode + MP4 mux.
 *
 *  Both encoders and the muxer run on the **main thread**, deliberately, against the spec
 *  in §4.6 which said worker + `OffscreenCanvas`. The reason is the frame source: the
 *  scene is built by React components, so a worker renderer would be a second
 *  scene-construction codepath and "preview is what renders" would stop being true.
 *
 *  Encoding is not the bottleneck that decision trades away. `VideoEncoder` is
 *  hardware-backed and already runs off the main thread inside the browser; what stays
 *  here is a queue push per frame and a muxer write per chunk, both trivial. What we gain
 *  is `encodeQueueSize` being directly readable, which is how backpressure stays simple. */

export interface EncoderConfig {
  width: number
  height: number
  fps: number
  bitrate: number
  audio: { sampleRate: number; channels: number } | null
}

/** Above this many frames in flight, stop feeding and let the encoder drain.
 *
 *  Without backpressure a fast GPU queues thousands of `VideoFrame`s, each holding a
 *  full-resolution buffer, and the tab runs out of memory long before the render ends. */
const MAX_QUEUE = 8

export class Mp4Encoder {
  private readonly muxer: Muxer<ArrayBufferTarget>
  private readonly video: VideoEncoder
  private readonly audio: AudioEncoder | null
  private readonly fps: number
  private error: Error | null = null

  constructor(config: EncoderConfig) {
    this.fps = config.fps
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: config.width, height: config.height, frameRate: config.fps },
      audio: config.audio
        ? {
            codec: 'aac',
            numberOfChannels: config.audio.channels,
            sampleRate: config.audio.sampleRate,
          }
        : undefined,
      // 'in-memory' moves the metadata to the front of the file, so the result starts
      // playing immediately instead of after a full download. Costs a finalisation pass.
      fastStart: 'in-memory',
    })

    this.video = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (error) => {
        this.error = error instanceof Error ? error : new Error(String(error))
      },
    })

    this.audio = config.audio
      ? new AudioEncoder({
          output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
          error: (error) => {
            this.error = error instanceof Error ? error : new Error(String(error))
          },
        })
      : null
  }

  async configure(config: EncoderConfig): Promise<void> {
    this.video.configure({
      // avc1.640028 = H.264 High profile, level 4.0 — the widest-supported combination
      // that still allows 4K, and what every player and platform expects.
      codec: 'avc1.640028',
      width: config.width,
      height: config.height,
      bitrate: config.bitrate,
      framerate: config.fps,
      // Annex-B would need converting before muxing; avc is what mp4-muxer wants.
      avc: { format: 'avc' },
    })

    if (this.audio && config.audio) {
      this.audio.configure({
        codec: 'mp4a.40.2',
        sampleRate: config.audio.sampleRate,
        numberOfChannels: config.audio.channels,
        bitrate: 192_000,
      })
    }
  }

  /** Encode one frame. `index` is the frame number, which is what makes timestamps
   *  integer-derived rather than wall-clock (HC-2). */
  encodeFrame(frame: VideoFrame, index: number): void {
    this.throwIfFailed()
    // A keyframe every two seconds: enough for a scrubbable file without inflating it.
    const keyFrame = index % (this.fps * 2) === 0
    this.video.encode(frame, { keyFrame })
  }

  /** Wait until the encoder has drained enough to accept more. */
  async drain(): Promise<void> {
    while (this.video.encodeQueueSize > MAX_QUEUE) {
      this.throwIfFailed()
      await new Promise((resolve) => setTimeout(resolve, 1))
    }
  }

  encodeAudio(data: AudioData): void {
    this.throwIfFailed()
    this.audio?.encode(data)
  }

  /** Flush both encoders, then finalise. Order matters and skipping the flush produces a
   *  file that looks complete and will not play. */
  async finish(): Promise<Uint8Array> {
    await this.video.flush()
    if (this.audio) await this.audio.flush()
    this.throwIfFailed()

    this.muxer.finalize()
    const buffer = this.muxer.target.buffer
    if (!buffer) throw new Error('Muxer produced no output')
    return new Uint8Array(buffer)
  }

  /** Tear down without producing a file. Safe to call after an error or a cancel. */
  dispose(): void {
    try {
      if (this.video.state !== 'closed') this.video.close()
      if (this.audio && this.audio.state !== 'closed') this.audio.close()
    } catch {
      // Closing an encoder that already failed throws; nothing useful to do about it.
    }
  }

  private throwIfFailed(): void {
    if (this.error) throw this.error
  }
}

/** Whether this browser can export at all.
 *
 *  WebCodecs is Chromium-first. Saying so up front beats letting a user configure a
 *  render and then fail on the first frame. */
export function canExport(): { ok: boolean; reason: string | null } {
  if (typeof VideoEncoder === 'undefined') {
    return { ok: false, reason: 'This browser has no WebCodecs support. Try Chrome or Edge.' }
  }
  if (typeof VideoFrame === 'undefined') {
    return { ok: false, reason: 'This browser cannot capture video frames.' }
  }
  return { ok: true, reason: null }
}
