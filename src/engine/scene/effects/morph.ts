import { PROCEDURAL_BRICKS } from '../backends/proceduralMesh'
import { deformParam, type DeformerBrick } from './types'

/** Morph — the original brief's headline requirement, finally performed rather than advertised.
 *
 *  *"Transform btwn any to any possible."* The shared-topology work that makes it possible landed in
 *  Phase 4C: every procedural brick builds exactly `BASE_VERTEX_COUNT` (642) vertices from one welded
 *  icosphere, displaced differently per shape, and a test has enforced that ever since. `canMorph()`
 *  and `morphTargets()` were written at the same time. **Nothing ever used them to move a vertex.**
 *  Until now the inspector said "Can morph into 6 other shapes" and the layer stack drew a ◇ badge
 *  next to a capability the software did not have — the fourth instance of the pattern D-100 names.
 *
 *  ### Why it is an ordinary effect and not a property of the object
 *
 *  Putting `morphTarget` and `morphAmount` on `SceneObject` was the obvious design and the worse one.
 *  As an entry in the effect stack it costs no schema change and no project migration, `Amount` is a
 *  modulation target like every other deformer parameter for free, and — the real gain — **stack
 *  order decides whether you deform the morphed shape or morph the deformed one.** Morph above a
 *  Twist twists the result of the morph; below it, the twist is what gets blended away. Both are
 *  legitimate, and neither needed a decision from us.
 *
 *  ### Why it is a linear vertex lerp and nothing cleverer
 *
 *  Because the topology is shared, vertex *i* of a sphere and vertex *i* of a torus are the same
 *  point on the same base icosphere, displaced differently. So correspondence is free and the
 *  in-between shapes are meaningful rather than the self-intersecting mush that lerping two
 *  arbitrary meshes produces — which is exactly the risk flagged in the original research, and the
 *  reason the 642-vertex invariant exists at all.
 *
 *  The target is built with **this object's own parameters**, not the target brick's defaults. A
 *  sphere of radius 8 morphing into a torus should become a torus of radius 8; against defaults it
 *  would jump in size on the way, which reads as a bug rather than as a transformation. */

/** Only the procedural family shares a topology, so only it can appear here. A primitive, a cloud or
 *  a stroke has its own vertex count and no correspondence — offering them would promise a morph the
 *  backend cannot perform, which is the thing `canMorph()` exists to prevent. */
const MORPH_OPTIONS = PROCEDURAL_BRICKS.map((brick) => ({ value: brick.id, label: brick.label }))

export const morphBrick: DeformerBrick = {
  id: 'def-morph',
  label: 'Morph',
  family: 'geometry',
  driver: 'amount',
  hint: 'Blends this shape into another procedural shape. Wire Amount to a stem and the form transforms on the drop.',
  morphTargetKey: 'target',
  descriptors: [
    deformParam('amount', 'Amount', 0, 1, 0),
    {
      key: 'target',
      label: 'Target Shape',
      type: 'enum',
      min: 0,
      max: Math.max(0, MORPH_OPTIONS.length - 1),
      step: 1,
      // The first entry that is not the usual starting shape, so adding a Morph and dragging Amount
      // shows something immediately rather than blending a sphere into a sphere.
      defaultValue: MORPH_OPTIONS[1]?.value ?? MORPH_OPTIONS[0]?.value ?? '',
      options: MORPH_OPTIONS,
      group: 'Deformer',
      // Switching the target rebuilds a cached geometry, which is a deliberate edit rather than
      // something to drive at frame rate (D-31). Amount is the drivable half.
      exposed: false,
      realtime: false,
    },
  ],
  apply({ positions, vertexCount, params, targetPositions }) {
    const amount = params.amount
    if (!amount || amount <= 0) return

    // Absent when the object is not procedural, or when the target failed to build. Doing nothing is
    // the right answer for both: a cloud has no shape to become.
    if (!targetPositions) return

    const k = amount > 1 ? 1 : amount
    const count = Math.min(vertexCount, targetPositions.length / 3)

    for (let i = 0; i < count; i++) {
      const o = i * 3
      positions[o] += (targetPositions[o] - positions[o]) * k
      positions[o + 1] += (targetPositions[o + 1] - positions[o + 1]) * k
      positions[o + 2] += (targetPositions[o + 2] - positions[o + 2]) * k
    }
  },
}
