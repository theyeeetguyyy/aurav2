/** Centralized Web Audio API engine managing the AudioContext,
 *  multi-track buffer decoding, synchronized playback, and master clock.
 *
 *  Design notes:
 *  - Singleton pattern — one AudioContext per app lifetime.
 *  - Each track gets its own GainNode for per-track volume control.
 *  - Solo/Mute logic is applied at the gain level, not by stopping sources.
 *  - The clock uses AudioContext.currentTime for sample-accurate sync.
 *  - Playback offset is tracked so seek/pause/resume are frame-perfect. */

import { useAudioStore } from '@/store/useAudioStore'
import type { ID } from '@/types/audio'

interface TrackNode {
  sourceNode: AudioBufferSourceNode | null
  gainNode: GainNode
  buffer: AudioBuffer
}

export class MultiTrackRack {
  private static instance: MultiTrackRack

  private ctx: AudioContext | null = null
  private trackNodes: Map<ID, TrackNode> = new Map()
  private masterGain: GainNode | null = null

  /** AudioContext.currentTime when playback last started */
  private playStartContextTime = 0
  /** Offset into the audio when playback last started (for pause/resume) */
  private playStartOffset = 0
  /** Animation frame ID for clock sync */
  private clockRAF: number | null = null

  private constructor() {}

  public static getInstance(): MultiTrackRack {
    if (!MultiTrackRack.instance) {
      MultiTrackRack.instance = new MultiTrackRack()
    }
    return MultiTrackRack.instance
  }

  /** Lazily initialize AudioContext on first user interaction */
  public getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Decode an audio file (MP3/WAV/OGG) into an AudioBuffer */
  public async decodeFile(file: File): Promise<AudioBuffer> {
    const ctx = this.getContext()
    const arrayBuffer = await file.arrayBuffer()
    return ctx.decodeAudioData(arrayBuffer)
  }

  /** Register a decoded buffer for a track ID */
  public registerTrack(trackId: ID, buffer: AudioBuffer): void {
    const ctx = this.getContext()
    const gainNode = ctx.createGain()
    gainNode.connect(this.masterGain!)

    this.trackNodes.set(trackId, {
      sourceNode: null,
      gainNode,
      buffer,
    })
  }

  /** Remove a track and disconnect its audio nodes */
  public unregisterTrack(trackId: ID): void {
    const node = this.trackNodes.get(trackId)
    if (node) {
      node.sourceNode?.stop()
      node.sourceNode?.disconnect()
      node.gainNode.disconnect()
      this.trackNodes.delete(trackId)
    }
  }

  /** Start synchronized playback of all tracks from the current offset */
  public play(): void {
    const ctx = this.getContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const store = useAudioStore.getState()
    const offset = store.currentTime

    // Stop any existing sources
    this.stopAllSources()

    this.playStartContextTime = ctx.currentTime
    this.playStartOffset = offset

    // Create new source nodes for each track and start them at the offset
    for (const [, node] of this.trackNodes.entries()) {
      const source = ctx.createBufferSource()
      source.buffer = node.buffer
      source.connect(node.gainNode)
      source.start(0, offset)
      node.sourceNode = source

      // Handle natural end of buffer
      source.onended = () => {
        if (node.sourceNode === source) {
          node.sourceNode = null
        }
      }
    }

    // Apply current solo/mute/volume state
    this.applySoloMuteState()

    // Start clock sync
    this.startClockSync()

    useAudioStore.getState().setPlaying(true)
  }

  /** Pause playback — stores current position for resume */
  public pause(): void {
    const ctx = this.ctx
    if (!ctx) return

    // Calculate where we are in the audio
    const elapsed = ctx.currentTime - this.playStartContextTime
    this.playStartOffset += elapsed

    this.stopAllSources()
    this.stopClockSync()

    const store = useAudioStore.getState()
    store.setCurrentTime(this.playStartOffset)
    store.setPlaying(false)
  }

  /** Seek to a specific time (works while playing or paused) */
  public seek(time: number): void {
    const store = useAudioStore.getState()
    const wasPlaying = store.isPlaying

    if (wasPlaying) {
      this.stopAllSources()
      this.stopClockSync()
    }

    this.playStartOffset = time
    store.setCurrentTime(time)

    if (wasPlaying) {
      this.play()
    }
  }

  /** Update per-track gain based on solo/mute/volume state in the store */
  public applySoloMuteState(): void {
    const store = useAudioStore.getState()
    const tracks = store.tracks
    const anySoloed = tracks.some((t) => t.solo)

    for (const track of tracks) {
      const node = this.trackNodes.get(track.id)
      if (!node) continue

      let gain = track.volume

      if (track.mute) {
        gain = 0
      } else if (anySoloed && !track.solo) {
        gain = 0
      }

      // Smooth ramp to avoid clicks
      node.gainNode.gain.setTargetAtTime(gain, this.ctx!.currentTime, 0.02)
    }
  }

  /** Get the duration of the longest loaded track */
  public getMaxDuration(): number {
    let max = 0
    for (const node of this.trackNodes.values()) {
      if (node.buffer.duration > max) {
        max = node.buffer.duration
      }
    }
    return max
  }

  private stopAllSources(): void {
    for (const node of this.trackNodes.values()) {
      if (node.sourceNode) {
        try {
          node.sourceNode.stop()
        } catch {
          // Already stopped — safe to ignore
        }
        node.sourceNode.disconnect()
        node.sourceNode = null
      }
    }
  }

  private startClockSync(): void {
    this.stopClockSync()

    const tick = () => {
      if (!this.ctx) return

      const elapsed = this.ctx.currentTime - this.playStartContextTime
      const currentPos = this.playStartOffset + elapsed
      const maxDuration = this.getMaxDuration()

      const store = useAudioStore.getState()

      // Handle loop
      if (store.loopEnabled && store.loopEnd > store.loopStart && currentPos >= store.loopEnd) {
        this.seek(store.loopStart)
        return
      }

      // Handle end of audio
      if (maxDuration > 0 && currentPos >= maxDuration) {
        store.setCurrentTime(maxDuration)
        store.setPlaying(false)
        this.stopAllSources()
        this.stopClockSync()
        return
      }

      store.setCurrentTime(currentPos)
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

  /** Clean up everything */
  public dispose(): void {
    this.stopAllSources()
    this.stopClockSync()
    for (const node of this.trackNodes.values()) {
      node.gainNode.disconnect()
    }
    this.trackNodes.clear()
    this.masterGain?.disconnect()
    this.ctx?.close()
    this.ctx = null
    this.masterGain = null
  }
}
