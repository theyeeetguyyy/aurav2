import type { ParamValue } from '@/types/params'
import { BUILTIN_POST_BRICKS } from './bricks/builtins'
import { SHADER_POST_BRICKS } from './bricks/shaders'
import { ONE_BIT_POST_BRICKS } from './bricks/onebit'
import { feedbackBrick } from './bricks/feedback'
import { POST_GROUPS, type PostBrick, type PostGroup } from './types'

/** PostRegistry — the whole-frame operator catalogue.
 *
 *  Third registry alongside BrickRegistry (builds geometry) and EffectRegistry (modifies
 *  geometry), because a post brick does neither: it operates on the rendered image. Same
 *  contract as the other two — registration is data, so adding an effect never means
 *  editing a switch statement anywhere. */

class PostRegistryImpl {
  private readonly bricks = new Map<string, PostBrick>()

  register(brick: PostBrick): void {
    if (this.bricks.has(brick.id)) {
      console.warn(`[PostRegistry] "${brick.id}" already registered; ignoring duplicate`)
      return
    }
    this.bricks.set(brick.id, brick)
  }

  registerAll(bricks: PostBrick[]): void {
    for (const brick of bricks) this.register(brick)
  }

  get(id: string): PostBrick | null {
    return this.bricks.get(id) ?? null
  }

  list(): PostBrick[] {
    return [...this.bricks.values()]
  }

  /** Catalogue in library order: grouped, and groups ordered as a signal chain reads. */
  listByGroup(): { group: PostGroup; bricks: PostBrick[] }[] {
    return POST_GROUPS.map((group) => ({
      group,
      bricks: this.list().filter((brick) => brick.group === group),
    })).filter((entry) => entry.bricks.length > 0)
  }

  defaultParams(id: string): Record<string, ParamValue> {
    const brick = this.get(id)
    if (!brick) return {}
    const params: Record<string, ParamValue> = {}
    for (const descriptor of brick.descriptors) params[descriptor.key] = descriptor.defaultValue
    return params
  }
}

export const PostRegistry = new PostRegistryImpl()

PostRegistry.registerAll([
  ...BUILTIN_POST_BRICKS,
  ...SHADER_POST_BRICKS,
  ...ONE_BIT_POST_BRICKS,
  feedbackBrick,
])
