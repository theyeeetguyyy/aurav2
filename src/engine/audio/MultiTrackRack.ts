/** MultiTrackRack — the Web Audio engine: AudioContext ownership, buffer decoding,
 *  synchronised multi-stem playback, and the master transport.
 *
 *  Design notes:
 *  - Singleton. One AudioContext per app lifetime.
 *  - Per-track signal path (docs/03-ARCHITECTURE.md HC-11):
 *
 *        BufferSource ─→ analysisNode ─→ gainNode ─→ masterGain ─→ destination
 *                            │              │
 *                         PRE-FADER      volume / solo / mute
 *                      (analysis tap)
 *
 *    Analysis taps PRE-fader deliberately. Tapping after the gain node would make
 *    the volume fader a *visual* fader — pulling a stem to −20 dB would silently
 *    kill its visual reaction, and muting would kill its visuals entirely. Solo's
 *    visual isolation is an explicit flag (see isTrackVisuallyActive), not a side
 *    effect of audio gain.
 *
 *  - The playhead is published to TransportClock, never to Zustand at frame rate
 *    (HC-1). React components that display it use useTransportTime().
 *  - Timing derives from AudioContext.currentTime, never wall clock. */

import { useAudioStore } from '@/store/useAudioStore'
import { TransportClock } from '@/engine/time/TransportClock'
import type { ID } from '@/types/audio'

interface TrackNode {
  sourceNode: AudioBufferSourceNode | null
  /** Unity-gain pre-fader tap point. Analysis connects here. */
  analysisNode: GainNode
  /** Post-analysis fader carrying volume / solo / mute. */
  gainNode: GainNode
  buffer: AudioBuffer
}

/** Ramp time for gain changes, in seconds. Short enough to feel instant,
 *  long enough to avoid a click. */
const GAIN_RAMP = 0.02

/** Resolve the effective loop region.
 *
 *  An unset region (both bounds 0, the default) means "the whole project", not "a
 *  zero-length region". Exported so the transport UI can display the same bounds the
 *  engine will actually use. */
export function resolveLoopRegion(
  start: number,
  end: number,
  duration: number,
): { loopStart: number; loopEnd: number } {
  if (end > start) return { loopStart: start, loopEnd: end }
  return { loopStart: 0, loopEnd: duration }
}

export class MultiTrackRack {
  private static instance: MultiTrackRack

  private ctx: AudioContext | null = null
  private readonly _trackNodes = new Map<ID, TrackNode>()
  private masterGain: GainNode | null = null

  /** AudioContext.currentTime at the moment playback last started. */
  private playStartContextTime = 0
  /** Timeline offset at the moment playback last started. */
  private playStartOffset = 0
  private clockRAF: number | null = null
  /** Guards pause() against being applied twice (which would double-count elapsed). */
  private isRunning = false

  private constructor() {}

  public static getInstance(): MultiTrackRack {
    if (!MultiTrackRack.instance) {
      MultiTrackRack.instance = new MultiTrackRack()
    }
    return MultiTrackRack.instance
  }

  /** Pre-fader analysis tap points, keyed by track. Used by RealtimeAnalyser. */
  public get analysisNodes(): ReadonlyMap<ID, AudioNode> {
    const map = new Map<ID, AudioNode>()
    for (const [id, node] of this._trackNodes) map.set(id, node.analysisNode)
    return map
  }

  /** Pre-fader tap for a single track, or null if the track is unknown. */
  public getAnalysisNode(trackId: ID): AudioNode | null {
    return this._trackNodes.get(trackId)?.analysisNode ?? null
  }

  /** Lazily initialise the AudioContext on first user interaction. */
  public getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  public async decodeFile(file: File): Promise<AudioBuffer> {
    const ctx = this.getContext()
    const arrayBuffer = await file.arrayBuffer()
    return ctx.decodeAudioData(arrayBuffer)
  }

