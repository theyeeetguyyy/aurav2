import * as THREE from 'three'
import {
  hash,
  intParam,
  num,
  pathDescriptors,
  pathParam,
  segmentCount,
  strandCount,
  toggleParam,
  writeStrand,
  type CurveKind,
} from './curves'
import type { GeometryBrick } from './types'

/** Lines — the third way this software puts pixels on screen.
 *
 *  Meshes are surfaces and clouds are dust. A line is neither: it has no area, so nothing about it
 *  is shaded, and what you see is pure trajectory. That is why it belongs in the vocabulary rather
 *  than being another mesh shape — it is a different *kind* of image, which is the only thing that
 *  moves the ten-project test ([17-EXPRESSIVE-RANGE.md](../../../../docs/17-EXPRESSIVE-RANGE.md)).
 *
 *  ### Indexed segments, always
 *
 *  Every brick here produces one `BufferGeometry` with a position attribute and an **index of
 *  vertex pairs**, drawn as `THREE.LineSegments`. Two consequences, both load-bearing:
 *
 *  1. **Deformers work unmodified**, exactly as they do on a point cloud. A deformer displaces
 *     positions; the index is untouched, so a strand stays connected however far its vertices move.
 *     Fifteen operators arrive with the backend for free.
 *  2. **Connectivity is a property of the brick, not of the draw call.** A polyline and a web of
 *     links between scattered nodes are the same data structure with a different index, which is
 *     what lets both live in one backend instead of needing two.
 *
 *  ### Width
 *
 *  WebGL draws every line one pixel wide and ignores `linewidth` — a hardware limitation, not an
 *  omission here. That is genuinely the right medium for a dense figure of hundreds of strands, and
 *  with Bloom on it is the neon-filament look this audience already knows. Where a stroke needs
 *  *weight*, `ribbonMesh.ts` sweeps a section along the same path and produces a real mesh. The two
 *  are separate bricks because they are separate images, not two settings of one. */

/** Nodes in a web, capped for the same reason `MAX_PATH_POINTS` is: the deformer pass is CPU-side
 *  and runs over every vertex, every frame. The link search is also O(n²) in this number. */
const MAX_WEB_NODES = 1200

/** Build indexed `LineSegments` geometry from a positions writer.
 *
 *  Handles the buffer plumbing once, exactly as `cloud()` does for the point backend. */
function polylines(
  strands: number,
  segments: number,
  write: (strand: number, out: Float32Array, offset: number) => void,
): THREE.BufferGeometry {
  const perStrand = segments + 1
  const positions = new Float32Array(strands * perStrand * 3)
  // Two indices per segment. `Uint32Array` unconditionally: the budget allows more than 65 535
  // vertices, and a silently truncated `Uint16` index draws a corrupted figure rather than failing.
  const index = new Uint32Array(strands * segments * 2)

  let cursor = 0
  for (let s = 0; s < strands; s++) {
    write(s, positions, s * perStrand * 3)

    const base = s * perStrand
    for (let i = 0; i < segments; i++) {
      index[cursor++] = base + i
      index[cursor++] = base + i + 1
    }
  }

  return assemble(positions, index)
}

function assemble(positions: Float32Array, index: Uint32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(index, 1))
  // Lines have no faces to cull against, and Three cannot infer a bounding sphere for a geometry
  // built by hand. Without one a strand vanishes the moment its centre leaves the frustum.
  geometry.computeBoundingSphere()
  return geometry
}

/** One brick per path. Same shape as the point bricks, and for the same reason: the picker is where
 *  people discover what the software can draw, so each distinct figure earns its own entry. */
function pathBrick(kind: CurveKind, id: string, label: string): GeometryBrick {
  return {
    id,
    label,
    backend: 'lines',
    // `MeshKind` is a sub-kind of the mesh backend and means nothing here; `morphGroup: null` is
    // what actually says a stroke cannot vertex-morph into a sphere.
    meshKind: 'procedural',
    morphGroup: null,
    descriptors: pathDescriptors(kind),
    build: (params) => {
      const strands = strandCount(params, 4)
      const segments = segmentCount(params, strands, 256)
      return polylines(strands, segments, (strand, out, offset) =>
        writeStrand(kind, params, strand, strands, segments, out, offset),
      )
    },
  }
}

