import type { FieldRef } from '@/types/params'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import type { FeatureKey } from '@/engine/audio/featureTypes'
import type { LaneData } from '@/engine/automation/lane'
import {
  holdValue,
  sampleClips,
  type AutomationPattern,
} from '@/engine/automation/clips'
import type { ModulationProcessor } from './processors'

/** Field evaluation — every signal in AURA reduced to one call (Principle 12).
 *
 *  Audio metrics, LFOs, noise, beat phase and (later) object references differ only in
 *  where they come from. Anything that can answer `f(t) -> 0..1` is a Field, and any
 *  Field can drive any parameter.
 *
 *  Every implementation here is a PURE FUNCTION OF TIME. That is not incidental — it is
 *  what lets the exporter evaluate frames out of order and faster than real time and
 *  get the same answer the user previewed (HC-3). A generative field implemented as an
 *  accumulator (`phase += rate * dt`) would break scrubbing and export silently, which
 *  is why none of them are written that way. */

/** Everything field evaluation needs from the outside world.
 *
 *  Passed in rather than imported, because `engine/` may not import a store
 *  (docs/03-ARCHITECTURE.md — the engine boundary is absolute). It is also what makes
 *  the offline exporter able to drive this with its own state. */
export interface FieldContext {
  time: number
  /** Solo/mute gating for visuals — an explicit flag, never a side effect of the fader. */
  isTrackActive(trackId: string): boolean
  /** Generator lookup. Passed in, never imported — the engine boundary is absolute. */
  getGenerator?(id: string): GeneratorConfig | null
  /** Automation lane lookup. Same rule. */
  getLane?(id: string): LaneData | null
  /** Every pattern in the project, keyed by id. Clips reference patterns rather than holding
   *  them, so evaluating a lane needs both. */
  getPatterns?(): Readonly<Record<string, AutomationPattern>>
  /** A shared processing stage by id. Wires reference processors rather than owning them. */
  getProcessor?(id: string): ModulationProcessor | null
}

/** The shape field evaluation needs from a Generator. Structural, so `engine/` does not
 *  depend on the store's type. */
export interface GeneratorConfig {
  type: string
  rate: number
  offset: number
  depth: number
  bias: number
  shape: number
}

export function evaluateField(field: FieldRef, ctx: FieldContext): number {
  switch (field.kind) {
    case 'audio':
      return evaluateAudio(field, ctx)
    case 'generative':
      return evaluateGenerative(field, ctx)
    case 'rhythm':
      return evaluateRhythm(field, ctx.time)
    case 'automation': {
      const lane = field.sourceId ? (ctx.getLane?.(field.sourceId) ?? null) : null
      if (!lane) return 0

      // Solo gates first, whatever the lane holds: the curve came from that stem, so isolating
      // the stem must isolate what it drives (HC-11).
      if (lane.source && !ctx.isTrackActive(lane.source.trackId)) return 0

      const patterns = ctx.getPatterns?.() ?? {}

      // A clip wins for exactly the span it covers, and nowhere else. That is what makes "the
      // kick drives this, except during the drop" expressible without a mode.
      const clipped = sampleClips(lane.clips, patterns, ctx.time)
      if (clipped !== null) return clipped

      // Outside every clip, a stem lane resumes its analysed signal — the useful default, and
      // the reason placing one clip does not silence the rest of the song.
      if (lane.source) {
        return AudioFeatures.sample(lane.source.trackId, lane.source.metric as FeatureKey, ctx.time)
      }

      // A drawn lane has no signal to fall back to, so it holds the nearest clip edge.
      return holdValue(lane.clips, patterns, ctx.time) ?? 0
    }
    case 'narrative':
    case 'object':
      // Phase 6C (section-aware narrative) and Phase 5E (object-to-object routing).
      return 0
    default:
      return 0
  }
}

function evaluateAudio(field: FieldRef, ctx: FieldContext): number {
  if (!field.sourceId) return 0

  // Solo isolates visuals as well as audio — an explicit product requirement (HC-11).
  // A muted or solo-excluded stem contributes nothing, so soloing the drums shows
  // exactly which part of the visual the drums are responsible for.
  if (!ctx.isTrackActive(field.sourceId)) return 0

  return AudioFeatures.sample(field.sourceId, field.key as FeatureKey, ctx.time)
}

const TAU = Math.PI * 2

/** Generative fields resolve their configuration from a Generator when one is referenced,
 *  and fall back to the FieldRef's own settings otherwise. */
function evaluateGenerative(field: FieldRef, ctx: FieldContext): number {
  const generator = field.sourceId ? (ctx.getGenerator?.(field.sourceId) ?? null) : null

  const type = generator?.type ?? field.key
  const rate = generator?.rate ?? field.rate ?? 1
  const offset = generator?.offset ?? 0
  const depth = generator?.depth ?? 1
  const bias = generator?.bias ?? 0
  const shape = generator?.shape ?? 0.5

  const phase = ctx.time * rate + offset
  const raw = shapeOf(type, phase, shape)

  return clamp01(bias + raw * depth)
}

