import { axisIndexOf, axisParam, deformParam, type DeformerBrick } from './types'
import { fbm3, hashCell, vertexRandom } from './noise'

/** The deformer library (docs/06-ROADMAP.md 4G).
 *
 *  These are the original brief's vocabulary made real:
 *    "drums make the sphere explode and reform within the hit time of the kick" → Explode
 *    "guns make it transform, stretching out, protruding out"                   → Spike
 *    "perlin noise wave (sub-bass driven)"                                      → Noise
 *
 *  ── Two rules every deformer here obeys ──
 *
 *  1. **No built-in motion** (D-36). A deformer is a pure function of its parameters and
 *     has no access to time. Anything that moves does so because a Field is driving it.
 *     Where travel is wanted, the deformer exposes `phase` and the user wires a saw LFO.
 *
 *  2. **Structurally distinct.** Each entry is a different *class* of vertex operation,
 *     not a variation on one. Radial, axial, field-based, angular, periodic, cellular,
 *     distance-ring, gravitational, warp, discretising, point-field, normalising. Fifteen
 *     genuinely different mathematical behaviours, which is what makes them combine into
 *     something larger than the sum. */

const num = (params: Record<string, number>, key: string, fallback: number): number => {
  const value = params[key]
  return Number.isFinite(value) ? value : fallback
}

const TAU = Math.PI * 2

/** Rotate a point in the plane spanned by two axis indices, about the origin. */
function rotatePlane(
  positions: Float32Array,
  offset: number,
  a: number,
  b: number,
  theta: number,
): void {
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const va = positions[offset + a]
  const vb = positions[offset + b]
  positions[offset + a] = va * cos - vb * sin
  positions[offset + b] = va * sin + vb * cos
}

const PHASE = (label = 'Phase') =>
  deformParam('phase', label, 0, 1, 0, {
    // Wire a saw LFO here for continuous travel, or an envelope for a one-shot sweep.
    // This is where motion comes from now — see D-36.
    step: 0.001,
  })

