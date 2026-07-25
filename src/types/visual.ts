import type { ID } from './audio'

export interface Transform3D {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

/** Shape types that share base icosphere topology (morphable between each other) */
export type MorphableShapeType = 'sphere' | 'cube' | 'torus-knot' | 'icosahedron' | 'cylinder'

/** Shape types that don't share topology (swap-only, no lerp morph) */
export type SwapOnlyShapeType = 'custom-gltf'

export type ShapeType = MorphableShapeType | SwapOnlyShapeType

export interface Shape {
  id: ID
  name: string
  type: ShapeType
  transform: Transform3D
  materialColor: string
  materialRoughness: number
  materialMetalness: number
  /** Stack of deformers applied in order */
  deformerIds: ID[]
  /** Cloner config if shape is being replicated */
  clonerId: ID | null
  visible: boolean
}

/** Deformer types */
export type DeformerType = 'explode' | 'perlin-noise' | 'twist' | 'waveform-displace' | 'pulse'

export interface Deformer {
  id: ID
  type: DeformerType
  /** Deformer-specific parameters */
  params: Record<string, number>
  enabled: boolean
}

/** Cloner replication modes */
export type ClonerMode = 'linear' | 'radial' | 'grid'

export interface ClonerConfig {
  id: ID
  mode: ClonerMode
  count: number
  radius: number
  spacing: number
  /** Stack of effectors applied to cloner instances */
  effectorIds: ID[]
}

export type EffectorType = 'step' | 'random' | 'delay'

export interface EffectorConfig {
  id: ID
  type: EffectorType
  params: Record<string, number>
  enabled: boolean
}
