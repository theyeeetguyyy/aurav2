/** 3D value noise — deterministic, stateless, allocation-free.
 *
 *  Stateless matters more than quality here (HC-3): a deformer must be a pure function
 *  of time so scrubbing backwards and rendering frames out of order both reproduce
 *  exactly what was previewed. Anything seeded by frame count or accumulated per tick
 *  would silently diverge.
 *
 *  Value noise rather than gradient/simplex: for surface displacement the difference is
 *  barely visible, and this needs no permutation table or gradient lookups. */

/** Stable pseudo-random 0–1 from a 3D integer cell. Used by cell-based deformers to
 *  give every fragment its own consistent direction and spin. */
export function hashCell(x: number, y: number, z: number): number {
  return hash(x, y, z)
}

function hash(x: number, y: number, z: number): number {
  // Integer lattice → pseudo-random 0–1. Large irrational multipliers decorrelate axes.
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Value noise in 0–1 at an arbitrary 3D point. */
export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)

  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const fz = smooth(z - iz)

  const c000 = hash(ix, iy, iz)
  const c100 = hash(ix + 1, iy, iz)
  const c010 = hash(ix, iy + 1, iz)
  const c110 = hash(ix + 1, iy + 1, iz)
  const c001 = hash(ix, iy, iz + 1)
  const c101 = hash(ix + 1, iy, iz + 1)
  const c011 = hash(ix, iy + 1, iz + 1)
  const c111 = hash(ix + 1, iy + 1, iz + 1)

  const x00 = c000 + (c100 - c000) * fx
  const x10 = c010 + (c110 - c010) * fx
  const x01 = c001 + (c101 - c001) * fx
  const x11 = c011 + (c111 - c011) * fx

  const y0 = x00 + (x10 - x00) * fy
  const y1 = x01 + (x11 - x01) * fy

  return y0 + (y1 - y0) * fz
}

/** Fractal sum of noise octaves. More octaves = more fine detail, linearly more cost. */
export function fbm3(x: number, y: number, z: number, octaves: number): number {
  let sum = 0
  let amplitude = 1
  let frequency = 1
  let total = 0

  for (let i = 0; i < octaves; i++) {
    sum += noise3(x * frequency, y * frequency, z * frequency) * amplitude
    total += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return total > 0 ? sum / total : 0
}

/** Stable per-vertex random in 0–1, from vertex index. Used for per-vertex jitter that
 *  must not change frame to frame. */
export function vertexRandom(index: number): number {
  const n = Math.sin(index * 12.9898) * 43758.5453
  return n - Math.floor(n)
}

/** Curl of a noise-derived vector potential — a flow field that never converges.
 *
 *  `curl(F)` is divergence-free by construction, which is the whole reason to bother: a plain noise
 *  offset pushes everything it moves towards wherever the noise happens to point, so a set of
 *  positions *bunches into blobs and leaves holes*. A divergence-free field cannot compress, so
 *  things slide past each other in streams and whatever density existed survives. It is how every
 *  fluid-looking particle system does this, and it is a dozen lines rather than a solver.
 *
 *  Lives here rather than beside its first caller because there are now two: the Flow effector
 *  samples it to displace clones, and the Flow line integrates along it to draw a strand. One field
 *  means the two compose — a flow line and a flowed array follow the same current. */
export function curl3(x: number, y: number, z: number, out: [number, number, number]): void {
  const e = 0.35

  // ∂/∂y and ∂/∂z of one potential component, and so on around the cycle. Two noise samples per
  // partial derivative, six per axis pair.
  const dpdy = (noise3(x, y + e, z) - noise3(x, y - e, z)) / (2 * e)
  const dpdz = (noise3(x, y, z + e) - noise3(x, y, z - e)) / (2 * e)

  const qx = x + 31.416
  const dqdz = (noise3(qx, y, z + e) - noise3(qx, y, z - e)) / (2 * e)
  const dqdx = (noise3(qx + e, y, z) - noise3(qx - e, y, z)) / (2 * e)

  const rx = x - 17.213
  const drdx = (noise3(rx + e, y, z) - noise3(rx - e, y, z)) / (2 * e)
  const drdy = (noise3(rx, y + e, z) - noise3(rx, y - e, z)) / (2 * e)

  out[0] = drdy - dqdz
  out[1] = dpdz - drdx
  out[2] = dqdx - dpdy
}
