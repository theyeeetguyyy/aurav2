import type { ParamDescriptor, ParamValue } from '@/types/params'
import { curl3 } from '../effects/noise'

/** Paths — the maths behind the third image family.
 *
 *  A stroke is not a surface and it is not a cloud. It has no area to shade and no volume to
 *  occlude, so it reads as *drawing* rather than as an object, which is the whole reason it belongs
 *  here: the medium was two families wide and every widening pass buys more than the last polish
 *  pass would ([17-EXPRESSIVE-RANGE.md](../../../../docs/17-EXPRESSIVE-RANGE.md) Pass 4).
 *
 *  This file owns only the geometry of a path, and two backends consume it:
 *
 *  - `lineCurve.ts` draws the path itself, as `THREE.LineSegments`.
 *  - `ribbonMesh.ts` sweeps a section along it, producing an ordinary triangle mesh that takes all
 *    seven materials, casts shadows and lights like anything else.
 *
 *  Splitting them that way means "a stroke" and "a stroke with width" are two genuinely different
 *  images from one set of equations, rather than one image with a thickness slider that reads as the
 *  same thing at every value.
 *
 *  ### Strands
 *
 *  Every path draws `strands` copies of itself, spread by phase or by seed. One strand is a wire and
 *  reads as a debug view; twenty is a braid, a bundle or a current, and reads as something drawn.
 *  This is the difference between the family being usable and being a curiosity, so it is on every
 *  path rather than being a cloner's job — a cloner would place rigid copies of one identical
 *  strand, and what makes a bundle read is that no two strands are the same.
 *
 *  ### Deterministic, and static by construction
 *
 *  A path is a pure function of its parameters — no `Math.random()`, no time. Motion arrives the way
 *  it arrives everywhere else in this engine: deformers displacing the vertices, driven by
 *  modulation (D-36). A path with a Noise deformer wired to a stem *is* an audio-reactive strand,
 *  and it costs no new machinery. */

export type CurveKind = 'lissajous' | 'spiral' | 'rose' | 'flow'

/** Total points across all strands, capped.
 *
 *  Sized from the same budget as the point clouds: past this the *deformer* pass, which runs on the
 *  CPU over every vertex every frame, stops being free. A stuttering strand is worse than a shorter
 *  one. */
export const MAX_PATH_POINTS = 20000

const TAU = Math.PI * 2
const DEG = Math.PI / 180

export function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Deterministic pseudo-random in 0–1 from an integer and a salt. Same hash the point clouds use,
 *  for the same reason: a saved project must reopen as the same picture. */
export function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123
  return x - Math.floor(x)
}

/** A geometry parameter. Shared by every brick in this family so their inspectors are consistent. */
export function pathParam(
  key: string,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
  options: Partial<ParamDescriptor> = {},
): ParamDescriptor {
  return {
    key,
    label,
    type: 'float',
    min,
    max,
    step: (max - min) / 200,
    defaultValue,
    group: 'Geometry',
    exposed: true,
    // Every one of these rebuilds the buffer, so none is drivable at frame rate (D-31). Motion comes
    // from deformers, which displace what is already built.
    realtime: false,
    ...options,
  }
}

export function intParam(
  key: string,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
): ParamDescriptor {
  return pathParam(key, label, min, max, defaultValue, { type: 'int', step: 1 })
}

export function toggleParam(key: string, label: string, defaultValue: boolean): ParamDescriptor {
  return pathParam(key, label, 0, 1, 0, { type: 'bool', step: 1, defaultValue, exposed: false })
}

/** Strand count and resolution, shared by every path. */
function strandParams(strands: number, segments: number): ParamDescriptor[] {
  return [
    intParam('strands', 'Strands', 1, 200, strands),
    intParam('segments', 'Resolution', 8, 2000, segments),
  ]
}

/** The descriptors a path exposes. Shared by the line brick and the ribbon brick that draw it, so
 *  the two can never drift into describing the same curve differently. */
