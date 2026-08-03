import type { Effect, Pass } from 'postprocessing'
import type { ParamDescriptor, ParamValue } from '@/types/params'

/** Post-process bricks — whole-frame operators (docs/10-ELEMENTS.md §H).
 *
 *  Post effects differ from deformers and geometry bricks in exactly one structural way:
 *  they belong to the PROJECT, not to a SceneObject. Bloom is not a property of the
 *  sphere; it is a property of the frame the sphere ends up in. So the stack lives in its
 *  own store and addresses itself with the reserved object id POST_STACK_ID, which keeps
 *  ParamAddress unchanged and every downstream consumer — patchbay, matrix, inspector,
 *  serialiser — working with no special case (HC-5).
 *
 *  Unlike deformers (D-36), post effects MAY read time: film grain that does not move is
 *  not grain. But that time comes from the active Clock, never from an internal
 *  accumulator or the composer's own wall-clock timer, so an exported frame is identical
 *  to the previewed one (HC-2). Anything that ignores this rule cannot be exported. */

/** Inspector/library grouping. Ordered as a signal chain reads: light, then shape,
 *  then time, then colour, then surface. */
export type PostGroup = 'Glow' | 'Distort' | 'Time' | 'Colour' | 'Texture'

export const POST_GROUPS: PostGroup[] = ['Glow', 'Distort', 'Time', 'Colour', 'Texture']

export interface PostContext {
  /** Seconds from the active clock (HC-2). Never `performance.now()`. */
  time: number
  /** Seconds since the previous frame. */
  dt: number
  width: number
  height: number
}

export interface PostHandle {
  /** What this brick contributes to the composer.
   *
   *  An `Effect` is mergeable — several of them compile into one fullscreen pass.
   *  A `Pass` owns render targets of its own (feedback needs frame history) and forces
   *  a break in the merge run. */
  readonly node: Effect | Pass
  /** Write this frame's resolved values. Called every frame, so it must not allocate. */
  update(params: Record<string, ParamValue>, ctx: PostContext): void
  dispose(): void
}

export interface PostBrick {
  id: string
  label: string
  /** One-line explanation shown in the effect picker. */
  hint: string
  group: PostGroup
  descriptors: ParamDescriptor[]
  /** True for convolution effects — ones that read the input buffer away from their own
   *  pixel. They cannot be merged into a shared pass and get one of their own. */
  standalone?: boolean
  create(): PostHandle
}

/** Post parameters are fullscreen shader uniforms, so they are all safe at frame rate —
 *  nothing here rebuilds geometry. That is what makes the whole stack modulatable. */
export function postParam(
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
    group: 'Effect',
    exposed: true,
    realtime: true,
    ...options,
  }
}

/** An enum/toggle knob. Not a modulation target — switching a branch at frame rate
 *  recompiles or flickers rather than animating. */
export function postChoice(
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
    group: 'Effect',
    exposed: false,
    realtime: false,
  }
}

export function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function bool(params: Record<string, ParamValue>, key: string, fallback: boolean): boolean {
  const value = params[key]
  return typeof value === 'boolean' ? value : fallback
}

/** Index of a string enum value within its declared options. Enum params arrive from the
 *  store as strings; shaders want a float branch selector. */
export function choiceIndex(
  params: Record<string, ParamValue>,
  key: string,
  options: readonly string[],
): number {
  const index = options.indexOf(String(params[key]))
  return index === -1 ? 0 : index
}
