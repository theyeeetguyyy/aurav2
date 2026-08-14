import {
  AXIS_CHOICES,
  axisOf,
  cloneChoice,
  cloneParam,
  countParam,
  flag,
  MAX_CLONES,
  num,
  type ClonerBrick,
  type ClonerContext,
} from './types'

/** The five layouts. Everything else is an effector.
 *
 *  The test for admitting one is unchanged: a layout answers "where do the copies start", and it earns
 *  a place only if no effector on an existing layout can produce it. A spiral is a radial cloner with a
 *  Step effector on Y; a staircase is a linear cloner with a Step effector on rotation. Adding those
 *  would be adding presets, which is exactly what this architecture exists to avoid.
 *
 *  Line, ring and box were the first three. **Scatter** and **Surface** pass the same test and were
 *  the gap that mattered most: all three originals are lattices, and an array on a lattice reads as an
 *  array of copies rather than as a form — the loudest "made in a toy" tell in the output. A Random
 *  effector does not close it, because jitter displaces copies *from* lattice points, so the lattice
 *  still sets the density and the count is still locked to `nx·ny·nz`. */

function fill(ctx: ClonerContext, count: number): number {
  const clamped = Math.max(1, Math.min(MAX_CLONES, Math.round(count)))
  ctx.clones.count = clamped

  const { position, rotation, scale, tint, color } = ctx.clones
  position.fill(0, 0, clamped * 3)
  rotation.fill(0, 0, clamped * 3)
  scale.fill(1, 0, clamped * 3)
  tint.fill(1, 0, clamped * 3)

  // Colour seeds from the object's own resolved material colour, so a stack with nothing touching
  // colour renders exactly as it did before this channel existed.
  const [r, g, b] = ctx.baseColor ?? [1, 1, 1]
  for (let i = 0; i < clamped; i++) {
    const o = i * 3
    color[o] = r
    color[o + 1] = g
    color[o + 2] = b
  }
  return clamped
}

export const linearCloner: ClonerBrick = {
  id: 'cloner-linear',
  label: 'Linear Cloner',
  family: 'instancing',
  hint: 'Copies along a line, each one offset from the last. The staircase.',
  descriptors: [
    countParam('count', 'Count', 128, 8),
    cloneParam('stepX', 'Step X', -50, 50, 0, { unit: 'm' }),
    cloneParam('stepY', 'Step Y', -50, 50, 0, { unit: 'm' }),
    cloneParam('stepZ', 'Step Z', -50, 50, 6, { unit: 'm' }),
    cloneParam('stepRotX', 'Rot Step X', -180, 180, 0, { unit: 'deg' }),
    cloneParam('stepRotY', 'Rot Step Y', -180, 180, 0, { unit: 'deg' }),
    cloneParam('stepRotZ', 'Rot Step Z', -180, 180, 0, { unit: 'deg' }),
    cloneParam('stepScale', 'Scale Step', -0.5, 0.5, 0, { unit: 'x' }),
    cloneChoice('centered', 'Centred', true),
  ],
  layout(ctx) {
    const count = fill(ctx, num(ctx.params, 'count', 8))
    const { position, rotation, scale } = ctx.clones

    const sx = num(ctx.params, 'stepX', 0)
    const sy = num(ctx.params, 'stepY', 0)
    const sz = num(ctx.params, 'stepZ', 6)
    const rx = num(ctx.params, 'stepRotX', 0) * DEG
    const ry = num(ctx.params, 'stepRotY', 0) * DEG
    const rz = num(ctx.params, 'stepRotZ', 0) * DEG
    const ss = num(ctx.params, 'stepScale', 0)

    // Centring is the sane default: without it, raising the count makes the array grow
    // off to one side and walk out of frame instead of expanding around the object.
    const origin = flag(ctx.params, 'centered', true) ? -(count - 1) / 2 : 0

    for (let i = 0; i < count; i++) {
      const k = origin + i
      const o = i * 3
      position[o] = k * sx
      position[o + 1] = k * sy
      position[o + 2] = k * sz
      rotation[o] = k * rx
      rotation[o + 1] = k * ry
      rotation[o + 2] = k * rz
      const s = Math.max(0.001, 1 + k * ss)
      scale[o] = s
      scale[o + 1] = s
      scale[o + 2] = s
    }
  },
}