  /** Register a decoded buffer and build its node chain. */
  public registerTrack(trackId: ID, buffer: AudioBuffer): void {
    const ctx = this.getContext()

    const analysisNode = ctx.createGain()
    analysisNode.gain.value = 1

    const gainNode = ctx.createGain()
    analysisNode.connect(gainNode)
    gainNode.connect(this.masterGain!)

    this._trackNodes.set(trackId, { sourceNode: null, analysisNode, gainNode, buffer })
    this.refreshDuration()
  }

  public unregisterTrack(trackId: ID): void {
    const node = this._trackNodes.get(trackId)
    if (!node) return

    if (node.sourceNode) {
      node.sourceNode.onended = null
      try {
        node.sourceNode.stop()
      } catch {
        // Already stopped — safe to ignore.
      }
      node.sourceNode.disconnect()
    }
    node.analysisNode.disconnect()
    node.gainNode.disconnect()
    this._trackNodes.delete(trackId)
    this.refreshDuration()
  }

  /** Drop every registered track, keeping the AudioContext alive.
   *
   *  `dispose()` closes the context, which is right when the app is going away and wrong
   *  when a project is being replaced: the next project would have no context to decode
   *  into. Loading a project without this left the previous stems' node chains in place,
   *  and they carried on playing under the new one. */
  public unregisterAll(): void {
    for (const trackId of [...this._trackNodes.keys()]) this.unregisterTrack(trackId)
    this.isRunning = false
    this.stopClockSync()
    TransportClock.setTime(0)
    TransportClock.setPlaying(false)
  }

  /** Start synchronised playback of every track from the current playhead. */
  public play(): void {
    const ctx = this.getContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const store = useAudioStore.getState()
    const duration = this.getProjectDuration()
    let offset = TransportClock.time

    // Playback stops with the playhead parked at the end. Pressing play there would
    // schedule nothing and sit in silence, so rewind first — to the loop start when
    // looping, otherwise to zero. Standard transport behaviour.
    if (duration > 0 && offset >= duration - 1e-3) {
      const { loopStart } = resolveLoopRegion(store.loopStart, store.loopEnd, duration)
      offset = store.loopEnabled ? loopStart : 0
      TransportClock.setTime(offset)
    }

    this.stopAllSources()

    this.playStartContextTime = ctx.currentTime
    this.playStartOffset = offset

    for (const [trackId, node] of this._trackNodes) {
      const track = store.tracks.find((t) => t.id === trackId)
      const trimStart = track?.trimBounds.start ?? 0
      const trimEnd = track?.trimBounds.end ?? node.buffer.duration

      // The playhead is already past this track's trimmed region — nothing to schedule.
      if (offset >= trimEnd) {
        node.sourceNode = null
        continue
      }

      const source = ctx.createBufferSource()
      source.buffer = node.buffer

      // Clamp into the trim region, and delay the start if the playhead has not
      // reached trimStart yet, so the stem enters at the right moment.
      const effectiveOffset = Math.max(offset, trimStart)
      const remainingDuration = trimEnd - effectiveOffset
      const delay = Math.max(0, trimStart - offset)

      source.connect(node.analysisNode)
      source.start(ctx.currentTime + delay, effectiveOffset, remainingDuration)
      node.sourceNode = source

      source.onended = () => {
        if (node.sourceNode === source) {
          node.sourceNode = null
        }
      }
    }

    this.applySoloMuteState()
    this.isRunning = true
    this.startClockSync()

    TransportClock.setPlaying(true)
    useAudioStore.getState().setPlaying(true)
  }

  /** Pause, retaining the playhead for resume. Safe to call when already paused. */
  public pause(): void {
    const ctx = this.ctx
    // Without this guard a second pause() adds elapsed time measured from a stale
    // playStartContextTime, jumping the playhead forward.
    if (!ctx || !this.isRunning) return

    const elapsed = ctx.currentTime - this.playStartContextTime
    this.playStartOffset += elapsed
    this.isRunning = false

    this.stopAllSources()
    this.stopClockSync()

    TransportClock.setTime(this.playStartOffset)
    TransportClock.setPlaying(false)
    useAudioStore.getState().setPlaying(false)
  }

