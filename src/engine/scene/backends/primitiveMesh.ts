import * as THREE from 'three'
import type { ParamDescriptor, ParamValue } from '@/types/params'
import type { GeometryBrick } from './types'

/** Primitive mesh backend — native Three.js geometries (docs/03-ARCHITECTURE.md HC-4).
 *
 *  Correct topology, correct UVs, correct normals. A torus here has a real hole; a
 *  plane is genuinely flat. The cost is that these cannot vertex-morph — they have
 *  different vertex counts and no correspondence — so transitions between them, or
 *  between them and a procedural shape, are crossfades.
 *
 *  morphGroup is null for every brick in this file. That is the whole distinction. */

const num = (params: Record<string, ParamValue>, key: string, fallback: number): number => {
  const value = params[key]
  return typeof value === 'number' ? value : fallback
}

function descriptor(
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
    step: 0.05,
    defaultValue,
    unit: 'm',
    group: 'Geometry',
    exposed: true,
    realtime: false,
    ...options,
  }
}

/** Segment counts are integers and deliberately NOT exposed to modulation:
 *  rebuilding geometry every frame because a knob wiggled is a performance trap.
 *  Continuous shape change belongs to deformers, not to topology. */
function segments(key: string, label: string, min: number, max: number, defaultValue: number): ParamDescriptor {
  return {
    key,
    label,
    type: 'int',
    min,
    max,
    step: 1,
    defaultValue,
    group: 'Resolution',
    exposed: false,
    realtime: false,
  }
}

export const PRIMITIVE_BRICKS: GeometryBrick[] = [
  {
    id: 'geo-box',
    label: 'Box',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('width', 'Width', 0.01, 100, 8),
      descriptor('height', 'Height', 0.01, 100, 8),
      descriptor('depth', 'Depth', 0.01, 100, 8),
      segments('widthSegments', 'Width Segs', 1, 32, 1),
      segments('heightSegments', 'Height Segs', 1, 32, 1),
      segments('depthSegments', 'Depth Segs', 1, 32, 1),
    ],
    build: (p) =>
      new THREE.BoxGeometry(
        num(p, 'width', 8),
        num(p, 'height', 8),
        num(p, 'depth', 8),
        num(p, 'widthSegments', 1),
        num(p, 'heightSegments', 1),
        num(p, 'depthSegments', 1),
      ),
  },
  {
    id: 'geo-sphere',
    label: 'UV Sphere',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('radius', 'Radius', 0.01, 50, 5),
      segments('widthSegments', 'Segments', 3, 128, 32),
      segments('heightSegments', 'Rings', 2, 64, 16),
    ],
    build: (p) =>
      new THREE.SphereGeometry(
        num(p, 'radius', 5),
        num(p, 'widthSegments', 32),
        num(p, 'heightSegments', 16),
      ),
  },
  {
    id: 'geo-torus',
    label: 'Torus',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('radius', 'Radius', 0.01, 50, 5),
      descriptor('tube', 'Tube', 0.01, 20, 1.6),
      segments('radialSegments', 'Radial Segs', 3, 64, 16),
      segments('tubularSegments', 'Tubular Segs', 3, 256, 64),
    ],
    build: (p) =>
      new THREE.TorusGeometry(
        num(p, 'radius', 5),
        num(p, 'tube', 1.6),
        num(p, 'radialSegments', 16),
        num(p, 'tubularSegments', 64),
      ),
  },
  {
    id: 'geo-torus-knot',
    label: 'Torus Knot',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('radius', 'Radius', 0.01, 50, 5),
      descriptor('tube', 'Tube', 0.01, 20, 1.4),
      { ...segments('p', 'P', 1, 20, 2), group: 'Geometry' },
      { ...segments('q', 'Q', 1, 20, 3), group: 'Geometry' },
      segments('tubularSegments', 'Tubular Segs', 3, 512, 128),
      segments('radialSegments', 'Radial Segs', 3, 64, 16),
    ],
    build: (p) =>
      new THREE.TorusKnotGeometry(
        num(p, 'radius', 5),
        num(p, 'tube', 1.4),
        num(p, 'tubularSegments', 128),
        num(p, 'radialSegments', 16),
        num(p, 'p', 2),
        num(p, 'q', 3),
      ),
  },
  {
    id: 'geo-cylinder',
    label: 'Cylinder',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('radiusTop', 'Radius Top', 0, 50, 4),
      descriptor('radiusBottom', 'Radius Bottom', 0, 50, 4),
      descriptor('height', 'Height', 0.01, 100, 10),
      segments('radialSegments', 'Radial Segs', 3, 128, 32),
    ],
    build: (p) =>
      new THREE.CylinderGeometry(
        num(p, 'radiusTop', 4),
        num(p, 'radiusBottom', 4),
        num(p, 'height', 10),
        num(p, 'radialSegments', 32),
      ),
  },
  {
    id: 'geo-cone',
    label: 'Cone',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('radius', 'Radius', 0.01, 50, 4),
      descriptor('height', 'Height', 0.01, 100, 10),
      segments('radialSegments', 'Radial Segs', 3, 128, 32),
    ],
    build: (p) =>
      new THREE.ConeGeometry(num(p, 'radius', 4), num(p, 'height', 10), num(p, 'radialSegments', 32)),
  },
  {
    id: 'geo-plane',
    label: 'Plane',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('width', 'Width', 0.01, 500, 20),
      descriptor('height', 'Height', 0.01, 500, 20),
      segments('widthSegments', 'Width Segs', 1, 256, 1),
      segments('heightSegments', 'Height Segs', 1, 256, 1),
    ],
    build: (p) =>
      new THREE.PlaneGeometry(
        num(p, 'width', 20),
        num(p, 'height', 20),
        num(p, 'widthSegments', 1),
        num(p, 'heightSegments', 1),
      ),
  },
  {
    id: 'geo-ring',
    label: 'Ring',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [
      descriptor('innerRadius', 'Inner Radius', 0, 50, 3),
      descriptor('outerRadius', 'Outer Radius', 0.01, 50, 6),
      segments('thetaSegments', 'Segments', 3, 256, 64),
    ],
    build: (p) =>
      new THREE.RingGeometry(
        num(p, 'innerRadius', 3),
        num(p, 'outerRadius', 6),
        num(p, 'thetaSegments', 64),
      ),
  },
  {
    id: 'geo-dodecahedron',
    label: 'Dodecahedron',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [descriptor('radius', 'Radius', 0.01, 50, 5), segments('detail', 'Detail', 0, 5, 0)],
    build: (p) => new THREE.DodecahedronGeometry(num(p, 'radius', 5), num(p, 'detail', 0)),
  },
  {
    id: 'geo-icosahedron',
    label: 'Icosahedron',
    backend: 'mesh',
    meshKind: 'primitive',
    morphGroup: null,
    descriptors: [descriptor('radius', 'Radius', 0.01, 50, 5), segments('detail', 'Detail', 0, 5, 0)],
    build: (p) => new THREE.IcosahedronGeometry(num(p, 'radius', 5), num(p, 'detail', 0)),
  },
]
