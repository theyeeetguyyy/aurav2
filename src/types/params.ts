import type { ID } from './audio'

/** Parameter addressing and description (docs/03-ARCHITECTURE.md HC-5).
 *
 *  A modulation target is an ADDRESS resolved against a DESCRIPTOR REGISTRY, never a
 *  closed string union. A union of "the 18 shape parameters" cannot express a light's
 *  intensity, a particle count, an effect's blend factor, or any brick that does not
 *  exist yet — and it directly contradicts the Unified Field principle, which promises
 *  that any Field can modulate any parameter. */

export type ParamValue = number | boolean | string

/** `stem` is an enum whose options cannot be declared statically — the list is whatever
 *  the user has imported. It exists because the Time Delay effector must name a stem, and
 *  a descriptor with fixed `options` cannot express "one of the loaded tracks". */
export type ParamType = 'float' | 'int' | 'bool' | 'color' | 'enum' | 'stem'

/** Display unit. Scene units are metres (HC-12). */
export type ParamUnit = 'm' | 'deg' | 'x' | '%' | 'hz' | 's'

/** Response curve used when mapping a normalised 0–1 modulation signal onto a range. */
export type ParamCurve = 'linear' | 'log' | 'exp'

export interface ParamOption {
  value: string
  label: string
}

export interface ParamDescriptor {
  /** Unique within its owner, e.g. 'radius', 'position.x', 'material.roughness'. */
  key: string
  label: string
  type: ParamType
  min: number
  max: number
  step: number
  defaultValue: ParamValue
  unit?: ParamUnit
  curve?: ParamCurve
  /** Inspector grouping, e.g. 'Transform', 'Material', 'Geometry'. */
  group: string
  /** Niagara "User Parameters": only exposed params are modulation targets.
   *  Not everything internal should be globally linkable. */
  exposed: boolean
  /** Whether this parameter can be driven at frame rate.
   *
   *  False for anything that rebuilds geometry or re-tessellates. A radius knob wired
   *  to a kick would rebuild a mesh 60 times a second and blow the geometry cache to
   *  unbounded size. Continuous shape change belongs to deformers (Phase 4G), which
   *  displace an already-built mesh — `scale.uniform` covers the common "pulse with
   *  the kick" case for free. */
  realtime: boolean
  /** Only for type 'enum'. */
  options?: ParamOption[]
}

/** Points at one parameter of one thing. */
export interface ParamAddress {
  objectId: ID
  /** Present when the parameter belongs to an effect in the object's stack. */
  effectId?: ID
  paramKey: string
}

const ADDRESS_SEPARATOR = '/'

/** Serialise an address to a stable string key (for maps, React keys, project files). */
export function formatAddress(address: ParamAddress): string {
  return [address.objectId, address.effectId ?? '', address.paramKey].join(ADDRESS_SEPARATOR)
}

export function parseAddress(serialised: string): ParamAddress | null {
  const [objectId, effectId, ...rest] = serialised.split(ADDRESS_SEPARATOR)
  const paramKey = rest.join(ADDRESS_SEPARATOR)
  if (!objectId || !paramKey) return null
  return effectId ? { objectId, effectId, paramKey } : { objectId, paramKey }
}

export function addressEquals(a: ParamAddress, b: ParamAddress): boolean {
  return a.objectId === b.objectId && a.effectId === b.effectId && a.paramKey === b.paramKey
}

// ─────────────────────────────────────────────────────────────────────────────
// Fields — the source side, symmetrical to addresses (Principle 12)
// ─────────────────────────────────────────────────────────────────────────────

/** Every signal in AURA is a Field; they differ only in update rate.
 *  Replaces the closed SourceMetric union so LFOs, noise, rhythm, narrative state,
 *  and object-to-object references are all one uniform kind. */
export type FieldKind =
  | 'audio' //      per-track feature — sourceId is a track ID
  | 'rhythm' //     beat/bar phase, derived from the beat grid
  | 'narrative' //  section intensity, buildup, drop decay — carries memory over bars
  | 'generative' // LFOs and noise — pure functions of clock.time
  | 'automation' // a hand-drawn curve over project time
  | 'object' //     another object's evaluated parameter (call and response)

export interface FieldRef {
  kind: FieldKind
  /** Track ID for 'audio', source object ID for 'object', absent otherwise. */
  sourceId?: ID
  /** Metric key: 'rms', 'band-sub', 'onset', 'beat-phase', 'lfo-sine', … */
  key: string
  /** For kind 'object': which parameter of sourceId to read. */
  paramKey?: string
  /** Cycles per second, for generative fields. Ignored by other kinds. */
  rate?: number
}

export function formatField(field: FieldRef): string {
  return [field.kind, field.sourceId ?? '', field.key, field.paramKey ?? ''].join(ADDRESS_SEPARATOR)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function clampToDescriptor(descriptor: ParamDescriptor, value: number): number {
  return Math.min(descriptor.max, Math.max(descriptor.min, value))
}

/** Map a normalised 0–1 signal into a descriptor's range using its response curve. */
export function denormalise(descriptor: ParamDescriptor, normalised: number): number {
  const t = Math.min(1, Math.max(0, normalised))
  const span = descriptor.max - descriptor.min

  switch (descriptor.curve) {
    case 'exp':
      return descriptor.min + span * t * t
    case 'log':
      return descriptor.min + span * Math.sqrt(t)
    default:
      return descriptor.min + span * t
  }
}
