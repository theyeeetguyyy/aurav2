import type * as THREE from 'three'
import type { ParamDescriptor, ParamValue } from '@/types/params'

/** Light bricks (resolves Q2; docs/04-ENGINE-SPECS.md §4.3).
 *
 *  A light is a `SceneObject` like any other — same layer stack, same transform, same
 *  parameter addressing — it simply renders a `THREE.Light` instead of a mesh. That is
 *  the whole design, and it is why most of what a lighting module usually needs already
 *  exists: position and rotation come from the transform, intensity and colour become
 *  modulation targets the moment they are declared as descriptors (HC-5).
 *
 *  **Strobe is deliberately not a light type.** It is an onset trigger into `intensity`
 *  (D-30, Principle 4). Enumerating "strobe light" as a kind would repeat the mistake the
 *  closed `TargetParam` union made: a fixed action where a generic mechanism already
 *  covers it, and covers "flash the rim on the snare" too.
 *
 *  Volumetric shafts and lasers are a *visible cone* — geometry plus a light, not a light
 *  type. They belong with the mesh bricks and are noted in 10-ELEMENTS §F. */

export interface LightHandle {
  /** Added to the scene at the object's transform. */
  readonly light: THREE.Light
  /** Present for lights that aim: their `target` must be in the scene graph to work. */
  readonly target: THREE.Object3D | null
  /** Resolved values for this frame, base plus modulation. Must not allocate. */
  update(params: Record<string, ParamValue>): void
  dispose(): void
}

export interface LightBrick {
  id: string
  label: string
  /** One-line explanation shown in the library. */
  hint: string
  /** Whether this light can cast shadows at all. Ambient and area lights cannot. */
  readonly castsShadows: boolean
  descriptors: ParamDescriptor[]
  create(): LightHandle
}

/** Intensity is the parameter that matters, so its range and curve are chosen for
 *  modulation rather than for a sensible resting value: an exponential curve keeps the
 *  bottom of the slider usable, and the ceiling is high enough that an onset trigger can
 *  produce a real flash rather than a polite nudge. */
export function intensityParam(defaultValue: number, max = 40): ParamDescriptor {
  return {
    key: 'intensity',
    label: 'Intensity',
    type: 'float',
    min: 0,
    max,
    step: max / 400,
    defaultValue,
    curve: 'exp',
    group: 'Light',
    exposed: true,
    realtime: true,
  }
}

export function lightParam(
  key: string,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
  options: Partial<ParamDescriptor> = {},
): ParamDescriptor {
  return {
    key,
    label,
    type: 'float',
    min,
    max,
    step: (max - min) / 200,
    defaultValue,
    group: 'Light',
    exposed: true,
    realtime: true,
    ...options,
  }
}

export function lightColour(defaultValue: string): ParamDescriptor {
  return {
    key: 'color',
    label: 'Colour',
    type: 'color',
    min: 0,
    max: 0,
    step: 1,
    defaultValue,
    group: 'Light',
    exposed: false,
    realtime: false,
  }
}

/** Shadows are a real GPU cost — one depth pass per shadow-casting light, per frame — so
 *  they are opt-in per light rather than a global default. */
export function shadowToggle(defaultValue = false): ParamDescriptor {
  return {
    key: 'shadows',
    label: 'Cast Shadows',
    type: 'bool',
    min: 0,
    max: 1,
    step: 1,
    defaultValue,
    group: 'Light',
    exposed: false,
    realtime: false,
  }
}

export function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function str(params: Record<string, ParamValue>, key: string, fallback: string): string {
  const value = params[key]
  return typeof value === 'string' ? value : fallback
}

export function flag(params: Record<string, ParamValue>, key: string, fallback: boolean): boolean {
  const value = params[key]
  return typeof value === 'boolean' ? value : fallback
}
