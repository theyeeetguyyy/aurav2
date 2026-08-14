import * as THREE from 'three'
import type { ParamDescriptor, ParamValue } from '@/types/params'
import {
  num,
  pathDescriptors,
  pathParam,
  segmentCount,
  strandCount,
  writeStrand,
  type CurveKind,
} from './curves'
import type { GeometryBrick } from './types'

/** Ribbons — a stroke with weight.
 *
 *  The same paths `lineCurve.ts` draws, with a section swept along them. That produces an ordinary
 *  triangle mesh, which means it arrives with everything the mesh backend already has: seven
 *  materials, shadows, reflections, cloners, and the whole deformer stack.
 *
 *  **Why this is a separate brick and not a width slider on a line.** A one-pixel stroke and a lit
 *  twisting band are not two settings of one image — the first is a drawing and the second is an
 *  object, and they are lit, occluded and composited differently. They are also different render
 *  backends, and a parameter that silently changed an object's backend would be the kind of hidden
 *  coupling this codebase has removed twice already.
 *
 *  ### One brick, two very different objects
 *
 *  `sides` and `flatten` together span the whole family. Eight sides at flatten 1 is a round tube —
 *  a wire, a cable, a neon strip. Four sides at flatten 0.1 is a flat band that catches the light on
 *  its face and vanishes edge-on, and with `twist` it is the classic ribbon. Both from one sweep,
 *  because the difference genuinely *is* the section.
 *
 *  The ends are left open, as a curve bevel is in Blender. A cap on a flat band is invisible and on
 *  a tube it is one hole seen only from directly down the axis. */

/** Vertices across every strand of a ribbon.
 *
 *  Lower than the line budget on purpose: a ribbon costs `sides` vertices per sample where a stroke
 *  costs one, and the deformer pass runs over every one of them on the CPU, every frame. */
const MAX_RIBBON_VERTICES = 30000

/** Path defaults for a ribbon. A ribbon is much heavier per sample than a stroke, and a figure that
 *  reads well as forty hairlines reads as a solid mass as forty bands. */
function forRibbon(descriptors: ParamDescriptor[]): ParamDescriptor[] {
  const overrides: Record<string, number> = { strands: 3, segments: 160 }
  return descriptors.map((descriptor) =>
    descriptor.key in overrides
      ? { ...descriptor, defaultValue: overrides[descriptor.key] }
      : descriptor,
  )
}

function sectionDescriptors(): ParamDescriptor[] {
  return [
    pathParam('thickness', 'Thickness', 0.02, 6, 0.5, { unit: 'm' }),
    pathParam('sides', 'Sides', 3, 16, 4, { type: 'int', step: 1 }),
    // 1 is a round section, low values flatten it into a band. The single control that decides
    // whether this reads as a cable or as a ribbon.
    pathParam('flatten', 'Flatten', 0.02, 1, 0.18),
    pathParam('twist', 'Twist', -8, 8, 1, { unit: 'x' }),
  ]
}

/** Vertices per sample × samples must fit the budget, so the section count constrains the length. */
function ribbonSegments(
  params: Record<string, ParamValue>,
  strands: number,
  sides: number,
): number {
  const perSample = strands * sides
  const budget = Math.max(2, Math.floor(MAX_RIBBON_VERTICES / Math.max(1, perSample)) - 1)
  return Math.min(segmentCount(params, strands, 220), budget)
}

/** Sweep a closed section along one polyline.
 *
 *  Frames come from **parallel transport**, not from the Frenet formula: a Frenet normal is
 *  undefined wherever the path is momentarily straight and flips through an inflection, which shows
 *  up as a band that snaps 180° mid-stroke. Parallel transport carries the previous frame forward
 *  with the minimum rotation needed, so a flat band stays flat along the whole path — including the
 *  straight sections of a flow line, where the Frenet version visibly tore. */
