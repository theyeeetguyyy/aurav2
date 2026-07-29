import type { ID } from '@/types/audio'
import type { ParamAddress, ParamDescriptor, ParamValue } from '@/types/params'
import type { SceneObject } from '@/types/visual'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { EffectRegistry } from '@/engine/scene/EffectRegistry'

/** ParamRegistry — resolves parameter addresses to descriptors and values
 *  (docs/03-ARCHITECTURE.md HC-5).
 *
 *  Every consumer — inspector, routing UI, node graph, automation lanes, serializer —
 *  reads parameter metadata from here. Nothing hardcodes a parameter list, so a new
 *  brick, light, or effect becomes modulatable the moment it declares descriptors. */

// ─────────────────────────────────────────────────────────────────────────────
// Universal descriptors — present on every scene object
// ─────────────────────────────────────────────────────────────────────────────

function axis(
  key: string,
  label: string,
  group: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  unit?: ParamDescriptor['unit'],
): ParamDescriptor {
  // Transform and material parameters write straight onto an existing Three.js object,
  // so they are safe to drive at frame rate.
  return {
    key,
    label,
    type: 'float',
    min,
    max,
    step,
    defaultValue,
    unit,
    group,
    exposed: true,
    realtime: true,
  }
}

export const TRANSFORM_DESCRIPTORS: ParamDescriptor[] = [
  axis('position.x', 'X', 'Transform', 0, -500, 500, 0.1, 'm'),
  axis('position.y', 'Y', 'Transform', 0, -500, 500, 0.1, 'm'),
  axis('position.z', 'Z', 'Transform', 0, -500, 500, 0.1, 'm'),
  axis('rotation.x', 'Rot X', 'Transform', 0, -360, 360, 0.5, 'deg'),
  axis('rotation.y', 'Rot Y', 'Transform', 0, -360, 360, 0.5, 'deg'),
  axis('rotation.z', 'Rot Z', 'Transform', 0, -360, 360, 0.5, 'deg'),
  axis('scale.x', 'Scale X', 'Transform', 1, 0.001, 50, 0.01, 'x'),
  axis('scale.y', 'Scale Y', 'Transform', 1, 0.001, 50, 0.01, 'x'),
  axis('scale.z', 'Scale Z', 'Transform', 1, 0.001, 50, 0.01, 'x'),
  // Writes all three axes at once. The single most commonly modulated parameter —
  // "make it pulse with the kick" — so it exists as a first-class target rather than
  // forcing three identical connections.
  axis('scale.uniform', 'Scale', 'Transform', 1, 0.001, 50, 0.01, 'x'),
]

