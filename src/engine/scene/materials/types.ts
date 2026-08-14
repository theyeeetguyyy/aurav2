import type * as THREE from 'three'
import type { ParamDescriptor, ParamValue } from '@/types/params'

/** Material bricks — how a surface is shaded.
 *
 *  Until now `MaterialParams` was a fixed struct of eight PBR fields, which is precisely
 *  the closed enumeration HC-5 exists to forbid, and it is why every object looked like
 *  the same grey plastic: there was exactly one shading model and no way to declare
 *  another. A material is now a brick with descriptors, like geometry and deformers.
 *
 *  Descriptor keys carry the `material.` prefix so they address and serialise exactly as
 *  they did before; the values are stored unprefixed on the object, which is the split
 *  `writeParam` has always used. */

export interface MaterialHandle {
  readonly material: THREE.Material
  /** Resolved values for this frame, keyed WITHOUT the `material.` prefix. */
  update(params: Record<string, ParamValue>): void
  dispose(): void
}

export interface MaterialBrick {
  id: string
  label: string
  hint: string
  descriptors: ParamDescriptor[]
  create(): MaterialHandle
}

/** Strip the addressing prefix to get the key a value is stored under. */
export function materialKey(descriptorKey: string): string {
  return descriptorKey.startsWith('material.') ? descriptorKey.slice(9) : descriptorKey
}

export function matParam(
  key: string,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
  options: Partial<ParamDescriptor> = {},
): ParamDescriptor {
  return {
    key: `material.${key}`,
    label,
    type: 'float',
    min,
    max,
    step: (max - min) / 200,
    defaultValue,
    group: 'Material',
    // Material uniforms write straight onto a live material, so they are all safe at
    // frame rate — no shader recompile, no geometry rebuild.
    exposed: true,
    realtime: true,
    ...options,
  }
}

/** Hue shift — the one material parameter every shading model gets, whatever its colours are called.
 *
 *  It is here rather than in each brick because it is not a property of a shading model: it rotates
 *  whatever colours the model resolved, so the Gradient's two stops and the Fresnel's rim move
 *  together and a model swap keeps the value. Registered onto every brick by `MaterialRegistry`.
 *
 *  **Why it earns a place.** Colour was authorable but static — the palette decides the scene's
 *  colours and nothing could change them *during* the piece. Wiring a stem here means the drop
 *  changes the colour of the work rather than only its size, which is the one thing Pass 1 of
 *  [17-EXPRESSIVE-RANGE](../../../../docs/17-EXPRESSIVE-RANGE.md) still had open.
 *
 *  Degrees, and it wraps: ±180 covers the wheel in both directions and a routed signal that
 *  overshoots lands somewhere sensible rather than clamping to magenta. */
export function hueShiftDescriptor(): ParamDescriptor {
  return matParam('hueShift', 'Hue Shift', -180, 180, 0, { unit: 'deg' })
}

export function matColour(key: string, label: string, defaultValue: string): ParamDescriptor {
  return {
    key: `material.${key}`,
    label,
    type: 'color',
    min: 0,
    max: 0,
    step: 1,
    defaultValue,
    group: 'Material',
    exposed: false,
    realtime: false,
  }
}

export function matToggle(key: string, label: string, defaultValue: boolean): ParamDescriptor {
  return {
    key: `material.${key}`,
    label,
    type: 'bool',
    min: 0,
    max: 1,
    step: 1,
    defaultValue,
    group: 'Material',
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