function sweep(
  path: Float32Array,
  pathOffset: number,
  samples: number,
  sides: number,
  radius: number,
  flatten: number,
  twist: number,
  positions: Float32Array,
  uvs: Float32Array,
  vertexOffset: number,
): void {
  const point = new THREE.Vector3()
  const next = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const previousTangent = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const rotation = new THREE.Quaternion()

  for (let i = 0; i < samples; i++) {
    const o = pathOffset + i * 3
    point.set(path[o], path[o + 1], path[o + 2])

    // Forward difference, and the last sample reuses the one before it so the final ring is not
    // built from a zero-length tangent.
    const forward = i < samples - 1
    const n = forward ? o + 3 : o - 3
    next.set(path[n], path[n + 1], path[n + 2])
    if (forward) tangent.subVectors(next, point)
    else tangent.subVectors(point, next)
    if (tangent.lengthSq() < 1e-12) tangent.set(0, 0, 1)
    tangent.normalize()

    if (i === 0) {
      // Any vector not parallel to the tangent will do for the first frame; the rest follow from it.
      normal.set(0, 1, 0)
      if (Math.abs(normal.dot(tangent)) > 0.9) normal.set(1, 0, 0)
      normal.crossVectors(tangent, normal).normalize()
    } else {
      // Rotate the previous normal by the same rotation that took the previous tangent to this one.
      rotation.setFromUnitVectors(previousTangent, tangent)
      normal.applyQuaternion(rotation).normalize()
    }

    previousTangent.copy(tangent)
    binormal.crossVectors(tangent, normal).normalize()

    const u = samples > 1 ? i / (samples - 1) : 0
    const spin = twist * u * Math.PI * 2

    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + spin
      const cos = Math.cos(angle) * radius
      // Flatten squashes one axis of the section only, which is what turns a tube into a band
      // without changing its width.
      const sin = Math.sin(angle) * radius * flatten

      const v = vertexOffset + (i * sides + j) * 3
      positions[v] = point.x + normal.x * cos + binormal.x * sin
      positions[v + 1] = point.y + normal.y * cos + binormal.y * sin
      positions[v + 2] = point.z + normal.z * cos + binormal.z * sin

      const t = (vertexOffset / 3 + i * sides + j) * 2
      uvs[t] = u
      uvs[t + 1] = j / sides
    }
  }
}

function ribbonBrick(kind: CurveKind, id: string, label: string): GeometryBrick {
  return {
    id,
    label,
    backend: 'mesh',
    // A real triangle mesh with its own topology — a primitive in the same sense a torus knot is,
    // and swap-only for the same reason.
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [...forRibbon(pathDescriptors(kind)), ...sectionDescriptors()],
    build: (params) => {
      const strands = strandCount(params, 3)
      const sides = Math.max(3, Math.min(16, Math.round(num(params, 'sides', 4))))
      const segments = ribbonSegments(params, strands, sides)
      const samples = segments + 1

      const radius = Math.max(0.001, num(params, 'thickness', 0.5))
      const flatten = Math.max(0.02, Math.min(1, num(params, 'flatten', 0.18)))
      const twist = num(params, 'twist', 1)

      const path = new Float32Array(samples * 3)
      const positions = new Float32Array(strands * samples * sides * 3)
      const uvs = new Float32Array(strands * samples * sides * 2)
      const index = new Uint32Array(strands * segments * sides * 6)

      let cursor = 0
      for (let s = 0; s < strands; s++) {
        writeStrand(kind, params, s, strands, segments, path, 0)

        const vertexOffset = s * samples * sides * 3
        sweep(path, 0, samples, sides, radius, flatten, twist, positions, uvs, vertexOffset)

        const base = s * samples * sides
        for (let i = 0; i < segments; i++) {
          for (let j = 0; j < sides; j++) {
            // The section is closed, so the last side wraps to the first.
            const a = base + i * sides + j
            const b = base + i * sides + ((j + 1) % sides)
            const c = a + sides
            const d = b + sides
            index[cursor++] = a
            index[cursor++] = c
            index[cursor++] = b
            index[cursor++] = b
            index[cursor++] = c
            index[cursor++] = d
          }
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geometry.setIndex(new THREE.BufferAttribute(index, 1))
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
      return geometry
    },
  }
}

export const RIBBON_BRICKS: GeometryBrick[] = [
  ribbonBrick('spiral', 'geo-ribbon-spiral', 'Ribbon Coil'),
  ribbonBrick('flow', 'geo-ribbon-flow', 'Ribbon Flow'),
]
