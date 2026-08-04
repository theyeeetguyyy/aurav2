import type { TrackFeatures } from '@/engine/audio/featureTypes'
import type {
  AutomationPoint,
  LaneInterpolation,
  LaneMode,
  LaneSource,
} from '@/engine/automation/lane'
import type { EventTrigger, ModulationConnection } from '@/types/modulation'
import type { ParamValue } from '@/types/params'
import type { EffectInstance, SceneObject } from '@/types/visual'
import type { ID } from '@/types/audio'

/** `.aura.json` — the project file (docs/04-ENGINE-SPECS.md §4.7).
 *
 *  Two rules govern what goes in:
 *
 *  1. **Stems are referenced, never embedded.** A project that carried its audio would be
 *     tens of megabytes and would stop being a document you can email.
 *  2. **Feature timelines ARE embedded.** They are derived, but re-deriving them means
 *     re-analysing every stem on every open — seconds of work to reproduce something that
 *     is deterministic. Encoded as base64 so the file stays a fraction of the size a JSON
 *     number array would be.
 *
 *  Every store's contents appear here explicitly rather than by spreading unknown state,
 *  so adding a store is a deliberate edit to this file and a version bump — not something
 *  that silently half-works. */

export const PROJECT_VERSION = 1
export const PROJECT_EXTENSION = '.aura.json'

/** What a project remembers about a stem. Deliberately not the audio. */
export interface StemRef {
  id: ID
  name: string
  fileName: string
  color: string
  volume: number
  solo: boolean
  mute: boolean
  trimStart: number
  trimEnd: number
  /** Cached analysis, so reopening does not re-analyse. Absent if analysis never ran. */
  features?: SerialisedFeatures
  /** Opaque key for reopening the stem's own file. Absent when the host cannot persist
   *  handles, or when the stem arrived by drag-and-drop. */
  handleKey?: string
}

/** `TrackFeatures` with its `Float32Array`s base64-encoded. */
export interface SerialisedFeatures {
  duration: number
  frameCount: number
  /** Metric key → base64 of the little-endian Float32Array. */
  timelines: Record<string, string>
  onsetTimes: number[]
  bpm: number | null
  beatGrid: number[]
}

export interface SerialisedLane {
  id: ID
  name: string
  color: string
  points: AutomationPoint[]
  interpolation: LaneInterpolation
  mode: LaneMode
  /** Present on a stem lane; absent on a detached one. */
  source?: LaneSource
}

export interface SerialisedGenerator {
  id: ID
  name: string
  color: string
  type: string
  rate: number
  offset: number
  depth: number
  bias: number
  shape: number
}

export interface SerialisedCamera {
  behaviours: EffectInstance[]
  lookAtId: ID | null
  lookAtEnabled: boolean
  /** The authored Scene Camera transform, not the resolved one — behaviours regenerate
   *  the resolved value on the first frame, and saving it would double-apply them. */
  scenePosition: [number, number, number]
  sceneQuaternion: [number, number, number, number]
  sceneFov: number
}

export interface AuraProject {
  version: number
  /** ISO timestamp, for the "last saved" readout and for conflict messages. */
  savedAt: string
  name: string

  stems: StemRef[]
  objects: SceneObject[]
  post: { effects: EffectInstance[]; bypassed: boolean }
  environment: {
    params: Record<string, Record<string, ParamValue>>
    disabled: Record<string, boolean>
  }
  camera: SerialisedCamera
  modulation: { connections: ModulationConnection[]; triggers: EventTrigger[] }
  generators: SerialisedGenerator[]
  lanes: SerialisedLane[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature timeline encoding
// ─────────────────────────────────────────────────────────────────────────────

/** Base64 of a Float32Array's raw bytes.
 *
 *  A 200 Hz timeline over a four-minute track is ~48 000 floats. As a JSON number array
 *  that is roughly 600 kB per metric and thirteen metrics per stem — a project file
 *  measured in tens of megabytes. Base64 of the raw buffer is 4 bytes per sample plus a
 *  third, which is about a tenth the size and lossless.
 *
 *  Endianness is not handled explicitly: every platform this runs on is little-endian,
 *  and a file moved between two of them is fine. */
export function encodeFloats(values: Float32Array): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength)
  let binary = ''
  // Chunked, because String.fromCharCode(...spread) on a 200 kB array overflows the
  // argument limit and throws.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function decodeFloats(encoded: string): Float32Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

export function serialiseFeatures(features: TrackFeatures): SerialisedFeatures {
  const timelines: Record<string, string> = {}
  for (const [key, values] of Object.entries(features.timelines)) {
    timelines[key] = encodeFloats(values)
  }
  return {
    duration: features.duration,
    frameCount: features.frameCount,
    timelines,
    onsetTimes: [...features.onsetTimes],
    bpm: features.bpm,
    beatGrid: [...features.beatGrid],
  }
}

export function deserialiseFeatures(data: SerialisedFeatures): TrackFeatures {
  const timelines: Record<string, Float32Array> = {}
  for (const [key, encoded] of Object.entries(data.timelines)) {
    timelines[key] = decodeFloats(encoded)
  }
  return {
    duration: data.duration,
    frameCount: data.frameCount,
    timelines: timelines as TrackFeatures['timelines'],
    onsetTimes: [...data.onsetTimes],
    bpm: data.bpm,
    beatGrid: [...data.beatGrid],
  }
}
