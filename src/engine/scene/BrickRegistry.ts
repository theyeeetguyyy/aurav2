import type * as THREE from 'three'
import type { ParamValue } from '@/types/params'
import type { GeometryBrick } from './backends/types'
import { canMorph, defaultParams } from './backends/types'
import { PROCEDURAL_BRICKS } from './backends/proceduralMesh'
import { PRIMITIVE_BRICKS } from './backends/primitiveMesh'

/** BrickRegistry — the catalogue of geometry operators.
 *
 *  Registration is data. Adding a shape means adding a brick to a list, never editing
 *  a switch statement in the renderer, the inspector, or the serializer — they all
 *  read from here. */

class BrickRegistryImpl {
  private readonly bricks = new Map<string, GeometryBrick>()
  /** Geometry is expensive to rebuild; cache by brick + parameter signature. */
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>()

  register(brick: GeometryBrick): void {
    if (this.bricks.has(brick.id)) {
      console.warn(`[BrickRegistry] "${brick.id}" is already registered; ignoring duplicate`)
      return
    }
    this.bricks.set(brick.id, brick)
  }

  registerAll(bricks: GeometryBrick[]): void {
    for (const brick of bricks) this.register(brick)
  }

  get(brickId: string): GeometryBrick | null {
    return this.bricks.get(brickId) ?? null
  }

  list(): GeometryBrick[] {
    return [...this.bricks.values()]
  }

  /** Bricks a given brick can vertex-morph into, excluding itself. */
  morphTargets(brickId: string): GeometryBrick[] {
    const source = this.get(brickId)
    if (!source || source.morphGroup === null) return []
    return this.list().filter((b) => b.id !== brickId && canMorph(source, b))
  }

  defaultParams(brickId: string): Record<string, ParamValue> {
    const brick = this.get(brickId)
    return brick ? defaultParams(brick) : {}
  }

  /** Build (or reuse) the geometry for a brick and parameter set.
   *
   *  Cached because React re-renders far more often than parameters actually change,
   *  and geometry construction allocates. Callers must NOT dispose the returned
   *  geometry — it is shared. Use releaseUnused() when tearing down a project. */
  buildGeometry(brickId: string, params: Record<string, ParamValue>): THREE.BufferGeometry | null {
    const brick = this.get(brickId)
    if (!brick) {
      console.warn(`[BrickRegistry] unknown brick "${brickId}"`)
      return null
    }

    const key = this.cacheKey(brickId, brick, params)
    const cached = this.geometryCache.get(key)
    if (cached) return cached

    const geometry = brick.build(params)
    this.geometryCache.set(key, geometry)
    return geometry
  }

  /** Dispose every cached geometry. Call on project close. */
  clearCache(): void {
    for (const geometry of this.geometryCache.values()) geometry.dispose()
    this.geometryCache.clear()
  }

  /** Only descriptor-declared params participate in the cache key, so incidental
   *  extra keys in an object's param bag cannot fragment the cache. */
  private cacheKey(
    brickId: string,
    brick: GeometryBrick,
    params: Record<string, ParamValue>,
  ): string {
    let key = brickId
    for (const descriptor of brick.descriptors) {
      key += `|${descriptor.key}=${String(params[descriptor.key] ?? descriptor.defaultValue)}`
    }
    return key
  }
}

export const BrickRegistry = new BrickRegistryImpl()

// Built-in bricks. Procedural first — it is the morph-compatible family and the
// default choice when adding a shape.
BrickRegistry.registerAll(PROCEDURAL_BRICKS)
BrickRegistry.registerAll(PRIMITIVE_BRICKS)