export const radialCloner: ClonerBrick = {
  id: 'cloner-radial',
  label: 'Radial Cloner',
  family: 'instancing',
  hint: 'Copies around a ring. The one from the brief — symmetrical offset.',
  descriptors: [
    countParam('count', 'Count', 128, 8),
    cloneParam('radius', 'Radius', 0, 200, 14, { unit: 'm' }),
    cloneParam('arc', 'Arc', -360, 360, 360, { unit: 'deg' }),
    cloneParam('startAngle', 'Start Angle', -360, 360, 0, { unit: 'deg' }),
    cloneParam('rise', 'Rise', -20, 20, 0, { unit: 'm' }),
    cloneParam('twist', 'Twist', -180, 180, 0, { unit: 'deg' }),
    cloneChoice('axis', 'Plane Normal', 'y', AXIS_CHOICES),
    cloneChoice('align', 'Aim Outward', true),
  ],
  layout(ctx) {
    const count = fill(ctx, num(ctx.params, 'count', 8))
    const { position, rotation } = ctx.clones

    const radius = num(ctx.params, 'radius', 14)
    const arc = num(ctx.params, 'arc', 360) * DEG
    const start = num(ctx.params, 'startAngle', 0) * DEG
    const rise = num(ctx.params, 'rise', 0)
    const twist = num(ctx.params, 'twist', 0) * DEG
    const axis = axisOf(ctx.params)
    const align = flag(ctx.params, 'align', true)

    // A full circle must not place the first and last clone on top of each other, but a
    // partial arc should reach its end angle. Different divisor, same loop.
    const isFullTurn = Math.abs(Math.abs(arc) - Math.PI * 2) < 1e-6
    const divisor = isFullTurn || count === 1 ? count : count - 1

    for (let i = 0; i < count; i++) {
      const t = i / divisor
      const angle = start + arc * t
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const o = i * 3
      const height = rise * (i - (count - 1) / 2)

      if (axis === 0) {
        position[o] = height
        position[o + 1] = radius * s
        position[o + 2] = radius * c
      } else if (axis === 2) {
        position[o] = radius * c
        position[o + 1] = radius * s
        position[o + 2] = height
      } else {
        position[o] = radius * c
        position[o + 1] = height
        position[o + 2] = radius * s
      }

      if (align) {
        // Rotate about the ring's normal so each clone faces outward. Without it a ring
        // of anything non-spherical reads as scattered rather than as arranged.
        rotation[o + axis] = -angle
      }
      rotation[o + ((axis + 1) % 3)] += twist * t
    }
  },
}

export const gridCloner: ClonerBrick = {
  id: 'cloner-grid',
  label: 'Grid Cloner',
  family: 'instancing',
  hint: 'Copies in a 3D box. Walls, floors, volumes of geometry.',
  descriptors: [
    countParam('countX', 'Count X', 32, 4),
    countParam('countY', 'Count Y', 32, 1),
    countParam('countZ', 'Count Z', 32, 4),
    cloneParam('spacingX', 'Spacing X', 0, 50, 8, { unit: 'm' }),
    cloneParam('spacingY', 'Spacing Y', 0, 50, 8, { unit: 'm' }),
    cloneParam('spacingZ', 'Spacing Z', 0, 50, 8, { unit: 'm' }),
  ],
  layout(ctx) {
    const nx = clampCount(num(ctx.params, 'countX', 4))
    const ny = clampCount(num(ctx.params, 'countY', 1))
    const nz = clampCount(num(ctx.params, 'countZ', 4))

    const count = fill(ctx, nx * ny * nz)
    const { position } = ctx.clones

    const dx = num(ctx.params, 'spacingX', 8)
    const dy = num(ctx.params, 'spacingY', 8)
    const dz = num(ctx.params, 'spacingZ', 8)

    let index = 0
    for (let z = 0; z < nz && index < count; z++) {
      for (let y = 0; y < ny && index < count; y++) {
        for (let x = 0; x < nx && index < count; x++) {
          const o = index * 3
          position[o] = (x - (nx - 1) / 2) * dx
          position[o + 1] = (y - (ny - 1) / 2) * dy
          position[o + 2] = (z - (nz - 1) / 2) * dz
          index++
        }
      }
    }
  },
}

