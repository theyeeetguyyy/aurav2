import type { ID } from './audio'

export interface Transform3D {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

/** Unified SceneObject type for the open layer stack (Figma/Blender standard).
 *  Shapes, lights, particle emitters, and backgrounds share one layer model. */
export type SceneObjectType = 'shape' | 'particleEmitter' | 'light' | 'backgroundElement' | 'image'

/** Shape types that share base icosphere topology (morphable between each other) */
export type MorphableShapeType = 'sphere' | 'cube' | 'torus-knot' | 'icosahedron' | 'cylinder'
export type SwapOnlyShapeType = 'custom-gltf'

export interface SceneObject {
  id: ID
  name: string
  type: SceneObjectType
  transform: Transform3D
  /** Geometry subtype if object is a shape */
  shapeType?: MorphableShapeType | SwapOnlyShapeType
  materialColor: string
  materialRoughness: number
  materialMetalness: number
  /** Stackable effects (Geometry, Instancing, PostProcess) applied in order */
  effects: EffectInstance[]
  visible: boolean
  locked: boolean
  order: number
}

/** Unified Effect Family categories */
export type EffectFamily = 'geometry' | 'instancing' | 'post-process'

/** Effect instance attached to a SceneObject's effects stack */
export interface EffectInstance {
  id: ID
  /** Registered Effect ID in EffectRegistry (e.g., 'explode', 'noise', 'cloner-radial', 'kaleidoscope') */
  effectId: string
  name: string
  family: EffectFamily
  params: Record<string, number | string | boolean>
  enabled: boolean
}
