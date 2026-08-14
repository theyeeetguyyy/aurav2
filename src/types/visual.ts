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
export type RenderBackend = 'mesh' | 'sdf' | 'points' | 'lines'

/** Sub-kind for the mesh backend. Determines morph capability:
 *  - procedural — one shared icosphere topology, any↔any vertex morph
 *  - primitive  — native Three geometry, correct topology and UVs, swap only
 *  - imported   — arbitrary GLTF topology, swap only */
export type MeshKind = 'procedural' | 'primitive' | 'imported'

/** Material values, keyed by descriptor key with the `material.` prefix removed.
 *
 *  Open rather than a fixed struct: the previous eight-field interface admitted exactly
 *  one shading model, which is the closed enumeration HC-5 forbids. Which keys are
 *  meaningful is declared by the material brick. */
export type MaterialParams = Record<string, ParamValue>

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
  /** Registered material brick id, e.g. 'mat-standard', 'mat-fresnel'. */
  materialId: string
  material: MaterialParams
  /** Which palette slot this object's colour comes from, or null to use `material.color` directly.
   *
   *  A slot rather than a colour so changing the palette re-colours the whole scene at once — the
   *  edit people actually want, which previously meant visiting every object. Null is the escape
   *  hatch for the one object that has to differ. */
  paletteSlot: number | null
  /** Ordered effect stack, applied in sequence. */
  effects: EffectInstance[]
  visible: boolean
  locked: boolean
}

export type EffectFamily = 'geometry' | 'instancing' | 'post-process'

/** Reserved object id for the project-wide post-processing stack.
 *
 *  Post effects belong to the frame, not to any one object, so they have no SceneObject
 *  to hang off. Giving the stack a reserved id keeps `ParamAddress` unchanged and lets
 *  the patchbay, the modulation matrix and the inspector address a bloom knob exactly
 *  the way they address a deformer knob (HC-5) — no second addressing scheme. */
export const POST_STACK_ID = '@post'

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