export const DEFORMER_BRICKS: DeformerBrick[] = [
  // ─────────────────────────────────────────────────────── radial, uniform
  {
    id: 'def-explode',
    label: 'Explode',
    family: 'geometry',
    driver: 'strength',
    hint: 'Vertices burst outward along their original normals. The kick deformer.',
    descriptors: [deformParam('strength', 'Strength', -20, 20, 0), deformParam('spread', 'Spread', 0, 1, 0.35)],
    apply({ positions, directions, vertexCount, params }) {
      const strength = num(params, 'strength', 0)
      if (strength === 0) return
      const spread = num(params, 'spread', 0)

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        // Jitter keyed on vertex index, never on time — the shard pattern must stay
        // fixed as the shape bursts, or the surface boils instead of shattering.
        const jitter = 1 - spread + spread * vertexRandom(i) * 2
        const push = strength * jitter
        positions[o] += directions[o] * push
        positions[o + 1] += directions[o + 1] * push
        positions[o + 2] += directions[o + 2] * push
      }
    },
  },

  // ─────────────────────────────────────────────────────── axial, concentrated
  {
    id: 'def-spike',
    label: 'Spike / Protrude',
    family: 'geometry',
    driver: 'amount',
    hint: 'Elongates along one axis. Sharpness narrows it from a bulge to a needle.',
    descriptors: [
      deformParam('amount', 'Amount', -30, 30, 0),
      deformParam('sharpness', 'Sharpness', 1, 16, 4),
      deformParam('bidirectional', 'Both Ends', 0, 1, 1),
      axisParam(),
    ],
    apply({ positions, directions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const sharpness = num(params, 'sharpness', 4)
      const both = num(params, 'bidirectional', 1) >= 0.5
      const axis = axisIndexOf(params)

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const alignment = directions[o + axis]
        // dot(normal, axis)^sharpness concentrates displacement near the pole.
        const facing = both ? Math.abs(alignment) : Math.max(0, alignment)
        const weight = Math.pow(facing, sharpness)
        if (weight < 1e-4) continue
        positions[o + axis] += amount * weight * (both && alignment < 0 ? -1 : 1)
      }
    },
  },

  // ─────────────────────────────────────────────────────── field-based, organic
  {
    id: 'def-noise',
    label: 'Noise Wave',
    family: 'geometry',
    driver: 'amount',
    hint: 'Organic turbulence along the normals. Wire Amount to sub-bass, Phase to an LFO.',
    descriptors: [
      deformParam('amount', 'Amount', -20, 20, 0),
      deformParam('scale', 'Scale', 0.05, 4, 0.5),
      PHASE('Drift'),
      deformParam('detail', 'Detail', 1, 4, 2, { step: 1, type: 'int', realtime: false }),
    ],
    apply({ positions, base, directions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const scale = num(params, 'scale', 0.5)
      // Phase walks the noise field. A saw LFO here reads as flowing turbulence.
      const drift = num(params, 'phase', 0) * 10
      const octaves = Math.max(1, Math.round(num(params, 'detail', 2)))

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        // Sampled at the UNDISPLACED position, so the pattern stays anchored to the
        // surface instead of swimming as other deformers move vertices around.
        const n =
          fbm3(base[o] * scale + drift, base[o + 1] * scale, base[o + 2] * scale - drift, octaves) -
          0.5
        const push = n * amount * 2
        positions[o] += directions[o] * push
        positions[o + 1] += directions[o + 1] * push
        positions[o + 2] += directions[o + 2] * push
      }
    },
  },

  // ─────────────────────────────────────────────────────── angular, along axis
  {
    id: 'def-twist',
    label: 'Twist',
    family: 'geometry',
    driver: 'angle',
    hint: 'Corkscrew shear — rotation grows along an axis.',
    descriptors: [
      deformParam('angle', 'Angle', -720, 720, 0, { unit: 'deg' }),
      deformParam('falloff', 'Falloff', 0.1, 10, 1),
      axisParam(),
    ],
    apply({ positions, vertexCount, params }) {
      const angle = num(params, 'angle', 0)
      if (angle === 0) return
      const falloff = num(params, 'falloff', 1)
      const axis = axisIndexOf(params)
      const radians = (angle * Math.PI) / 180
      const a = (axis + 1) % 3
      const b = (axis + 2) % 3

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        rotatePlane(positions, o, a, b, radians * (positions[o + axis] / (10 * falloff)))
      }
    },
  },

  // ─────────────────────────────────────────────────────── angular, by radius
  {
    id: 'def-vortex',
    label: 'Vortex',
    family: 'geometry',
    driver: 'angle',
    hint: 'Whirlpool — the centre spins hardest and the edges trail behind.',
    descriptors: [
      deformParam('angle', 'Angle', -720, 720, 0, { unit: 'deg' }),
      deformParam('radius', 'Radius', 0.5, 60, 10, { unit: 'm' }),
      axisParam(),
    ],
    apply({ positions, base, vertexCount, params }) {
      const angle = num(params, 'angle', 0)
      if (angle === 0) return
      const radius = Math.max(0.001, num(params, 'radius', 10))
      const axis = axisIndexOf(params)
      const radians = (angle * Math.PI) / 180
      const a = (axis + 1) % 3
      const b = (axis + 2) % 3

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        // Rotation falls off with distance FROM the axis — the inverse of Twist, which
        // grows ALONG it. Same primitive, opposite structure, completely different look.
        const distance = Math.hypot(base[o + a], base[o + b])
        rotatePlane(positions, o, a, b, radians * Math.exp(-distance / radius))
      }
    },
  },

  // ─────────────────────────────────────────────────────── periodic, planar
  {
    id: 'def-wave',
    label: 'Wave',
    family: 'geometry',
    driver: 'amount',
    hint: 'Sine ripple across an axis. Wire Phase to a saw LFO to make it travel.',
    descriptors: [
      deformParam('amount', 'Amount', -20, 20, 0),
      deformParam('frequency', 'Frequency', 0.05, 4, 0.4),
      PHASE(),
      axisParam(),
    ],
    apply({ positions, base, directions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const frequency = num(params, 'frequency', 0.4)
      const phase = num(params, 'phase', 0) * TAU
      const axis = axisIndexOf(params)

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const push = Math.sin(base[o + axis] * frequency * TAU + phase) * amount
        positions[o] += directions[o] * push
        positions[o + 1] += directions[o + 1] * push
        positions[o + 2] += directions[o + 2] * push
      }
    },
  },

  // ─────────────────────────────────────────────────────── distance ring
  {
    id: 'def-shockwave',
    label: 'Shockwave',
    family: 'geometry',
    driver: 'amount',
    hint: 'A ring of displacement at a given distance. Wire Radius to an envelope for a blast.',
    descriptors: [
      deformParam('amount', 'Amount', -20, 20, 0),
      deformParam('radius', 'Radius', 0, 60, 0, { unit: 'm' }),
      deformParam('width', 'Width', 0.1, 20, 2, { unit: 'm' }),
    ],
    apply({ positions, base, directions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const radius = num(params, 'radius', 0)
      const width = Math.max(0.001, num(params, 'width', 2))

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const distance = Math.hypot(base[o], base[o + 1], base[o + 2])
        // Gaussian band at `radius`. Sweeping radius outward drags the band across the
        // surface — a blast front, not a pulse.
        const t = (distance - radius) / width
        const band = Math.exp(-t * t)
        if (band < 1e-4) continue
        const push = amount * band
        positions[o] += directions[o] * push
        positions[o + 1] += directions[o + 1] * push
        positions[o + 2] += directions[o + 2] * push
      }
    },
  },

  // ─────────────────────────────────────────────────────── cellular, rigid
  {
    id: 'def-fracture',
    label: 'Fracture',
    family: 'geometry',
    driver: 'amount',
    hint: 'Breaks the surface into cells that fly apart as rigid chunks, each with its own spin.',
    descriptors: [
      deformParam('amount', 'Amount', 0, 30, 0),
      deformParam('cellSize', 'Cell Size', 0.5, 20, 3, { unit: 'm', realtime: false }),
      deformParam('spin', 'Spin', 0, 720, 120, { unit: 'deg' }),
    ],
    apply({ positions, base, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const cellSize = Math.max(0.001, num(params, 'cellSize', 3))
      const spin = (num(params, 'spin', 0) * Math.PI) / 180

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        // Quantising the BASE position groups neighbouring vertices into one cell, so a
        // chunk moves as a unit. This is what separates fracture from explode: explode
        // displaces every vertex independently and the mesh stretches; fracture moves
        // whole regions and the mesh reads as broken.
        const cx = Math.floor(base[o] / cellSize)
        const cy = Math.floor(base[o + 1] / cellSize)
        const cz = Math.floor(base[o + 2] / cellSize)

        const centreX = (cx + 0.5) * cellSize
        const centreY = (cy + 0.5) * cellSize
        const centreZ = (cz + 0.5) * cellSize
        const length = Math.hypot(centreX, centreY, centreZ) || 1

        const jitter = 0.5 + hashCell(cx, cy, cz)
        const push = amount * jitter

        // Rigid spin about the cell's own centre.
        const angle = spin * (hashCell(cx + 7, cy - 3, cz + 11) - 0.5)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const rx = positions[o] - centreX
        const rz = positions[o + 2] - centreZ

        positions[o] = centreX + rx * cos - rz * sin + (centreX / length) * push
        positions[o + 1] += (centreY / length) * push
        positions[o + 2] = centreZ + rx * sin + rz * cos + (centreZ / length) * push
      }
    },
  },

  // ─────────────────────────────────────────────────────── gravitational, asymmetric
  {
    id: 'def-melt',
    label: 'Melt',
    family: 'geometry',
    driver: 'amount',
    hint: 'Sags under gravity and pools outward at a floor. Asymmetric, unlike everything else here.',
    descriptors: [
      deformParam('amount', 'Amount', 0, 40, 0),
      deformParam('floor', 'Floor', -40, 40, -8, { unit: 'm' }),
      deformParam('spread', 'Spread', 0, 3, 0.8),
    ],
    apply({ positions, base, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const floor = num(params, 'floor', -8)
      const spread = num(params, 'spread', 0.8)

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const height = base[o + 1] - floor
        if (height <= 0) continue

        // Higher material falls further, so the shape slumps rather than translating.
        const fall = Math.min(height, amount * (height / 20) ** 1.5)
        positions[o + 1] -= fall
        // Volume has to go somewhere — push it outward as it lands.
        const pool = fall * spread * 0.1
        positions[o] += base[o] * pool
        positions[o + 2] += base[o + 2] * pool
      }
    },
  },

  // ─────────────────────────────────────────────────────── coordinate warp
  {
    id: 'def-bend',
    label: 'Bend',
    family: 'geometry',
    driver: 'angle',
    hint: 'Curls the whole shape around an arc. A space warp, not a displacement.',
    descriptors: [
      deformParam('angle', 'Angle', -360, 360, 0, { unit: 'deg' }),
      deformParam('falloff', 'Extent', 0.1, 10, 1),
      axisParam(),
    ],
    apply({ positions, vertexCount, params }) {
      const angle = num(params, 'angle', 0)
      if (angle === 0) return
      const extent = num(params, 'falloff', 1)
      const axis = axisIndexOf(params)
      const radians = (angle * Math.PI) / 180
      const perp = (axis + 1) % 3

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        // Rotation IN the (axis, perp) plane by an angle proportional to the along-axis
        // coordinate. A straight rod becomes an arc — geometrically different from Twist,
        // which rotates in the plane perpendicular to its axis.
        rotatePlane(positions, o, axis, perp, radians * (positions[o + axis] / (20 * extent)))
      }
    },
  },

  // ─────────────────────────────────────────────────────── banded radial
  {
    id: 'def-bulge',
    label: 'Bulge / Pinch',
    family: 'geometry',
    driver: 'amount',
    hint: 'Fattens or squeezes a band. Positive bulges, negative pinches.',
    descriptors: [
      deformParam('amount', 'Amount', -2, 2, 0),
      deformParam('center', 'Center', -20, 20, 0, { unit: 'm' }),
      deformParam('width', 'Width', 0.5, 40, 8, { unit: 'm' }),
      axisParam(),
    ],
    apply({ positions, base, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const center = num(params, 'center', 0)
      const width = Math.max(0.001, num(params, 'width', 8))
      const axis = axisIndexOf(params)
      const a = (axis + 1) % 3
      const b = (axis + 2) % 3

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const distance = (base[o + axis] - center) / width
        const scale = 1 + amount * Math.exp(-distance * distance)
        positions[o + a] *= scale
        positions[o + b] *= scale
      }
    },
  },

  // ─────────────────────────────────────────────────────── coupled axes, volume
  {
    id: 'def-squash',
    label: 'Squash & Stretch',
    family: 'geometry',
    driver: 'amount',
    hint: 'Volume-preserving: squash one axis and the others fatten. The bounce primitive.',
    descriptors: [deformParam('amount', 'Amount', -0.9, 4, 0), axisParam()],
    apply({ positions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const axis = axisIndexOf(params)
      const a = (axis + 1) % 3
      const b = (axis + 2) % 3

      // Conserving volume is what makes it read as elastic rather than as a scale.
      // Straight from the classical animation principle.
      const along = 1 + amount
      const across = 1 / Math.sqrt(Math.max(0.001, along))

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        positions[o + axis] *= along
        positions[o + a] *= across
        positions[o + b] *= across
      }
    },
  },

  // ─────────────────────────────────────────────────────── discretisation
  {
    id: 'def-quantize',
    label: 'Quantize',
    family: 'geometry',
    driver: 'amount',
    hint: 'Snaps vertices to a grid. Digital, blocky, and unlike any smooth deformer here.',
    descriptors: [
      deformParam('amount', 'Amount', 0, 1, 0),
      deformParam('step', 'Grid', 0.1, 20, 2, { unit: 'm' }),
    ],
    apply({ positions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const step = Math.max(0.001, num(params, 'step', 2))

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        // Blended rather than hard-snapped, so Amount can be driven for a crystallising
        // transition instead of an on/off switch.
        for (let axis = 0; axis < 3; axis++) {
          const value = positions[o + axis]
          const snapped = Math.round(value / step) * step
          positions[o + axis] = value + (snapped - value) * amount
        }
      }
    },
  },

  // ─────────────────────────────────────────────────────── point field
  {
    id: 'def-attract',
    label: 'Attract / Repel',
    family: 'geometry',
    driver: 'amount',
    hint: 'Pulls toward (or pushes from) a movable point. Wire its position to drag the shape around.',
    descriptors: [
      deformParam('amount', 'Amount', -2, 1, 0),
      deformParam('x', 'Point X', -60, 60, 0, { unit: 'm' }),
      deformParam('y', 'Point Y', -60, 60, 0, { unit: 'm' }),
      deformParam('z', 'Point Z', -60, 60, 0, { unit: 'm' }),
      deformParam('radius', 'Radius', 0.5, 80, 15, { unit: 'm' }),
    ],
    apply({ positions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const tx = num(params, 'x', 0)
      const ty = num(params, 'y', 0)
      const tz = num(params, 'z', 0)
      const radius = Math.max(0.001, num(params, 'radius', 15))

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const dx = tx - positions[o]
        const dy = ty - positions[o + 1]
        const dz = tz - positions[o + 2]
        const distance = Math.hypot(dx, dy, dz)

        // Gaussian falloff — the point has a soft region of influence rather than a hard
        // edge, so sweeping it across the surface deforms smoothly.
        const t = distance / radius
        const influence = Math.exp(-t * t) * amount
        positions[o] += dx * influence
        positions[o + 1] += dy * influence
        positions[o + 2] += dz * influence
      }
    },
  },

  // ─────────────────────────────────────────────────────── normalisation
  {
    id: 'def-spherify',
    label: 'Spherify',
    family: 'geometry',
    driver: 'amount',
    hint: 'Rounds any shape toward a sphere. Negative exaggerates its corners instead.',
    descriptors: [
      deformParam('amount', 'Amount', -1, 1, 0),
      deformParam('radius', 'Radius', 0.5, 60, 8, { unit: 'm' }),
    ],
    apply({ positions, vertexCount, params }) {
      const amount = num(params, 'amount', 0)
      if (amount === 0) return
      const radius = num(params, 'radius', 8)

      for (let i = 0; i < vertexCount; i++) {
        const o = i * 3
        const length = Math.hypot(positions[o], positions[o + 1], positions[o + 2])
        if (length < 1e-5) continue
        // Lerp toward the point at `radius` along the same direction. Negative pushes
        // away from the sphere, exaggerating whatever silhouette is already there.
        const target = radius / length
        const scale = 1 + (target - 1) * amount
        positions[o] *= scale
        positions[o + 1] *= scale
        positions[o + 2] *= scale
      }
    },
  },
]
