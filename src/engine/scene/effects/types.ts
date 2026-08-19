import type { ParamDescriptor } from '@/types/params'
import type { EffectFamily } from '@/types/visual'

/** Deformers displace an ALREADY-BUILT mesh. They never re-tessellate.
 *
 *  That distinction is the whole reason they exist (docs/07-DECISIONS.md D-31): geometry
 *  parameters like `radius` rebuild the mesh, so they cannot be driven at frame rate.
 *  A deformer moves existing vertices, so it can — which is what makes
 *  "drums make the sphere explode and reform within the hit" actually possible.
 *
 *  Whole-array rather than per-vertex callback: one function call per frame instead of
 *  642, and the tight loop stays monomorphic and allocation-free. */
export interface DeformContext {
  /** In/out. Contains the base positions, or the previous deformer's output. */
  positions: Float32Array
  /** Undisplaced base positions. Never written. */
  base: Float32Array
  /** Unit sphere directions of the base topology — "push along the original normal".
   *  Present only for procedural meshes; falls back to normalised base positions. */
  directions: Float32Array
  vertexCount: number
  /** Resolved parameter values, already including modulation for this frame. */
  params: Record<string, number>
  /** The vertex positions of this effect's morph target, for a brick that declares
   *  `morphTargetKey`. Null for every other effect, and null when the target cannot be resolved.
   *
   *  Supplied by the runtime rather than looked up by the brick, because `engine/scene/effects/`
   *  has no business reaching into the geometry registry — and because the lookup is cached there
   *  once per parameter signature rather than once per frame. */
  targetPositions: Float32Array | null
}

/** NOTE: there is deliberately no `time` here (D-36).
 *
 *  A deformer is a pure function of its parameters. It cannot animate on its own.
 *
 *  Anything that moves must move because a Field is driving it — a stem, an LFO, a
 *  noise generator. Built-in motion was a design mistake: it produced movement the user
 *  never asked for, could not switch off, and could not sync to anything. Where a
 *  deformer needs a travelling phase, it exposes a `phase` parameter and the user wires a
 *  saw LFO to it. Same motion, but authored, sync-able, and visible in the patch.
 *
 *  Removing `time` from the contract is what makes that structural rather than a
 *  convention someone can forget. */

export interface DeformerBrick {
  id: string
  label: string
  family: EffectFamily
  /** One-line explanation shown in the effect picker. */
  hint: string
  /** The parameter that gates the whole deformer — the one whose zero makes `apply` a no-op.
   *
   *  Deformers rest at zero on purpose: modulation is `base + Σ offsets` (03-ARCHITECTURE §6), so
   *  a bass-driven bulge has to start unbulged or it is permanently inflated. The cost is that a
   *  freshly added deformer changes nothing, which reads exactly like a broken feature — that
   *  misreading cost real debugging time here. Naming the gate lets the UI say "at rest" instead of
   *  looking dead, and gives a wire an obvious default target. */
  driver: string
  /** The parameter naming another brick to morph towards, for the one effect that does that.
   *
   *  Declaring it is what makes the runtime resolve `DeformContext.targetPositions`. A brick that
   *  does not declare it never pays for the lookup. */
  morphTargetKey?: string
  descriptors: ParamDescriptor[]
  apply(ctx: DeformContext): void
}

/** Deformer parameters are safe at frame rate — that is their entire purpose. */
export function deformParam(
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
    group: 'Deformer',
    exposed: true,
    realtime: true,
    ...options,
  }
}

export const AXIS_OPTIONS = [
  { value: 'x', label: 'X' },
  { value: 'y', label: 'Y' },
  { value: 'z', label: 'Z' },
]

export function axisParam(key = 'axis', label = 'Axis', defaultValue = 'y'): ParamDescriptor {
  return {
    key,
    label,
    type: 'enum',
    min: 0,
    max: 2,
    step: 1,
    defaultValue,
    options: AXIS_OPTIONS,
    group: 'Deformer',
    exposed: false,
    realtime: false,
  }
}

/** Index of the axis a param selects. Enums arrive as strings from the store. */
export function axisIndexOf(params: Record<string, number | string | boolean>, key = 'axis'): number {
  const value = params[key]
  return value === 'x' ? 0 : value === 'z' ? 2 : 1
}
