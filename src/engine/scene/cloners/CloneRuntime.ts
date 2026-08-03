import * as THREE from 'three'
import type { EffectInstance } from '@/types/visual'
import type { ParamValue } from '@/types/params'
import { EffectRegistry } from '../EffectRegistry'
import {
  isCloner,
  isEffector,
  MAX_CLONES,
  type CloneBuffers,
  type ClonerContext,
  type EffectorContext,
} from './types'

/** Per-object clone state.
 *
 *  Buffers are allocated once at MAX_CLONES and never resized, which is what makes clone
 *  count safe to drive at frame rate: raising it changes the draw count, not an
 *  allocation. Every frame starts from the cloner's layout and re-applies the effector
 *  stack, exactly as `DeformRuntime` restarts from the undisplaced mesh — accumulating on
 *  last frame's output would compound without bound and make the result depend on frame
 *  history rather than on time (HC-3). */
export class CloneRuntime {
  private readonly buffers: CloneBuffers = {
    count: 0,
    position: new Float32Array(MAX_CLONES * 3),
    rotation: new Float32Array(MAX_CLONES * 3),
    scale: new Float32Array(MAX_CLONES * 3),
    tint: new Float32Array(MAX_CLONES * 3),
  }

  private readonly clonerContext: ClonerContext = { params: {}, clones: this.buffers }
  private readonly effectorContext: EffectorContext = { params: {}, clones: this.buffers, time: 0 }

  // Scratch for matrix composition. Reused — this runs count× per frame.
  private readonly matrix = new THREE.Matrix4()
  private readonly translation = new THREE.Vector3()
  private readonly quaternion = new THREE.Quaternion()
  private readonly euler = new THREE.Euler()
  private readonly scaleVector = new THREE.Vector3()
  private readonly colour = new THREE.Color()

  /** Resolve this frame's clones. Returns 0 when nothing in the stack is a cloner. */
  resolve(
    effects: EffectInstance[],
    time: number,
    resolveParams: (effect: EffectInstance) => Record<string, ParamValue>,
  ): number {
    const active = effects.filter(
      (e) => e.enabled && EffectRegistry.get(e.effectId)?.family === 'instancing',
    )
    if (active.length === 0) {
      this.buffers.count = 0
      return 0
    }

    // At most one cloner. Two layouts would each want to own every clone's base
    // transform, and the second would simply overwrite the first — so the first wins and
    // the UI can say so, rather than silently doing half of what was asked.
    let laidOut = false
    for (const effect of active) {
      const brick = EffectRegistry.get(effect.effectId)
      if (!brick || !isCloner(brick) || laidOut) continue
      this.clonerContext.params = resolveParams(effect)
      brick.layout(this.clonerContext)
      laidOut = true
    }

    // An effector with no cloner has nothing to affect. Rather than doing nothing at all,
    // treat the object as a single clone so the stack still reads as live.
    if (!laidOut) {
      this.buffers.count = 0
      return 0
    }

    this.effectorContext.time = time
    for (const effect of active) {
      const brick = EffectRegistry.get(effect.effectId)
      if (!brick || !isEffector(brick)) continue
      this.effectorContext.params = resolveParams(effect)
      brick.affect(this.effectorContext)
    }

    return this.buffers.count
  }

  /** Write the resolved clones into an InstancedMesh. */
  applyTo(mesh: THREE.InstancedMesh): void {
    const { count, position, rotation, scale, tint } = this.buffers
    mesh.count = count

    for (let i = 0; i < count; i++) {
      const o = i * 3
      this.translation.set(position[o], position[o + 1], position[o + 2])
      this.euler.set(rotation[o], rotation[o + 1], rotation[o + 2])
      this.quaternion.setFromEuler(this.euler)
      this.scaleVector.set(scale[o], scale[o + 1], scale[o + 2])
      this.matrix.compose(this.translation, this.quaternion, this.scaleVector)
      mesh.setMatrixAt(i, this.matrix)

      if (mesh.instanceColor) {
        this.colour.setRGB(tint[o], tint[o + 1], tint[o + 2])
        mesh.setColorAt(i, this.colour)
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    // Instance transforms live outside the geometry, so Three cannot derive the culling
    // volume itself. Without this a ring of clones vanishes the moment the object's own
    // origin leaves the frustum.
    mesh.computeBoundingSphere()
  }
}

/** Does this stack lay clones out? Lets the renderer keep the plain single-mesh path
 *  for the common case. */
export function hasCloner(effects: EffectInstance[]): boolean {
  return effects.some((e) => {
    if (!e.enabled) return false
    const brick = EffectRegistry.get(e.effectId)
    return brick != null && isCloner(brick)
  })
}
