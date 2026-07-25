/** AudioDataBus — Zero-React-state per-frame audio metrics bus.
 *
 *  CRITICAL CONSTRAINT: This module writes to raw Float32Array buffers,
 *  NEVER to React state. Reading these values (e.g., in R3F useFrame or
 *  shader uniforms) incurs zero React re-renders.
 *
 *  Data layout per track:
 *    rms:              1 float
 *    spectralCentroid: 1 float
 *    bands:            7 floats  (sub, bass, low-mid, mid, upper-mid, presence, brilliance)
 *    ──────────────────────────
 *    Total:            9 floats per track
 */

import type { ID } from '@/types/audio'

const FLOATS_PER_TRACK = 9

/** Indices into each track's 9-float slice */
export const BusIndex = {
  RMS: 0,
  SPECTRAL_CENTROID: 1,
  BAND_SUB: 2,        // ~20-60 Hz
  BAND_BASS: 3,       // ~60-250 Hz
  BAND_LOW_MID: 4,    // ~250-500 Hz
  BAND_MID: 5,        // ~500-2k Hz
  BAND_UPPER_MID: 6,  // ~2-4k Hz
  BAND_PRESENCE: 7,   // ~4-6k Hz
  BAND_BRILLIANCE: 8, // ~6-20k Hz
} as const

/**
 * Singleton bus holding real-time audio metrics for every registered track.
 * Written to by RealtimeAnalyser at ~60 FPS via requestAnimationFrame.
 * Read by R3F useFrame hooks and modulation matrix evaluators.
 */
class AudioDataBusImpl {
  private buffer: Float32Array = new Float32Array(0)
  private trackIndex: Map<ID, number> = new Map()
  private nextSlot = 0

  /** Allocate a slot in the bus for a new track. Call once on track registration. */
  allocate(trackId: ID): void {
    if (this.trackIndex.has(trackId)) return
    this.trackIndex.set(trackId, this.nextSlot)
    this.nextSlot++
    // Grow the buffer to accommodate the new track
    const newBuffer = new Float32Array(this.nextSlot * FLOATS_PER_TRACK)
    newBuffer.set(this.buffer)
    this.buffer = newBuffer
  }

  /** Release a track's slot. The slot is zeroed but not reclaimed (avoids shifting). */
  release(trackId: ID): void {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return
    const offset = slot * FLOATS_PER_TRACK
    this.buffer.fill(0, offset, offset + FLOATS_PER_TRACK)
    this.trackIndex.delete(trackId)
  }

  /** Write a single float at a specific index for a track. Used by RealtimeAnalyser. */
  write(trackId: ID, index: number, value: number): void {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return
    this.buffer[slot * FLOATS_PER_TRACK + index] = value
  }

  /** Write all 7 band values for a track in one call. */
  writeBands(trackId: ID, bands: number[] | Float32Array): void {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return
    const base = slot * FLOATS_PER_TRACK + BusIndex.BAND_SUB
    for (let i = 0; i < 7 && i < bands.length; i++) {
      this.buffer[base + i] = bands[i]
    }
  }

  // ─── Readers (called from useFrame / modulation matrix — zero React state) ───

  /** Get RMS for a track */
  getRMS(trackId: ID): number {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return 0
    return this.buffer[slot * FLOATS_PER_TRACK + BusIndex.RMS]
  }

  /** Get spectral centroid for a track */
  getSpectralCentroid(trackId: ID): number {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return 0
    return this.buffer[slot * FLOATS_PER_TRACK + BusIndex.SPECTRAL_CENTROID]
  }

  /** Get a specific band value for a track (bandIndex 0–6) */
  getBand(trackId: ID, bandIndex: number): number {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return 0
    return this.buffer[slot * FLOATS_PER_TRACK + BusIndex.BAND_SUB + bandIndex]
  }

  /** Get all 7 bands as a sub-view for a track (zero-copy). */
  getBands(trackId: ID): Float32Array {
    const slot = this.trackIndex.get(trackId)
    if (slot === undefined) return new Float32Array(7)
    const base = slot * FLOATS_PER_TRACK + BusIndex.BAND_SUB
    return this.buffer.subarray(base, base + 7)
  }

  /** Get the raw underlying buffer (for direct shader uniform upload). */
  getRawBuffer(): Float32Array {
    return this.buffer
  }

  /** Check if a track is registered */
  has(trackId: ID): boolean {
    return this.trackIndex.has(trackId)
  }

  /** Clean up all slots */
  dispose(): void {
    this.buffer = new Float32Array(0)
    this.trackIndex.clear()
    this.nextSlot = 0
  }
}

/** Singleton instance */
export const AudioDataBus = new AudioDataBusImpl()
