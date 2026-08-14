import * as THREE from 'three'
import type { ParamDescriptor, ParamValue } from '@/types/params'
import type { GeometryBrick } from './types'

/** Point clouds — the second way this software puts pixels on screen.
 *
 *  Until this existed, every visual was a lit triangle mesh, optionally duplicated, optionally
 *  filtered. One of three declared `RenderBackend`s was implemented, which is a large part of why
 *  ten users produced eight similar outputs
 *  ([17-EXPRESSIVE-RANGE.md](../../../../docs/17-EXPRESSIVE-RANGE.md)). **A cloud is not a surface**,
 *  and that is the entire point: it reads as a different kind of image, not a variation of the same
 *  one.
 *
 *  ### Why this is a geometry brick and not a particle system
 *
 *  A point cloud here is a `BufferGeometry` of positions rendered as `THREE.Points`. That choice
 *  buys three things for nothing:
 *
 *  1. **Every deformer already works on it.** Deformers displace vertices, and these are vertices.
 *     Fifteen operators arrive with the backend rather than needing point-specific versions.
 *  2. **Cloners, materials, modulation and the palette work unchanged**, for the same reason.
 *  3. **It cannot drift out of sync with the mesh path**, because it *is* the mesh path with a
 *     different renderer at the end.
 *
 *  ### Stateless, deliberately
 *
 *  Positions are a pure function of `(index, params)` and motion comes from deformers, which are pure
 *  functions of `(position, t)`. Nothing accumulates. That is what [D-49](../../../../docs/07-DECISIONS.md)
 *  actually required — it rejected particle *libraries*, every one of which integrates
 *  `position += velocity · dt` and therefore cannot render frame 5000 before frame 12. A stateless
 *  cloud has no such problem, and scrubbing backwards reproduces exactly.
 *
 *  ### Deterministic scatter
 *
 *  Random distributions use a hash of the point index, never `Math.random()`. Rebuilding the same
 *  brick with the same parameters must give the same cloud — otherwise a saved project reopens as a
 *  different picture, and an export would not match its preview. */

/** Points per cloud, capped. Above this the draw is still cheap but the *deformer* pass — which runs
 *  on the CPU over every vertex, every frame — stops being free, and a cloud that stutters is worse
 *  than a smaller one that does not. */
export const MAX_POINTS = 40000

function count(defaultValue: number): ParamDescriptor {
  return {
    key: 'count',
    label: 'Points',
    type: 'int',
    min: 16,
    max: MAX_POINTS,
    step: 1,
    defaultValue,
    group: 'Geometry',
    exposed: true,
    // Rebuilding the buffer at frame rate would re-run the whole distribution and reallocate, so
    // count is a deliberate edit rather than a modulation target (same reason as D-31 for geometry).
    realtime: false,
  }
}

function size(key: string, label: string, defaultValue: number, max = 50): ParamDescriptor {
  return {
    key,
    label,
    type: 'float',
    min: 0,
    max,
    step: max / 200,
    defaultValue,
    unit: 'm',
    group: 'Geometry',
    exposed: true,
    realtime: false,
  }
}

function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampCount(params: Record<string, ParamValue>, fallback: number): number {
  return Math.max(16, Math.min(MAX_POINTS, Math.round(num(params, 'count', fallback))))
}

/** Deterministic pseudo-random in 0–1 from an integer and a salt.
 *
 *  Not `Math.random()`: the same brick with the same parameters must build the same cloud, or a
 *  saved project reopens as a different picture and an export stops matching its preview. */
function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123
  return x - Math.floor(x)
}

