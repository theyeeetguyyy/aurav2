import type { Palette } from '../palette'
import type { ParamDescriptor, ParamValue } from '@/types/params'
import type { EffectFamily } from '@/types/visual'

/** Cloners and effectors (docs/06-ROADMAP.md 4H).
 *
 *  A deformer moves the vertices of one mesh. A cloner does something structurally
 *  different: it draws the same mesh N times, each copy with its own transform. So it
 *  cannot share the deformer contract — there is no vertex array to write into — but it
 *  is still an entry in the same effect stack, because to a user "repeat this eight times
 *  around a circle" belongs next to "explode it".
 *
 *  The split inside the family matters:
 *    cloner   — decides how many copies exist and where they start. One per object.
 *    effector — modifies the copies that already exist. Any number, applied in order.
 *
 *  That is Cinema 4D's model and it is the right one: layout and variation are separate
 *  questions, and every effector composes with every cloner. */

/** Hard ceiling on copies. CPU composes one matrix per clone per frame; past this the
 *  frame budget goes to matrix maths rather than to anything visible. */
export const MAX_CLONES = 512

/** Per-clone transforms, structure-of-arrays so the frame loop stays allocation-free. */
export interface CloneBuffers {
  /** How many entries are live. Never greater than MAX_CLONES. */
  count: number
  /** 3 per clone. */
  position: Float32Array
  /** 3 per clone, radians. */
  rotation: Float32Array
  /** 3 per clone. */
  scale: Float32Array
  /** 3 per clone, an RGB multiplier applied through `instanceColor`. Starts at 1. */
  /** Per-instance **brightness multiplier**, RGB. Effectors add to it; 1 is unchanged. */
  tint: Float32Array
  /** Per-instance **absolute colour**, RGB 0–1. Seeded from the object's resolved material colour
   *  each frame, so with no effector touching it the array looks exactly as it did before this
   *  existed. A palette ramp overwrites it.
   *
   *  Separate from `tint` on purpose: brightness is a multiplier and colour is a value, and folding
   *  them together would mean a ramp could only ever darken or lighten what was already there. */
  color: Float32Array
}

export interface ClonerContext {
  /** The object's resolved material colour as linear RGB 0–1, for seeding the colour channel. */
  baseColor?: readonly [number, number, number]
  params: Record<string, ParamValue>
  /** Out. `layout` sets `count` and writes the base transform of every clone. */
  clones: CloneBuffers
  /** The object's own vertex positions — **after** deformation — for a layout that places copies on
   *  the surface rather than in space. Absent for a source with no geometry.
   *
   *  This is the whole reason Surface Scatter can exist: a copy that lands on the shape follows it as
   *  the shape moves, so a deformer driven by a stem carries the whole array with it. */
  sourcePositions?: Float32Array
  /** Matching vertex normals, for aligning a copy to the surface it sits on. */
  sourceNormals?: Float32Array
}

export interface EffectorContext {
  /** The scene palette, for effectors that produce colour from it. */
  palette?: Palette
  params: Record<string, ParamValue>
  /** In/out. Effectors add to what the cloner and earlier effectors produced. */
  clones: CloneBuffers
  /** Seconds from the active clock.
   *
   *  Deformers deliberately have no time (D-36) because self-animation is a design
   *  mistake. Effectors do, and the reason is specific rather than a relaxation of the
   *  rule: the Delay effector's entire purpose is to read a signal at a moment OTHER than
   *  now, which is not expressible without time. It stays a pure function of `time` —
   *  no accumulator, no frame counter — so scrubbing backwards reproduces exactly. */
  time: number
}

interface EffectBrickBase {
  id: string
  label: string
  family: EffectFamily
  hint: string
  descriptors: ParamDescriptor[]
}

export interface ClonerBrick extends EffectBrickBase {
  family: 'instancing'
  layout(ctx: ClonerContext): void
}

export interface EffectorBrick extends EffectBrickBase {
  family: 'instancing'
  /** The parameter whose zero makes this effector a no-op, where there is exactly one.
   *
   *  Optional here and required on a deformer, because most effectors have no single gate: their zero
   *  state is *all* of Move, Rotate, Scale and Brightness sitting at zero, and naming one of them
   *  would make the "at rest" badge wrong the moment another was raised. Declared only where one
   *  parameter really does gate the whole thing (D-111). */
  driver?: string
  affect(ctx: EffectorContext): void
}

export function isCloner(brick: object): brick is ClonerBrick {
  return 'layout' in brick
}

export function isEffector(brick: object): brick is EffectorBrick {
  return 'affect' in brick
}

export function cloneParam(
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
    group: 'Cloner',
    exposed: true,
    realtime: true,
    ...options,
  }
}

/** Clone count is safe at frame rate — instance buffers are allocated once at
 *  MAX_CLONES and only the draw count changes, so wiring a stem to it costs nothing.
 *  This is the one "how much geometry exists" value that IS drivable (contrast D-31). */
export function countParam(
  key: string,
  label: string,
  max: number,
  defaultValue: number,
): ParamDescriptor {
  return {
    key,
    label,
    type: 'int',
    min: 1,
    max,
    step: 1,
    defaultValue,
    group: 'Cloner',
    exposed: true,
    realtime: true,
  }
}

export function cloneChoice(
  key: string,
  label: string,
  defaultValue: ParamValue,
  options?: { value: string; label: string }[],
): ParamDescriptor {
  return {
    key,
    label,
    type: options ? 'enum' : 'bool',
    min: 0,
    max: options ? options.length - 1 : 1,
    step: 1,
    defaultValue,
    options,
    group: 'Cloner',
    exposed: false,
    realtime: false,
  }
}

export function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function flag(params: Record<string, ParamValue>, key: string, fallback: boolean): boolean {
  const value = params[key]
  return typeof value === 'boolean' ? value : fallback
}

export function text(params: Record<string, ParamValue>, key: string, fallback: string): string {
  const value = params[key]
  return typeof value === 'string' ? value : fallback
}

export const AXIS_CHOICES = [
  { value: 'x', label: 'X' },
  { value: 'y', label: 'Y' },
  { value: 'z', label: 'Z' },
]

export function axisOf(params: Record<string, ParamValue>, key = 'axis'): number {
  const value = params[key]
  return value === 'x' ? 0 : value === 'z' ? 2 : 1
}