export function pathDescriptors(kind: CurveKind): ParamDescriptor[] {
  switch (kind) {
    case 'lissajous':
      return [
        pathParam('size', 'Size', 1, 60, 12, { unit: 'm' }),
        intParam('freqX', 'Freq X', 1, 16, 3),
        intParam('freqY', 'Freq Y', 1, 16, 2),
        intParam('freqZ', 'Freq Z', 0, 16, 4),
        pathParam('phase', 'Phase', 0, 360, 90, { unit: 'deg' }),
        pathParam('spread', 'Strand Spread', 0, 360, 24, { unit: 'deg' }),
        ...strandParams(6, 512),
      ]
    case 'spiral':
      return [
        pathParam('radius', 'Radius', 0.5, 40, 8, { unit: 'm' }),
        pathParam('height', 'Height', 0, 80, 26, { unit: 'm' }),
        pathParam('turns', 'Turns', 0.25, 24, 5),
        // −1 closes the top to a point, +1 closes the bottom. A cone and a horn from one control.
        pathParam('taper', 'Taper', -1, 1, 0),
        pathParam('spread', 'Strand Spread', 0, 360, 180, { unit: 'deg' }),
        ...strandParams(4, 512),
      ]
    case 'rose':
      return [
        pathParam('size', 'Size', 1, 60, 14, { unit: 'm' }),
        // A rose curve r = cos(kθ) with k = petals/divisor. Non-integer k is what makes it close
        // after several loops instead of one, and that is where the dense spirograph figures live.
        intParam('petals', 'Petals', 1, 24, 5),
        intParam('divisor', 'Petal Divisor', 1, 12, 2),
        pathParam('loops', 'Loops', 1, 24, 4),
        pathParam('wobble', 'Depth', 0, 30, 3, { unit: 'm' }),
        pathParam('spread', 'Strand Spread', 0, 4, 0.6),
        ...strandParams(3, 900),
      ]
    case 'flow':
      return [
        pathParam('spawn', 'Spawn Radius', 0.5, 60, 10, { unit: 'm' }),
        // Step × Resolution is the length of a strand, and the two defaults are chosen together so
        // the figure lands inside the default framing. It used to travel 130 units from a 14-unit
        // spawn and ran out of frame in every direction — visible only by looking at it.
        pathParam('step', 'Step', 0.05, 4, 0.35, { unit: 'm' }),
        // The single most expressive control here: large is one slow global swirl, small is
        // turbulence, and the same strands read as smoke or as static depending only on this.
        pathParam('scale', 'Field Scale', 0.005, 0.4, 0.06),
        pathParam('seed', 'Seed', 0, 64, 1, { type: 'int', step: 1 }),
        ...strandParams(40, 160),
      ]
  }
}

export function strandCount(params: Record<string, ParamValue>, fallback: number): number {
  return Math.max(1, Math.min(200, Math.round(num(params, 'strands', fallback))))
}

/** Segments per strand, clamped so `strands × (segments + 1)` stays inside the point budget.
 *
 *  Clamped rather than refused: a user raising Strands to 200 should get thinner strands, not an
 *  error and not a frame-rate collapse. */
export function segmentCount(
  params: Record<string, ParamValue>,
  strands: number,
  fallback: number,
): number {
  const asked = Math.max(2, Math.min(2000, Math.round(num(params, 'segments', fallback))))
  const budget = Math.floor(MAX_PATH_POINTS / Math.max(1, strands)) - 1
  return Math.max(2, Math.min(asked, budget))
}

/** Write one strand's polyline as `segments + 1` points into `out`, starting at `offset` floats.
 *
 *  A writer rather than a `point(u)` function because the flow path integrates: each of its points
 *  follows from the one before it. Integration happens once, at build time, from a seeded start —
 *  so the result is still a pure function of the parameters, which is what HC-3 actually requires.
 *  Nothing accumulates across frames. */
export function writeStrand(
  kind: CurveKind,
  params: Record<string, ParamValue>,
  strand: number,
  strands: number,
  segments: number,
  out: Float32Array,
  offset: number,
): void {
  switch (kind) {
    case 'lissajous':
      return lissajous(params, strand, strands, segments, out, offset)
    case 'spiral':
      return spiral(params, strand, strands, segments, out, offset)
    case 'rose':
      return rose(params, strand, strands, segments, out, offset)
    case 'flow':
      return flow(params, strand, segments, out, offset)
  }
}

/** Even spacing of strands across a spread, and a single strand always sits at zero offset. */
function strandFraction(strand: number, strands: number): number {
  return strands <= 1 ? 0 : strand / strands
}

/** The oscilloscope figure. Two or three sine waves at whole-number ratios, which is what makes it
 *  close into a standing figure rather than wander — and what makes it read as *sound* to anyone who
 *  has seen an XY scope. */
function lissajous(
  params: Record<string, ParamValue>,
  strand: number,
  strands: number,
  segments: number,
  out: Float32Array,
  offset: number,
): void {
  const size = num(params, 'size', 12)
  const fx = Math.max(1, Math.round(num(params, 'freqX', 3)))
  const fy = Math.max(1, Math.round(num(params, 'freqY', 2)))
  const fz = Math.max(0, Math.round(num(params, 'freqZ', 4)))
  const phase = num(params, 'phase', 90) * DEG
  const spread = num(params, 'spread', 24) * DEG * strandFraction(strand, strands)

  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * TAU
    const o = offset + i * 3
    out[o] = Math.sin(fx * u + phase + spread) * size
    out[o + 1] = Math.sin(fy * u + spread) * size
    out[o + 2] = fz === 0 ? 0 : Math.sin(fz * u + phase * 0.5 + spread) * size
  }
}