/** Build a geometry from a positions writer. Handles the buffer plumbing once. */
function cloud(
  points: number,
  write: (i: number, out: [number, number, number]) => void,
): THREE.BufferGeometry {
  const positions = new Float32Array(points * 3)
  const scratch: [number, number, number] = [0, 0, 0]

  for (let i = 0; i < points; i++) {
    write(i, scratch)
    const o = i * 3
    positions[o] = scratch[0]
    positions[o + 1] = scratch[1]
    positions[o + 2] = scratch[2]
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // Points need a bounding sphere for frustum culling, and Three cannot infer one for a geometry
  // with no index. Without it a cloud vanishes the moment its centre leaves the frustum.
  geometry.computeBoundingSphere()
  return geometry
}

/** Evenly distributed directions on a unit sphere.
 *
 *  The Fibonacci sphere: `acos(1 - 2i/n)` for latitude and the golden angle for longitude. Uniform
 *  random spherical coordinates cluster at the poles, which reads as a mistake rather than as a
 *  cloud — this is the standard fix and it is deterministic, which the random version is not. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function fibonacciDirection(i: number, n: number, out: [number, number, number]): void {
  const y = 1 - (2 * i) / Math.max(1, n - 1)
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = GOLDEN_ANGLE * i
  out[0] = Math.cos(theta) * radius
  out[1] = y
  out[2] = Math.sin(theta) * radius
}

export const POINT_BRICKS: GeometryBrick[] = [
  {
    // The shell. Reads as a form made of dust rather than as a solid, and it is the one that most
    // obviously is not a mesh.
    id: 'pts-sphere-surface',
    label: 'Point Shell',
    backend: 'points',
    meshKind: 'procedural',
    morphGroup: null,
    descriptors: [count(4000), size('radius', 'Radius', 6)],
    build: (p) => {
      const n = clampCount(p, 4000)
      const radius = num(p, 'radius', 6)
      return cloud(n, (i, out) => {
        fibonacciDirection(i, n, out)
        out[0] *= radius
        out[1] *= radius
        out[2] *= radius
      })
    },
  },
  {
    // Filled, so the interior reads through the surface. Cube-root on the radius keeps the density
    // even — without it points bunch at the centre, because volume grows as r³.
    id: 'pts-sphere-volume',
    label: 'Point Cloud',
    backend: 'points',
    meshKind: 'procedural',
    morphGroup: null,
    descriptors: [count(8000), size('radius', 'Radius', 8)],
    build: (p) => {
      const n = clampCount(p, 8000)
      const radius = num(p, 'radius', 8)
      return cloud(n, (i, out) => {
        fibonacciDirection(i, n, out)
        const r = radius * Math.cbrt(hash(i, 3.7))
        out[0] *= r
        out[1] *= r
        out[2] *= r
      })
    },
  },
  {
    // A slab. The one that becomes a floor, a ceiling or a starfield depending on where it is put,
    // and the one deformers do the most interesting things to because it starts flat.
    id: 'pts-box',
    label: 'Point Field',
    backend: 'points',
    meshKind: 'procedural',
    morphGroup: null,
    descriptors: [
      count(12000),
      size('width', 'Width', 40, 200),
      size('height', 'Height', 0, 200),
      size('depth', 'Depth', 40, 200),
    ],
    build: (p) => {
      const n = clampCount(p, 12000)
      const w = num(p, 'width', 40)
      const h = num(p, 'height', 0)
      const d = num(p, 'depth', 40)
      return cloud(n, (i, out) => {
        out[0] = (hash(i, 1.1) - 0.5) * w
        out[1] = (hash(i, 2.3) - 0.5) * h
        out[2] = (hash(i, 5.9) - 0.5) * d
      })
    },
  },
  {
    // A ring of dust. Square-root on the radius keeps an annulus even, for the same reason the
    // volume case needs a cube root.
    id: 'pts-disc',
    label: 'Point Disc',
    backend: 'points',
    meshKind: 'procedural',
    morphGroup: null,
    descriptors: [
      count(6000),
      size('radius', 'Radius', 14, 100),
      size('inner', 'Inner Radius', 4, 100),
      size('thickness', 'Thickness', 0.5, 50),
    ],
    build: (p) => {
      const n = clampCount(p, 6000)
      const outer = num(p, 'radius', 14)
      const inner = Math.min(num(p, 'inner', 4), outer)
      const thickness = num(p, 'thickness', 0.5)
      return cloud(n, (i, out) => {
        const angle = hash(i, 7.3) * Math.PI * 2
        const t = hash(i, 4.1)
        const r = Math.sqrt(inner * inner + t * (outer * outer - inner * inner))
        out[0] = Math.cos(angle) * r
        out[1] = (hash(i, 9.2) - 0.5) * thickness
        out[2] = Math.sin(angle) * r
      })
    },
  },
  {
    // A helix, because a cloud with structure reads completely differently from one without — and
    // because it is the shape a deformer has the most to argue with.
    id: 'pts-helix',
    label: 'Point Helix',
    backend: 'points',
    meshKind: 'procedural',
    morphGroup: null,
    descriptors: [
      count(6000),
      size('radius', 'Radius', 8, 100),
      size('height', 'Height', 30, 200),
      {
        key: 'turns',
        label: 'Turns',
        type: 'float',
        min: 0.25,
        max: 20,
        step: 0.25,
        defaultValue: 4,
        group: 'Geometry',
        exposed: true,
        realtime: false,
      },
      size('scatter', 'Scatter', 0.8, 20),
    ],
    build: (p) => {
      const n = clampCount(p, 6000)
      const radius = num(p, 'radius', 8)
      const height = num(p, 'height', 30)
      const turns = num(p, 'turns', 4)
      const scatter = num(p, 'scatter', 0.8)
      return cloud(n, (i, out) => {
        const t = i / Math.max(1, n - 1)
        const angle = t * turns * Math.PI * 2
        out[0] = Math.cos(angle) * radius + (hash(i, 1.7) - 0.5) * scatter
        out[1] = (t - 0.5) * height + (hash(i, 8.1) - 0.5) * scatter
        out[2] = Math.sin(angle) * radius + (hash(i, 6.5) - 0.5) * scatter
      })
    },
  },
]
