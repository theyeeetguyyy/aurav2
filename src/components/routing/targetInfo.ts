import { useMemo } from 'react'
import { useSceneStore } from '@/store/useSceneStore'
import { usePostStore } from '@/store/usePostStore'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
import { readParam, resolveDescriptor } from '@/engine/params/ParamRegistry'
import { PostRegistry } from '@/engine/post/PostRegistry'
import { ENV_STACK_ID, getEnvSection } from '@/engine/environment/sections'
import { CAMERA_STACK_ID, getBehaviour } from '@/engine/camera/behaviours'
import {
  CAMERA_TRANSFORM_DEFAULTS,
  getCameraTransformDescriptor,
  type CameraTransformKey,
} from '@/engine/camera/cameraTransform'
import { useCameraStore } from '@/store/useCameraStore'
import { POST_STACK_ID } from '@/types/visual'
import type { ParamAddress, ParamDescriptor } from '@/types/params'

/** Resolve a modulation target address to everything the routing UI needs to describe it.
 *
 *  Two kinds of thing can own a parameter — a SceneObject, or the project-wide post
 *  chain — and four places in the routing UI need to describe one. Before this existed
 *  each of them did `objects.find(...)` inline, which silently produced "no descriptor"
 *  for any post address: a flat 0–1 default range instead of the parameter's real span,
 *  and the raw key instead of its label.
 *
 *  Lives in the components layer rather than in `ParamRegistry` because it has to read
 *  stores, and `engine/` may not (docs/03-ARCHITECTURE.md §Directory structure). */

export interface TargetInfo {
  descriptor: ParamDescriptor | null
  /** Current authored value at the address, before modulation. */
  base: number
  /** Name of the effect the parameter belongs to, if any. */
  ownerLabel: string | null
  /** Name of the object or stack that owns it, for wire endpoint labels. */
  groupLabel: string
}

const UNKNOWN: TargetInfo = {
  descriptor: null,
  base: 0,
  ownerLabel: null,
  groupLabel: 'Unknown',
}

export function describeTarget(address: ParamAddress): TargetInfo {
  if (address.objectId === POST_STACK_ID) {
    const effect = usePostStore.getState().effects.find((e) => e.id === address.effectId)
    if (!effect) return UNKNOWN

    const descriptor =
      PostRegistry.get(effect.effectId)?.descriptors.find((d) => d.key === address.paramKey) ?? null
    const raw = effect.params[address.paramKey]

    return {
      descriptor,
      base:
        typeof raw === 'number' ? raw : descriptor ? Number(descriptor.defaultValue) : 0,
      ownerLabel: effect.name,
      groupLabel: 'Post',
    }
  }

  if (address.objectId === CAMERA_STACK_ID) {
    // No effect id means the camera itself, not a member of its behaviour stack — the same
    // convention an object's own transform uses.
    if (!address.effectId) {
      const descriptor = getCameraTransformDescriptor(address.paramKey)
      if (!descriptor) return UNKNOWN
      const { transform } = useCameraStore.getState()
      return {
        descriptor,
        base:
          transform[address.paramKey] ??
          CAMERA_TRANSFORM_DEFAULTS[address.paramKey as CameraTransformKey],
        ownerLabel: 'Transform',
        groupLabel: 'Camera',
      }
    }

    const behaviour = useCameraStore.getState().behaviours.find((b) => b.id === address.effectId)
    if (!behaviour) return UNKNOWN

    const descriptor =
      getBehaviour(behaviour.effectId)?.descriptors.find((d) => d.key === address.paramKey) ?? null
    const raw = behaviour.params[address.paramKey]

    return {
      descriptor,
      base: typeof raw === 'number' ? raw : descriptor ? Number(descriptor.defaultValue) : 0,
      ownerLabel: behaviour.name,
      groupLabel: 'Camera',
    }
  }

  if (address.objectId === ENV_STACK_ID) {
    const section = getEnvSection(address.effectId ?? '')
    if (!section) return UNKNOWN

    const descriptor = section.descriptors.find((d) => d.key === address.paramKey) ?? null
    const raw = useEnvironmentStore.getState().params[section.id]?.[address.paramKey]

    return {
      descriptor,
      base: typeof raw === 'number' ? raw : descriptor ? Number(descriptor.defaultValue) : 0,
      ownerLabel: section.label,
      groupLabel: 'World',
    }
  }

  const object = useSceneStore.getState().objects.find((o) => o.id === address.objectId)
  if (!object) return UNKNOWN

  const raw = readParam(object, address)
  return {
    descriptor: resolveDescriptor(object, address),
    base: typeof raw === 'number' ? raw : 0,
    ownerLabel: object.effects.find((e) => e.id === address.effectId)?.name ?? null,
    groupLabel: object.name,
  }
}

/** Reactive form. Subscribes to both owners so an edit to a base value updates the
 *  displayed range immediately. */
export function useTargetInfo(address: ParamAddress | null): TargetInfo {
  const objects = useSceneStore((s) => s.objects)
  const postEffects = usePostStore((s) => s.effects)
  const envParams = useEnvironmentStore((s) => s.params)
  const behaviours = useCameraStore((s) => s.behaviours)

  return useMemo(
    () => (address ? describeTarget(address) : UNKNOWN),
    // These are the real inputs — describeTarget reads them via getState(), so they must
    // stay in the dependency list to trigger recomputation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, objects, postEffects, envParams, behaviours],
  )
}