/** A helix. Several strands spread around the axis is a braid; taper turns it into a cone or a horn.
 *  The one path in the set with an obvious up direction, which is what makes it read as a structure
 *  rather than as a figure. */
function spiral(
  params: Record<string, ParamValue>,
  strand: number,
  strands: number,
  segments: number,
  out: Float32Array,
  offset: number,
): void {
  const radius = num(params, 'radius', 8)
  const height = num(params, 'height', 26)
  const turns = num(params, 'turns', 5)
  const taper = num(params, 'taper', 0)
  const spread = num(params, 'spread', 180) * DEG * strandFraction(strand, strands)

  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const angle = u * turns * TAU + spread
    // Taper scales the radius from one end to the other. Clamped above zero so a full taper closes
    // to a point instead of inverting through the axis.
    const scale = Math.max(0, 1 - Math.abs(taper) * (taper > 0 ? 1 - u : u))
    const r = radius * scale
    const o = offset + i * 3
    out[o] = Math.cos(angle) * r
    out[o + 1] = (u - 0.5) * height
    out[o + 2] = Math.sin(angle) * r
  }
}

/** A rose curve, `r = cos(kθ)`, with `k = petals / divisor`.
 *
 *  Whole `k` gives the familiar flower; a fraction gives the dense overlapping spirograph figures,
 *  which is the reason the divisor is a control rather than a constant. Depth lifts it out of the
 *  plane so it is a form rather than a decal. */
function rose(
  params: Record<string, ParamValue>,
  strand: number,
  strands: number,
  segments: number,
  out: Float32Array,
  offset: number,
): void {
  const size = num(params, 'size', 14)
  const petals = Math.max(1, Math.round(num(params, 'petals', 5)))
  const divisor = Math.max(1, Math.round(num(params, 'divisor', 2)))
  const loops = num(params, 'loops', 4)
  const wobble = num(params, 'wobble', 3)
  // Strands scale rather than rotate: concentric rosettes read as one figure with depth, where
  // rotated copies read as a smeared duplicate.
  const shrink = 1 - num(params, 'spread', 0.6) * strandFraction(strand, strands)
  const k = petals / divisor

  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const theta = u * loops * TAU
    const r = Math.cos(k * theta) * size * shrink
    const o = offset + i * 3
    out[o] = Math.cos(theta) * r
    out[o + 1] = Math.sin(theta) * r
    out[o + 2] = Math.sin(theta * k) * wobble * shrink
  }
}

/** A streamline of the curl-noise field — the same field the Flow effector displaces clones along,
 *  so a flow line and a flowed array follow the same current and can be composed in one scene.
 *
 *  This is the path with no symmetry at all, and it is why the set does not collapse into "regular
 *  figures". Twenty of these read as smoke, hair or a magnetic field. */
function flow(
  params: Record<string, ParamValue>,
  strand: number,
  segments: number,
  out: Float32Array,
  offset: number,
): void {
  const spawn = num(params, 'spawn', 14)
  const step = num(params, 'step', 0.6)
  const scale = Math.max(1e-4, num(params, 'scale', 0.06))
  const seed = num(params, 'seed', 1)

  // Start somewhere in a ball, deterministically. Cube root keeps the starts evenly spread through
  // the volume instead of crowding the centre, exactly as the volume point cloud does.
  const dirX = hash(strand, seed + 1.3) * 2 - 1
  const dirY = hash(strand, seed + 4.7) * 2 - 1
  const dirZ = hash(strand, seed + 8.9) * 2 - 1
  const length = Math.hypot(dirX, dirY, dirZ) || 1
  const radius = spawn * Math.cbrt(hash(strand, seed + 2.1))

  let x = (dirX / length) * radius
  let y = (dirY / length) * radius
  let z = (dirZ / length) * radius

  const v: [number, number, number] = [0, 0, 0]

  for (let i = 0; i <= segments; i++) {
    const o = offset + i * 3
    out[o] = x
    out[o + 1] = y
    out[o + 2] = z

    curl3(x * scale, y * scale, z * scale, v)
    // Normalised, so Step means a distance rather than "whatever the field magnitude happened to
    // be". Without it a strand crawls in weak regions and jumps in strong ones, and the same Step
    // value means something different at every Field Scale.
    const speed = Math.hypot(v[0], v[1], v[2]) || 1
    x += (v[0] / speed) * step
    y += (v[1] / speed) * step
    z += (v[2] / speed) * step
  }
}
