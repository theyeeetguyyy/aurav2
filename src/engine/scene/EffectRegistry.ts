import type { ParamValue } from '@/types/params'
import type { EffectInstance } from '@/types/visual'
import type { DeformerBrick } from './effects/types'
import { DEFORMER_BRICKS } from './effects/deformers'

/** EffectRegistry — the catalogue of stackable effects.
 *
 *  Separate from BrickRegistry (geometry) because they answer different questions: a
 *  geometry brick BUILDS a mesh, an effect brick MODIFIES one. Both are data — adding an
 *  effect means registering it, never editing a switch statement.
 *
 *  Holds deformers today; cloners/effectors (4H) and post-process (4I) register here too. */

class EffectRegistryImpl {
  private readonly effects = new Map<string, DeformerBrick>()

  register(effect: DeformerBrick): void {
    if (this.effects.has(effect.id)) {
      console.warn(`[EffectRegistry] "${effect.id}" already registered; ignoring duplicate`)
      return
    }
    this.effects.set(effect.id, effect)
  }

  registerAll(effects: DeformerBrick[]): void {
    for (const effect of effects) this.register(effect)
  }

  get(effectId: string): DeformerBrick | null {
    return this.effects.get(effectId) ?? null
  }

  list(): DeformerBrick[] {
    return [...this.effects.values()]
  }

  listByFamily(family: EffectInstance['family']): DeformerBrick[] {
    return this.list().filter((e) => e.family === family)
  }

  defaultParams(effectId: string): Record<string, ParamValue> {
    const effect = this.get(effectId)
    if (!effect) return {}
    const params: Record<string, ParamValue> = {}
    for (const descriptor of effect.descriptors) params[descriptor.key] = descriptor.defaultValue
    return params
  }

  /** Does this stack contain anything that displaces geometry? Lets the renderer keep
   *  the zero-copy fast path for objects with no deformers. */
  hasGeometryEffects(effects: EffectInstance[]): boolean {
    return effects.some((e) => e.enabled && this.get(e.effectId)?.family === 'geometry')
  }
}

export const EffectRegistry = new EffectRegistryImpl()

EffectRegistry.registerAll(DEFORMER_BRICKS)
