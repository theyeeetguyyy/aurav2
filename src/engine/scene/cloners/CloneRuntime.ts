import * as THREE from 'three'
import type { EffectInstance } from '@/types/visual'
import type { Palette } from '../palette'
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
    color: new Float32Array(MAX_CLONES * 3),
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

  /** Resolve this frame's clones. Returns 0 when nothing in the stack is a cloner.
   *
   *  `base` is the object's resolved material colour and `palette` the scene's — both needed because
   *  a colour effector produces absolute values, and its zero state has to be the colour the object
   *  would have had anyway. */
  resolve(
    effects: EffectInstance[],
    time: number,
    resolveParams: (effect: EffectInstance) => Record<string, ParamValue>,
    base?: THREE.Color,
    palette?: Palette,
    source?: THREE.BufferGeometry | null,
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
    this.clonerContext.baseColor = base ? [base.r, base.g, base.b] : undefined
    this.effectorContext.palette = palette

    // The deformed geometry, so copies placed on the surface travel with it rather than sitting where
    // the undeformed shape used to be.
    this.clonerContext.sourcePositions = source?.getAttribute('position')?.array as
      | Float32Array
      | undefined
    this.clonerContext.sourceNormals = source?.getAttribute('normal')?.array as
      | Float32Array
      | undefined

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

  /** Bounding volume of the whole array, in the object's local space.
   *  Written by `applyTo`; read by the renderer for culling and the selection box. */
  readonly bounds = new THREE.Sphere()

  /** Write the resolved clones into an InstancedMesh. */
  applyTo(mesh: THREE.InstancedMesh): void {
    const { count, position, rotation, scale, tint, color } = this.buffers
    mesh.count = count

    // The source geometry's own extent, so the bounds enclose the clones' surfaces
    // rather than just their origins. Only computed when missing — a deformed geometry
    // already had it refreshed by DeformRuntime this frame.
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
    const sourceRadius = mesh.geometry.boundingSphere?.radius ?? 1

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    let maxScale = 0

    for (let i = 0; i < count; i++) {
      const o = i * 3
      const x = position[o]
      const y = position[o + 1]
      const z = position[o + 2]

      this.translation.set(x, y, z)
      this.euler.set(rotation[o], rotation[o + 1], rotation[o + 2])
      this.quaternion.setFromEuler(this.euler)
      this.scaleVector.set(scale[o], scale[o + 1], scale[o + 2])
      this.matrix.compose(this.translation, this.quaternion, this.scaleVector)
      mesh.setMatrixAt(i, this.matrix)

      // Absolute colour × brightness. The material is white on an instanced mesh (see
      // `SceneObjects`), so what lands here is the final colour rather than a modulation of one.
      this.colour.setRGB(color[o] * tint[o], color[o + 1] * tint[o + 1], color[o + 2] * tint[o + 2])
      mesh.setColorAt(i, this.colour)

      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
      const s = Math.max(scale[o], scale[o + 1], scale[o + 2])
      if (s > maxScale) maxScale = s
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Instance transforms live outside the geometry, so Three cannot derive the culling
    // volume itself — without a correct one the whole array vanishes the moment the
    // object's own origin leaves the frustum. Derived from the positions we already have
    // rather than via `computeBoundingSphere()`, which decomposes every matrix again.
    if (count === 0) {
      this.bounds.center.set(0, 0, 0)
      this.bounds.radius = 0
    } else {
      this.bounds.center.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
      this.bounds.radius =
        Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2 + sourceRadius * maxScale
    }

    // A private Sphere per mesh: sharing this object between the render mesh and the
    // selection box would make one of them silently follow the other's culling.
    mesh.boundingSphere ??= new THREE.Sphere()
    mesh.boundingSphere.copy(this.bounds)
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
