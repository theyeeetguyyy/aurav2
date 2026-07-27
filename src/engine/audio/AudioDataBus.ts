/** AudioDataBus — zero-React-state per-frame audio metrics bus.
 *
 *  CRITICAL (docs/03-ARCHITECTURE.md HC-1): this module writes to raw Float32Array
 *  storage, never to React state. Reading these values in useFrame or when uploading
 *  shader uniforms costs zero re-renders.
 *
 *  NOTE (HC-3): this bus holds *live* values only — "what is the RMS right now".
 *  It is therefore usable for preview but NOT for offline export, which renders
 *  frames out of order and faster than real time. Phase 2G introduces
 *  AudioFeatures.sample(track, metric, t) backed by pre-computed feature timelines;
 *  that becomes the source of truth for both preview and export, and this bus is
 *  retained only for future live-microphone input.
 *
 *  Layout: 9 contiguous floats per track slot.
 *    0     rms
 *    1     spectralCentroid (0–1, normalised against the spectrum bin count)
 *    2–8   seven band energies (sub … brilliance), each 0–1 */

import type { ID } from '@/types/audio'

const FLOATS_PER_TRACK = 9

/** Fixed capacity. Pre-allocated once so the backing buffer is never replaced.
 *
 *  This matters: getBands() hands out a subarray *view* into the buffer. If the
 *  buffer were reallocated on every track import (the previous behaviour), every
 *  previously-returned view would silently point at an orphaned array and read
 *  stale data forever. */
const MAX_TRACKS = 64

/** Indices into each track's 9-float slice. */
export const BusIndex = {
  RMS: 0,
  SPECTRAL_CENTROID: 1,
  BAND_SUB: 2, //        ~20–60 Hz
  BAND_BASS: 3, //       ~60–250 Hz
  BAND_LOW_MID: 4, //    ~250–500 Hz
  BAND_MID: 5, //        ~500 Hz–2 kHz
  BAND_UPPER_MID: 6, //  ~2–4 kHz
  BAND_PRESENCE: 7, //   ~4–6 kHz
  BAND_BRILLIANCE: 8, // ~6–20 kHz
} as const

export const BAND_COUNT = 7

class AudioDataBusImpl {
  /** Allocated once at construction and never replaced — see MAX_TRACKS. */
  private readonly buffer = new Float32Array(MAX_TRACKS * FLOATS_PER_TRACK)
  private readonly trackIndex = new Map<ID, number>()
  /** Slots freed by release(), reused before allocating a fresh one. */
  private readonly freeSlots: number[] = []
  private nextSlot = 0

  /** Reserve a slot for a track. Idempotent. */
  allocate(trackId: ID): void {
    if (this.trackIndex.has(trackId)) return

    const slot = this.freeSlots.pop() ?? this.nextSlot++
    if (slot >= MAX_TRACKS) {
      console.warn(`[AudioDataBus] Track limit of ${MAX_TRACKS} reached; ${trackId} not analysed`)
      this.nextSlot = MAX_TRACKS
      return
    }

    this.trackIndex.set(trackId, slot)
    this.buffer.fill(0, slot * FLOATS_PER_TRACK, (slot + 1) * FLOATS_PER_TRACK)
  }

  /** Release a track's slot back to the pool and zero its values. */
  release(trackId: ID): void {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return

    this.buffer.fill(0, slot * FLOATS_PER_TRACK, (slot + 1) * FLOATS_PER_TRACK)
    this.trackIndex.delete(trackId)
    this.freeSlots.push(slot)
  }

  // ─── Writers (called from the analysis callback) ───

  write(trackId: ID, index: number, value: number): void {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return
    this.buffer[slot * FLOATS_PER_TRACK + index] = value
  }

  writeBands(trackId: ID, bands: ArrayLike<number>): void {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return
    const base = slot * FLOATS_PER_TRACK + BusIndex.BAND_SUB
    const n = Math.min(BAND_COUNT, bands.length)
    for (let i = 0; i < n; i++) {
      this.buffer[base + i] = bands[i]
    }
  }

  // ─── Readers (called from useFrame / the modulation matrix — zero React state) ───

  getRMS(trackId: ID): number {
    return this.read(trackId, BusIndex.RMS)
  }

  getSpectralCentroid(trackId: ID): number {
    return this.read(trackId, BusIndex.SPECTRAL_CENTROID)
  }

  /** Band energy by index 0–6 (sub … brilliance). */
  getBand(trackId: ID, bandIndex: number): number {
    return this.read(trackId, BusIndex.BAND_SUB + bandIndex)
  }

  /** Zero-copy view of a track's seven bands. Stable for the lifetime of the slot. */
  getBands(trackId: ID): Float32Array {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return EMPTY_BANDS
    const base = slot * FLOATS_PER_TRACK + BusIndex.BAND_SUB
    return this.buffer.subarray(base, base + BAND_COUNT)
  }

  /** Raw backing store, for bulk upload to a shader uniform array. */
  getRawBuffer(): Float32Array {
    return this.buffer
  }

  /** Slot index for a track, so shaders can index the raw buffer directly. */
  getSlot(trackId: ID): number {
    return this.trackIndex.get(trackId) ?? -1
  }

  has(trackId: ID): boolean {
    return this.trackIndex.has(trackId)
  }

  dispose(): void {
    this.buffer.fill(0)
    this.trackIndex.clear()
    this.freeSlots.length = 0
    this.nextSlot = 0
  }

  private read(trackId: ID, index: number): number {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return 0
    return this.buffer[slot * FLOATS_PER_TRACK + index]
  }
}

/** Shared immutable zero-fill returned for unknown tracks. */
const EMPTY_BANDS = new Float32Array(BAND_COUNT)

export const AudioDataBus = new AudioDataBusImpl()