function shapeOf(type: string, phase: number, shape: number): number {
  switch (type) {
    case 'lfo-sine':
      return (Math.sin(phase * TAU) + 1) / 2
    case 'lfo-triangle':
      return 1 - Math.abs((positiveFraction(phase) - 0.5) * 2)
    case 'lfo-saw':
      return positiveFraction(phase)
    case 'lfo-square':
      return positiveFraction(phase) < shape ? 1 : 0
    case 'noise':
      return valueNoise(phase)
    case 'random-walk':
      // Summed octaves of value noise — drifts rather than oscillating, so it never
      // settles into an audible-looking rhythm the way an LFO does.
      return clamp01(
        valueNoise(phase) * 0.6 + valueNoise(phase * 0.37 + 91.3) * 0.3 + valueNoise(phase * 0.11 + 17.7) * 0.1,
      )
    default:
      return 0
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function evaluateRhythm(field: FieldRef, time: number): number {
  if (!field.sourceId) return 0
  const bpm = AudioFeatures.getBpm(field.sourceId)
  if (!bpm) return 0

  const grid = AudioFeatures.getBeatGrid(field.sourceId)
  const period = 60 / bpm
  // Anchor on the first detected beat so phase 0 lands on a real hit, not on t=0.
  const origin = grid.length > 0 ? grid[0] : 0
  const beats = (time - origin) / period

  switch (field.key) {
    case 'beat-phase':
      return positiveFraction(beats)
    case 'bar-phase':
      return positiveFraction(beats / 4)
    default:
      return 0
  }
}

/** Smooth value noise — deterministic, seeded by position, no internal state.
 *  Hermite-interpolated between integer lattice points so it reads as drift, not hash. */
function valueNoise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const smooth = f * f * (3 - 2 * f)
  return hash(i) * (1 - smooth) + hash(i + 1) * smooth
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function positiveFraction(value: number): number {
  const f = value % 1
  return f < 0 ? f + 1 : f
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue, for the routing UI
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldOption {
  kind: FieldRef['kind']
  key: string
  label: string
  /** Requires a track to be chosen as the source. */
  needsSource: boolean
}

export const AUDIO_FIELDS: FieldOption[] = [
  { kind: 'audio', key: 'envelope', label: 'Envelope', needsSource: true },
  { kind: 'audio', key: 'rms', label: 'Loudness (RMS)', needsSource: true },
  { kind: 'audio', key: 'peak', label: 'Peak', needsSource: true },
  { kind: 'audio', key: 'onset', label: 'Onset (decaying)', needsSource: true },
  // The inverse of everything else here — it rises when the stem stops.
  { kind: 'audio', key: 'silence', label: 'Silence', needsSource: true },
  { kind: 'audio', key: 'spectral-centroid', label: 'Brightness', needsSource: true },
  { kind: 'audio', key: 'spectral-flux', label: 'Spectral Flux', needsSource: true },
  { kind: 'audio', key: 'band-sub', label: 'Band · Sub', needsSource: true },
  { kind: 'audio', key: 'band-bass', label: 'Band · Bass', needsSource: true },
  { kind: 'audio', key: 'band-low-mid', label: 'Band · Low Mid', needsSource: true },
  { kind: 'audio', key: 'band-mid', label: 'Band · Mid', needsSource: true },
  { kind: 'audio', key: 'band-upper-mid', label: 'Band · Upper Mid', needsSource: true },
  { kind: 'audio', key: 'band-presence', label: 'Band · Presence', needsSource: true },
  { kind: 'audio', key: 'band-brilliance', label: 'Band · Brilliance', needsSource: true },
]

export const RHYTHM_FIELDS: FieldOption[] = [
  { kind: 'rhythm', key: 'beat-phase', label: 'Beat Phase', needsSource: true },
  { kind: 'rhythm', key: 'bar-phase', label: 'Bar Phase', needsSource: true },
]

/** Generative fields come from user-created Generators (see types/generator.ts), not from
 *  a fixed list — you routinely want several, differently configured. The only generic
 *  metric a generator exposes is its own output. */
export const GENERATOR_FIELD: FieldOption = {
  kind: 'generative',
  key: 'out',
  label: 'Output',
  needsSource: true,
}

/** Same shape as the generator field: lanes are user-created, so the catalogue exposes
 *  the kind and the instance supplies the identity. */
/** Any lane: a stem's selected signal, or a curve drawn from nothing. Both are lanes, and a
 *  lane is the only way to reference either (D-88) — which is why this one option covers what
 *  used to need thirteen per stem. */
export const AUTOMATION_FIELD: FieldOption = {
  kind: 'automation',
  key: 'out',
  label: 'Automation',
  needsSource: true,
}

export const ALL_FIELDS: FieldOption[] = [
  ...AUDIO_FIELDS,
  ...RHYTHM_FIELDS,
  GENERATOR_FIELD,
  AUTOMATION_FIELD,
]

export function fieldLabel(field: FieldRef): string {
  return ALL_FIELDS.find((f) => f.kind === field.kind && f.key === field.key)?.label ?? field.key
}
