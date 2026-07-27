import type { ID } from './audio'
import type { ParamValue } from './params'

export interface Transform3D {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

/** One open layer stack (Figma/Blender outliner model), not fixed shape slots. */
export type SceneObjectType =
  | 'shape'
  | 'light'
  | 'particleEmitter'
  | 'backgroundElement'
  | 'image'

/** Render path (docs/03-ARCHITECTURE.md HC-4).
 *
 *  Three geometry paradigms were previously specified as if they were alternatives.
 *  They are not — each is genuinely best for a different question. Making the render
 *  path an explicit property of an object means all of them are implementable and
 *  comparable *visually* rather than argued about on paper. */
export type RenderBackend = 'mesh' | 'sdf' | 'points'

/** Sub-kind for the mesh backend. Determines morph capability:
 *  - procedural — one shared icosphere topology, any↔any vertex morph
 *  - primitive  — native Three geometry, correct topology and UVs, swap only
 *  - imported   — arbitrary GLTF topology, swap only */
export type MeshKind = 'procedural' | 'primitive' | 'imported'

export interface MaterialParams {
  color: string
  roughness: number
  metalness: number
  emissive: string
  emissiveIntensity: number
  opacity: number
  wireframe: boolean
  flatShading: boolean
}

export interface SceneObject {
  id: ID
  name: string
  type: SceneObjectType
  backend: RenderBackend
  meshKind?: MeshKind
  /** Registered brick id, e.g. 'proc-sphere', 'geo-torus-knot'. */
  brickId: string
  transform: Transform3D
  /** Brick-specific values, keyed by ParamDescriptor.key. */
  params: Record<string, ParamValue>
  material: MaterialParams
  /** Ordered effect stack, applied in sequence. */
  effects: EffectInstance[]
  visible: boolean
  locked: boolean
}

export type EffectFamily = 'geometry' | 'instancing' | 'post-process'

export interface EffectInstance {
  id: ID
  /** Registered brick id, e.g. 'def-explode', 'cloner-radial', 'post-bloom'. */
  effectId: string
  name: string
  family: EffectFamily
  params: Record<string, ParamValue>
  enabled: boolean
}

export const DEFAULT_TRANSFORM: Transform3D = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
}

export const DEFAULT_MATERIAL: MaterialParams = {
  color: '#6366f1',
  roughness: 0.35,
  metalness: 0.1,
  emissive: '#000000',
  emissiveIntensity: 0,
  opacity: 1,
  wireframe: false,
  flatShading: false,
}