function clampCount(value: number): number {
  return Math.max(1, Math.min(32, Math.round(value)))
}

const DEG = Math.PI / 180

/** Deterministic 0–1 from an index and a salt. The same integer hash the point bricks use.
 *
 *  Never `Math.random()`. A layout has to be a pure function of the clone index or a saved project
 *  reopens as a different picture and an export stops matching its preview (HC-3). */
function hash(i: number, salt: number): number {
  let h = (i + 1) * 374761393 + salt * 668265263
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** ─────────────────────────────────────────────── the two non-lattice layouts
 *
 *  A grid with a Random effector is *not* these. Jitter displaces copies from lattice points, so the
 *  lattice is still what sets the density — at low amounts you see a wobbly grid and at high amounts
 *  you see noise, and the count is locked to `nx·ny·nz`. Neither of these has a lattice at all.
 *
 *  This is the answer to the loudest tell in the output: an array of two hundred objects that reads as
 *  an array of two hundred objects (17-EXPRESSIVE-RANGE Pass 3). */
export const scatterCloner: ClonerBrick = {
  id: 'cloner-scatter',
  label: 'Scatter Cloner',
  family: 'instancing',
  hint: 'Copies at random through a volume. No rows to give it away — dust, debris, a swarm at rest.',
  descriptors: [
    countParam('count', 'Count', MAX_CLONES, 120),
    cloneParam('width', 'Width', 0, 200, 40, { unit: 'm' }),
    cloneParam('height', 'Height', 0, 200, 40, { unit: 'm' }),
    cloneParam('depth', 'Depth', 0, 200, 40, { unit: 'm' }),
    // Above zero the box becomes a ball: radius scaled by the cube root of a uniform sample, which is
    // what keeps density even instead of piling copies up at the centre.
    cloneParam('spherical', 'Spherical', 0, 1, 0, { unit: 'x' }),
    // Both default to zero, because the catalogue's rule is that a layout starts every clone at unit
    // scale and no rotation: an effector adds to what the layout produced, so a layout that arrives
    // already varied gives every effector a moving baseline to fight.
    cloneParam('scaleVariation', 'Size Variation', 0, 1, 0, { unit: 'x' }),
    cloneParam('spin', 'Random Spin', 0, 180, 0, { unit: 'deg' }),
    cloneParam('seed', 'Seed', 0, 99, 0, { step: 1, type: 'int' }),
  ],
  layout(ctx) {
    const count = fill(ctx, num(ctx.params, 'count', 64))
    const { position, rotation, scale } = ctx.clones

    const w = num(ctx.params, 'width', 40)
    const h = num(ctx.params, 'height', 40)
    const d = num(ctx.params, 'depth', 40)
    const ball = Math.min(1, Math.max(0, num(ctx.params, 'spherical', 0)))
    const variation = Math.min(1, Math.max(0, num(ctx.params, 'scaleVariation', 0)))
    const spin = num(ctx.params, 'spin', 0) * DEG
    const seed = Math.round(num(ctx.params, 'seed', 0))

    for (let i = 0; i < count; i++) {
      const o = i * 3

      // A direction on the unit sphere, from two hashes. Reused for both distributions so raising
      // Spherical morphs the same cloud rather than replacing it with a different one.
      const cosTheta = hash(i, seed + 1) * 2 - 1
      const phi = hash(i, seed + 2) * Math.PI * 2
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta))
      const radial = Math.cbrt(hash(i, seed + 3))

      const bx = (hash(i, seed + 4) - 0.5) * w
      const by = (hash(i, seed + 5) - 0.5) * h
      const bz = (hash(i, seed + 6) - 0.5) * d

      position[o] = bx + ball * (radial * sinTheta * Math.cos(phi) * (w / 2) - bx)
      position[o + 1] = by + ball * (radial * cosTheta * (h / 2) - by)
      position[o + 2] = bz + ball * (radial * sinTheta * Math.sin(phi) * (d / 2) - bz)

      rotation[o] = (hash(i, seed + 7) * 2 - 1) * spin
      rotation[o + 1] = (hash(i, seed + 8) * 2 - 1) * spin
      rotation[o + 2] = (hash(i, seed + 9) * 2 - 1) * spin

      // Size variation only ever shrinks, so raising it cannot make copies grow out of frame.
      const s = Math.max(0.001, 1 - variation * hash(i, seed + 10))
      scale[o] = s
      scale[o + 1] = s
      scale[o + 2] = s
    }
  },
}

