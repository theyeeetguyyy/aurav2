import type { ParamValue } from '@/types/params'
import { LIGHT_BRICKS } from './lights'
import type { LightBrick } from './types'

/** LightRegistry — the light catalogue (resolves Q2).
 *
 *  Fifth registry, same contract as the other four: registration is data, so adding a
 *  light type never means editing a branch in the renderer, the inspector, the routing
 *  list or the serialiser. */

class LightRegistryImpl {
  private readonly bricks = new Map<string, LightBrick>()

  register(brick: LightBrick): void {
    if (this.bricks.has(brick.id)) {
      console.warn(`[LightRegistry] "${brick.id}" already registered; ignoring duplicate`)
      return
    }
    this.bricks.set(brick.id, brick)
  }

  registerAll(bricks: LightBrick[]): void {
    for (const brick of bricks) this.register(brick)
  }

  get(id: string): LightBrick | null {
    return this.bricks.get(id) ?? null
  }

  list(): LightBrick[] {
    return [...this.bricks.values()]
  }

  has(id: string): boolean {
    return this.bricks.has(id)
  }

  defaultParams(id: string): Record<string, ParamValue> {
    const brick = this.get(id)
    if (!brick) return {}
    const params: Record<string, ParamValue> = {}
    for (const descriptor of brick.descriptors) params[descriptor.key] = descriptor.defaultValue
    return params
  }
}

export const LightRegistry = new LightRegistryImpl()

LightRegistry.registerAll(LIGHT_BRICKS)