/** Nodes scattered in a ball, linked to whichever neighbours fall inside a radius.
 *
 *  The one figure here that is not a path at all, and the reason the backend indexes its segments
 *  rather than assuming polylines. It reads as structure — a network, a constellation, a lattice
 *  finding itself — which nothing else in the vocabulary produces at any setting.
 *
 *  O(n²) over the node count, once, at build time and cached by the registry. At the 1 200-node
 *  ceiling that is 720 000 distance tests on a deliberate edit, which is a few milliseconds and
 *  never happens during playback. */
const webBrick: GeometryBrick = {
  id: 'line-web',
  label: 'Web',
  backend: 'lines',
  meshKind: 'procedural',
  morphGroup: null,
  descriptors: [
    intParam('nodes', 'Nodes', 8, MAX_WEB_NODES, 260),
    pathParam('radius', 'Radius', 1, 60, 14, { unit: 'm' }),
    // The control that decides everything: below the mean node spacing it is dust, a little above it
    // is a sparse constellation, well above it is a solid ball of thread.
    pathParam('link', 'Link Distance', 0.25, 30, 5, { unit: 'm' }),
    // Without a cap, raising Link Distance a little past the spacing produces tens of thousands of
    // links and the figure turns to mush. Capping per node keeps the structure legible and the
    // index bounded.
    intParam('maxLinks', 'Links Per Node', 1, 12, 4),
    toggleParam('hollow', 'Hollow', false),
    intParam('seed', 'Seed', 0, 64, 1),
  ],
  build: (params) => {
    const count = Math.max(8, Math.min(MAX_WEB_NODES, Math.round(num(params, 'nodes', 260))))
    const radius = num(params, 'radius', 14)
    const link = num(params, 'link', 4)
    const maxLinks = Math.max(1, Math.min(12, Math.round(num(params, 'maxLinks', 3))))
    const hollow = params.hollow === true
    const seed = num(params, 'seed', 1)

    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Direction from a normalised hash triple, then a radius. Cube root fills the volume evenly;
      // hollow keeps every node on the shell, which reads as a sphere drawn in thread.
      const x = hash(i, seed + 1.3) * 2 - 1
      const y = hash(i, seed + 4.7) * 2 - 1
      const z = hash(i, seed + 8.9) * 2 - 1
      const length = Math.hypot(x, y, z) || 1
      const r = hollow ? radius : radius * Math.cbrt(hash(i, seed + 2.1))
      const o = i * 3
      positions[o] = (x / length) * r
      positions[o + 1] = (y / length) * r
      positions[o + 2] = (z / length) * r
    }

    const linkSq = link * link
    const degree = new Uint8Array(count)
    const index: number[] = []

    for (let a = 0; a < count; a++) {
      for (let b = a + 1; b < count && degree[a] < maxLinks; b++) {
        if (degree[b] >= maxLinks) continue

        const dx = positions[a * 3] - positions[b * 3]
        const dy = positions[a * 3 + 1] - positions[b * 3 + 1]
        const dz = positions[a * 3 + 2] - positions[b * 3 + 2]
        if (dx * dx + dy * dy + dz * dz > linkSq) continue

        index.push(a, b)
        degree[a]++
        degree[b]++
      }
    }

    // A node with no neighbour in range draws nothing, so at a low Link Distance the figure thins
    // out rather than erroring — which is the honest behaviour and also the interesting one.
    return assemble(positions, Uint32Array.from(index))
  },
}

export const LINE_BRICKS: GeometryBrick[] = [
  pathBrick('lissajous', 'line-lissajous', 'Lissajous'),
  pathBrick('spiral', 'line-spiral', 'Spiral'),
  pathBrick('rose', 'line-rose', 'Rosette'),
  pathBrick('flow', 'line-flow', 'Flow Lines'),
  webBrick,
]