  /** Seek to an absolute time. Works while playing or paused. */
  public seek(time: number): void {
    const clamped = Math.max(0, Math.min(time, this.getProjectDuration() || time))
    const wasPlaying = this.isRunning

    if (wasPlaying) {
      this.stopAllSources()
      this.stopClockSync()
      this.isRunning = false
    }

    this.playStartOffset = clamped
    TransportClock.setTime(clamped)

    if (wasPlaying) {
      this.play()
    }
  }

  /** Apply volume / solo / mute to each track's fader.
   *  Analysis is unaffected — it taps pre-fader (HC-11). */
  public applySoloMuteState(): void {
    if (!this.ctx) return

    const tracks = useAudioStore.getState().tracks
    const anySoloed = tracks.some((t) => t.solo)

    for (const track of tracks) {
      const node = this._trackNodes.get(track.id)
      if (!node) continue

      let gain = track.volume
      if (track.mute || (anySoloed && !track.solo)) gain = 0

      node.gainNode.gain.setTargetAtTime(gain, this.ctx.currentTime, GAIN_RAMP)
    }
  }

  /** Longest trimmed track length — the true project duration.
   *  Raw buffer length would run playback past the trimmed end. */
  public getProjectDuration(): number {
    const tracks = useAudioStore.getState().tracks
    let max = 0

    for (const [trackId, node] of this._trackNodes) {
      const track = tracks.find((t) => t.id === trackId)
      const end = track?.trimBounds.end ?? node.buffer.duration
      if (end > max) max = end
    }
    return max
  }

  /** Recompute and publish the project duration. Call after any trim or track change. */
  public refreshDuration(): void {
    TransportClock.setDuration(this.getProjectDuration())
  }

  private stopAllSources(): void {
    for (const node of this._trackNodes.values()) {
      if (!node.sourceNode) continue
      node.sourceNode.onended = null
      try {
        node.sourceNode.stop()
      } catch {
        // Already stopped — safe to ignore.
      }
      node.sourceNode.disconnect()
      node.sourceNode = null
    }
  }

  private startClockSync(): void {
    this.stopClockSync()

    const tick = () => {
      if (!this.ctx || !this.isRunning) return

      const elapsed = this.ctx.currentTime - this.playStartContextTime
      const position = this.playStartOffset + elapsed
      const store = useAudioStore.getState()
      const duration = this.getProjectDuration()

      // With no explicit loop region set, loop the whole project. Both bounds default
      // to 0, so requiring `loopEnd > loopStart` made the Loop button toggle a flag
      // that could never do anything until a region UI existed (Phase 6B).
      const { loopStart, loopEnd } = resolveLoopRegion(store.loopStart, store.loopEnd, duration)

      if (store.loopEnabled && loopEnd > loopStart && position >= loopEnd) {
        this.seek(loopStart)
        return
      }

      if (duration > 0 && position >= duration) {
        this.isRunning = false
        this.stopAllSources()
        this.stopClockSync()
        TransportClock.setTime(duration)
        TransportClock.setPlaying(false)
        store.setPlaying(false)
        return
      }

      TransportClock.setTime(position)
      this.clockRAF = requestAnimationFrame(tick)
    }

    this.clockRAF = requestAnimationFrame(tick)
  }

  private stopClockSync(): void {
    if (this.clockRAF !== null) {
      cancelAnimationFrame(this.clockRAF)
      this.clockRAF = null
    }
  }

  public dispose(): void {
    this.stopAllSources()
    this.stopClockSync()
    this.isRunning = false
    for (const node of this._trackNodes.values()) {
      node.analysisNode.disconnect()
      node.gainNode.disconnect()
    }
    this._trackNodes.clear()
    this.masterGain?.disconnect()
    void this.ctx?.close()
    this.ctx = null
    this.masterGain = null
    TransportClock.reset()
  }
}