export const surfaceCloner: ClonerBrick = {
  id: 'cloner-surface',
  label: 'Surface Cloner',
  family: 'instancing',
  hint: "Copies over the object's own surface, aligned to it. Scales, studs, fur, a shape made of shapes.",
  descriptors: [
    countParam('count', 'Count', MAX_CLONES, 200),
    // Not optional, and not a unit default. An instanced mesh draws the SAME geometry at every clone,
    // so without a size the studs are the size of the thing they are studding and the object arrives
    // as a solid ball of overlapping copies of itself. 0.15 is the value at which it reads as a
    // surface treatment on arrival.
    cloneParam('size', 'Clone Size', 0.02, 1, 0.15, { unit: 'x' }),
    cloneParam('offset', 'Lift', -10, 20, 0, { unit: 'm' }),
    cloneParam('jitter', 'Jitter', 0, 5, 0, { unit: 'm' }),
    cloneParam('align', 'Align to Surface', 0, 1, 1, { unit: 'x' }),
    cloneParam('scaleVariation', 'Size Variation', 0, 1, 0, { unit: 'x' }),
    cloneParam('seed', 'Seed', 0, 99, 0, { step: 1, type: 'int' }),
  ],
  layout(ctx) {
    const positions = ctx.sourcePositions
    const vertexCount = positions ? positions.length / 3 : 0
    const count = fill(ctx, Math.min(num(ctx.params, 'count', 200), vertexCount || 1))
    if (!positions || vertexCount === 0) return

    const { position, rotation, scale } = ctx.clones
    const normals = ctx.sourceNormals
    const lift = num(ctx.params, 'offset', 0)
    const jitter = num(ctx.params, 'jitter', 0)
    const align = Math.min(1, Math.max(0, num(ctx.params, 'align', 1)))
    const size = Math.max(0.001, num(ctx.params, 'size', 0.15))
    const variation = Math.min(1, Math.max(0, num(ctx.params, 'scaleVariation', 0)))
    const seed = Math.round(num(ctx.params, 'seed', 0))

    for (let i = 0; i < count; i++) {
      const o = i * 3
      // Strided rather than hashed: a hash would revisit the same vertex and leave gaps, while an even
      // stride spreads copies over the whole surface at any count.
      const v = (Math.floor((i * vertexCount) / count) % vertexCount) * 3

      // Prefer the real normal; fall back to the outward direction, which is right for anything
      // roughly centred on the origin and is what the deformers use for the same reason.
      let nx = normals ? normals[v] : positions[v]
      let ny = normals ? normals[v + 1] : positions[v + 1]
      let nz = normals ? normals[v + 2] : positions[v + 2]
      const length = Math.hypot(nx, ny, nz) || 1
      nx /= length
      ny /= length
      nz /= length

      position[o] = positions[v] + nx * lift + (hash(i, seed + 1) - 0.5) * jitter
      position[o + 1] = positions[v + 1] + ny * lift + (hash(i, seed + 2) - 0.5) * jitter
      position[o + 2] = positions[v + 2] + nz * lift + (hash(i, seed + 3) - 0.5) * jitter

      if (align > 0) {
        // Euler XYZ that takes +Y onto the normal. Y because that is the axis a cone, a cylinder and
        // a capsule all point along, so "aligned" means what it looks like it should for the shapes
        // most likely to be used as a stud.
        rotation[o] = align * Math.atan2(-nz, Math.hypot(nx, ny) || 1e-6)
        rotation[o + 2] = align * Math.atan2(nx, ny || 1e-6)
      }

      const s = Math.max(0.001, size * (1 - variation * hash(i, seed + 4)))
      scale[o] = s
      scale[o + 1] = s
      scale[o + 2] = s
    }
  },
}

export const CLONER_BRICKS: ClonerBrick[] = [
  radialCloner,
  linearCloner,
  gridCloner,
  scatterCloner,
  surfaceCloner,
]