export const MATERIAL_DESCRIPTORS: ParamDescriptor[] = [
  {
    key: 'material.color',
    label: 'Colour',
    type: 'color',
    min: 0,
    max: 0,
    step: 0,
    defaultValue: '#6366f1',
    group: 'Material',
    exposed: false,
    realtime: false,
  },
  axis('material.roughness', 'Roughness', 'Material', 0.35, 0, 1, 0.01),
  axis('material.metalness', 'Metalness', 'Material', 0.1, 0, 1, 0.01),
  {
    key: 'material.emissive',
    label: 'Emissive',
    type: 'color',
    min: 0,
    max: 0,
    step: 0,
    defaultValue: '#000000',
    group: 'Material',
    exposed: false,
    realtime: false,
  },
  axis('material.emissiveIntensity', 'Emissive Int.', 'Material', 0, 0, 10, 0.01),
  axis('material.opacity', 'Opacity', 'Material', 1, 0, 1, 0.01),
  {
    key: 'material.wireframe',
    label: 'Wireframe',
    type: 'bool',
    min: 0,
    max: 1,
    step: 1,
    defaultValue: false,
    group: 'Material',
    exposed: false,
    realtime: false,
  },
  {
    key: 'material.flatShading',
    label: 'Flat Shading',
    type: 'bool',
    min: 0,
    max: 1,
    step: 1,
    defaultValue: false,
    group: 'Material',
    exposed: false,
    realtime: false,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

/** Every descriptor applicable to an object: universal + brick + effect stack. */
export function describeObject(object: SceneObject): ParamDescriptor[] {
  const brick = BrickRegistry.get(object.brickId)
  return [...TRANSFORM_DESCRIPTORS, ...MATERIAL_DESCRIPTORS, ...(brick?.descriptors ?? [])]
}

/** Descriptors for one effect instance in an object's stack. */
export function describeEffect(object: SceneObject, effectId: string): ParamDescriptor[] {
  const effect = object.effects.find((e) => e.id === effectId)
  if (!effect) return []
  return EffectRegistry.get(effect.effectId)?.descriptors ?? []
}

/** Every modulation target on an object, including its effect stack.
 *
 *  Deformer parameters are the interesting ones — they are the only geometry-changing
 *  values that can be driven at frame rate (D-31), so this is where "kick → explode"
 *  actually becomes available. */
export interface TargetEntry {
  descriptor: ParamDescriptor
  /** Absent for the object's own parameters. */
  effectId?: ID
  /** Label prefix shown in the routing list, e.g. "Explode". */
  ownerLabel?: string
}

export function allModulationTargets(object: SceneObject): TargetEntry[] {
  const entries: TargetEntry[] = modulationTargets(object).map((descriptor) => ({ descriptor }))

  for (const effect of object.effects) {
    const brick = EffectRegistry.get(effect.effectId)
    if (!brick) continue
    for (const descriptor of brick.descriptors) {
      if (!descriptor.exposed || !descriptor.realtime) continue
      entries.push({ descriptor, effectId: effect.id, ownerLabel: effect.name })
    }
  }

  return entries
}

/** Resolve an address to its descriptor, or null if it does not exist. */
export function resolveDescriptor(
  object: SceneObject,
  address: ParamAddress,
): ParamDescriptor | null {
  const pool = address.effectId
    ? describeEffect(object, address.effectId)
    : describeObject(object)
  return pool.find((d) => d.key === address.paramKey) ?? null
}

/** Read the current value at an address. */
export function readParam(object: SceneObject, address: ParamAddress): ParamValue | undefined {
  if (address.effectId) {
    return object.effects.find((e) => e.id === address.effectId)?.params[address.paramKey]
  }

  const { paramKey } = address
  const [head, axisKey] = paramKey.split('.')

  switch (head) {
    case 'position':
    case 'rotation':
    case 'scale': {
      if (axisKey === 'uniform') return object.transform.scale[0]
      const index = axisIndex(axisKey)
      return index === -1 ? undefined : object.transform[head][index]
    }
    case 'material':
      return object.material[axisKey as keyof SceneObject['material']]
    default:
      return object.params[paramKey]
  }
}

/** Parameters that may be modulation targets.
 *
 *  Two filters, for two different reasons:
 *  - `exposed` — Niagara's "User Parameters". Making everything internal globally
 *    linkable produces an unusable routing list.
 *  - `realtime` — the parameter must be drivable at frame rate. Geometry parameters
 *    rebuild the mesh, so wiring a kick to `radius` would re-tessellate 60 times a
 *    second. Offering a target that cannot be driven is worse than not offering it. */
export function modulationTargets(object: SceneObject): ParamDescriptor[] {
  return describeObject(object).filter((d) => d.exposed && d.realtime)
}

export function axisIndex(axisKey: string): number {
  return axisKey === 'x' ? 0 : axisKey === 'y' ? 1 : axisKey === 'z' ? 2 : -1
}

/** Ordered, de-duplicated group names for inspector sections. */
export function groupsOf(descriptors: ParamDescriptor[]): string[] {
  const seen: string[] = []
  for (const descriptor of descriptors) {
    if (!seen.includes(descriptor.group)) seen.push(descriptor.group)
  }
  return seen
}
