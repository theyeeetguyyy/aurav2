import type { ParamValue } from '@/types/params'
import type { EffectInstance } from '@/types/visual'
import type { DeformerBrick } from './effects/types'
import { DEFORMER_BRICKS } from './effects/deformers'
import { CLONER_BRICKS } from './cloners/cloners'
import { EFFECTOR_BRICKS } from './cloners/effectors'
import type { ClonerBrick, EffectorBrick } from './cloners/types'

/** EffectRegistry — the catalogue of stackable effects.
 *
 *  Separate from BrickRegistry (geometry) because they answer different questions: a
 *  geometry brick BUILDS a mesh, an effect brick MODIFIES one. Both are data — adding an
 *  effect means registering it, never editing a switch statement.
 *
 *  Holds three kinds under one roof — deformers, cloners and effectors — because to a
 *  user they are all "things stacked on this object", and because keeping them in one
 *  registry is what lets `allModulationTargets()` find every stacked parameter with a
 *  single lookup. They are told apart by which method they carry, not by a discriminant
 *  field: a deformer has `apply`, a cloner has `layout`, an effector has `affect`. */

export type EffectBrick = DeformerBrick | ClonerBrick | EffectorBrick

class EffectRegistryImpl {
  private readonly effects = new Map<string, EffectBrick>()

  register(effect: EffectBrick): void {
    if (this.effects.has(effect.id)) {
      console.warn(`[EffectRegistry] "${effect.id}" already registered; ignoring duplicate`)
      return
    }
    this.effects.set(effect.id, effect)
  }

  registerAll(effects: EffectBrick[]): void {
    for (const effect of effects) this.register(effect)
  }

  get(effectId: string): EffectBrick | null {
    return this.effects.get(effectId) ?? null
  }

  list(): EffectBrick[] {
    return [...this.effects.values()]
  }

  listByFamily(family: EffectInstance['family']): EffectBrick[] {
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

EffectRegistry.registerAll([...DEFORMER_BRICKS, ...CLONER_BRICKS, ...EFFECTOR_BRICKS])
