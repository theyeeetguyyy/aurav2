import type * as THREE from 'three'
import type { ParamDescriptor, ParamValue } from '@/types/params'
import type { MeshKind, RenderBackend } from '@/types/visual'

/** A geometry brick: one atomic, generic shape operator (Principle 12).
 *
 *  Bricks are data, not code branches. Adding a shape means registering a brick —
 *  never editing a switch statement in core engine code. This is the concrete
 *  mechanism behind "code in such a way that new components can work together". */
export interface GeometryBrick {
  /** Registry id, e.g. 'proc-sphere', 'geo-torus-knot'. */
  id: string
  label: string
  backend: RenderBackend
  meshKind: MeshKind
  /** Bricks sharing a non-null morph group can vertex-lerp between each other.
   *  null means swap-only: transitions are a crossfade, not a morph (HC-4). */
  morphGroup: string | null
  descriptors: ParamDescriptor[]
  build(params: Record<string, ParamValue>): THREE.BufferGeometry
}

/** Whether two bricks can vertex-morph. The single authority — the UI must never
 *  offer a morph the backend cannot actually perform. */
export function canMorph(a: GeometryBrick | null, b: GeometryBrick | null): boolean {
  if (!a || !b) return false
  return a.morphGroup !== null && a.morphGroup === b.morphGroup
}

/** Default parameter bag for a brick, taken from its descriptors. */
export function defaultParams(brick: GeometryBrick): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = {}
  for (const descriptor of brick.descriptors) {
    params[descriptor.key] = descriptor.defaultValue
  }
  return params
}
