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

/** The three layouts. Everything else is an effector.
 *
 *  Deliberately three and not thirty: a layout answers "where do the copies start", and
 *  line, ring and box are the three answers that are not reachable by putting an effector
 *  on one of the others. A spiral is a radial cloner with a Step effector on Y; a
 *  staircase is a linear cloner with a Step effector on rotation. Adding those as layouts
 *  would be adding presets, which is exactly what this architecture exists to avoid. */

function fill(ctx: ClonerContext, count: number): number {
  const clamped = Math.max(1, Math.min(MAX_CLONES, Math.round(count)))
  ctx.clones.count = clamped

  const { position, rotation, scale, tint } = ctx.clones
  position.fill(0, 0, clamped * 3)
  rotation.fill(0, 0, clamped * 3)
  scale.fill(1, 0, clamped * 3)
  tint.fill(1, 0, clamped * 3)
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

export const CLONER_BRICKS: ClonerBrick[] = [radialCloner, linearCloner, gridCloner]
