import * as THREE from 'three'
import type { EffectInstance } from '@/types/visual'
import { EffectRegistry } from './EffectRegistry'
import type { DeformContext } from './effects/types'

/** Per-object deformation state.
 *
 *  Geometry from BrickRegistry is SHARED between every object using the same brick and
 *  parameters. Deforming it in place would deform every one of them. So an object with
 *  an active deformer stack gets its own working copy, rebuilt only when the source
 *  geometry actually changes.
 *
 *  Objects with no deformers keep the shared geometry and allocate nothing — the common
 *  case stays free. */
export class DeformRuntime {
  private working: THREE.BufferGeometry | null = null
  private source: THREE.BufferGeometry | null = null
  private base = new Float32Array(0)
  private directions = new Float32Array(0)

  private readonly context: DeformContext = {
    positions: new Float32Array(0),
    base: new Float32Array(0),
    directions: new Float32Array(0),
    vertexCount: 0,
    params: {},
  }

  /** Produce the geometry to render this frame.
   *  Returns the shared source untouched when nothing is deforming it. */
  resolve(
    source: THREE.BufferGeometry,
    effects: EffectInstance[],
    resolveParams: (effect: EffectInstance) => Record<string, number>,
  ): THREE.BufferGeometry {
    const active = effects.filter(
      (e) => e.enabled && EffectRegistry.get(e.effectId)?.family === 'geometry',
    )

    if (active.length === 0) {
      this.release()
      return source
    }

    this.sync(source)
    const working = this.working
    if (!working) return source

    const positions = working.getAttribute('position') as THREE.BufferAttribute
    const array = positions.array as Float32Array

    // Every frame starts from the undisplaced mesh. Deformers then stack in order —
    // accumulating on last frame's output instead would compound without bound and make
    // the result depend on frame history rather than on time (HC-3).
    array.set(this.base)

    const ctx = this.context
    ctx.positions = array
    ctx.base = this.base
    ctx.directions = this.directions
    ctx.vertexCount = this.base.length / 3

    for (const effect of active) {
      const brick = EffectRegistry.get(effect.effectId)
      if (!brick) continue
      ctx.params = resolveParams(effect)
      brick.apply(ctx)
    }

    positions.needsUpdate = true
    // Lighting is wrong without this — displaced faces keep their old normals and the
    // shape reads flat while it moves.
    working.computeVertexNormals()
    working.computeBoundingSphere()

    return working
  }

  /** Rebuild the working copy when the source geometry changes identity. */
  private sync(source: THREE.BufferGeometry): void {
    if (this.source === source && this.working) return

    this.disposeWorking()
    this.source = source
    this.working = source.clone()

    const position = source.getAttribute('position')
    this.base = Float32Array.from(position.array as Float32Array)

    const direction = source.getAttribute('baseDirection')
    if (direction) {
      this.directions = Float32Array.from(direction.array as Float32Array)
    } else {
      // Primitive geometries carry no baseDirection. Normalising the position gives a
      // usable outward vector for anything not centred on a vertex.
      this.directions = new Float32Array(this.base.length)
      for (let i = 0; i < this.base.length; i += 3) {
        const x = this.base[i]
        const y = this.base[i + 1]
        const z = this.base[i + 2]
        const length = Math.hypot(x, y, z) || 1
        this.directions[i] = x / length
        this.directions[i + 1] = y / length
        this.directions[i + 2] = z / length
      }
    }
  }

  /** Drop the working copy and fall back to the shared geometry. */
  release(): void {
    if (!this.working) return
    this.disposeWorking()
    this.source = null
    this.base = new Float32Array(0)
    this.directions = new Float32Array(0)
  }

  dispose(): void {
    this.release()
  }

  private disposeWorking(): void {
    this.working?.dispose()
    this.working = null
  }
}
