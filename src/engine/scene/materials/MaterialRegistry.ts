import type { ParamValue } from '@/types/params'
import { MATERIAL_BRICKS } from './materials'
import { materialKey, type MaterialBrick } from './types'

/** MaterialRegistry — the shading-model catalogue.
 *
 *  Same contract as BrickRegistry, EffectRegistry and PostRegistry: registration is data.
 *  Adding a material means adding a brick, and it becomes selectable, inspectable and
 *  modulatable with no switch statement anywhere. */

class MaterialRegistryImpl {
  private readonly bricks = new Map<string, MaterialBrick>()

  register(brick: MaterialBrick): void {
    if (this.bricks.has(brick.id)) {
      console.warn(`[MaterialRegistry] "${brick.id}" already registered; ignoring duplicate`)
      return
    }
    this.bricks.set(brick.id, brick)
  }

  registerAll(bricks: MaterialBrick[]): void {
    for (const brick of bricks) this.register(brick)
  }

  get(id: string): MaterialBrick | null {
    return this.bricks.get(id) ?? null
  }

  list(): MaterialBrick[] {
    return [...this.bricks.values()]
  }

  /** Stored under unprefixed keys, which is the shape `SceneObject.material` has. */
  defaultParams(id: string): Record<string, ParamValue> {
    const brick = this.get(id) ?? this.get(DEFAULT_MATERIAL_ID)
    const params: Record<string, ParamValue> = {}
    for (const descriptor of brick?.descriptors ?? []) {
      params[materialKey(descriptor.key)] = descriptor.defaultValue
    }
    return params
  }

  /** Swapping models keeps every value both share — colour and opacity survive a move
   *  from Standard to Physical, so a dialled-in look is not thrown away by curiosity. */
  migrateParams(toId: string, previous: Record<string, ParamValue>): Record<string, ParamValue> {
    const defaults = this.defaultParams(toId)
    const params: Record<string, ParamValue> = { ...defaults }
    for (const key of Object.keys(defaults)) {
      if (key in previous) params[key] = previous[key]
    }
    return params
  }
}

export const DEFAULT_MATERIAL_ID = 'mat-standard'

export const MaterialRegistry = new MaterialRegistryImpl()

MaterialRegistry.registerAll(MATERIAL_BRICKS)
