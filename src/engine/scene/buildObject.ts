import { BrickRegistry } from './BrickRegistry'
import { LightRegistry } from './lights/LightRegistry'
import { DEFAULT_MATERIAL_ID, MaterialRegistry } from './materials/MaterialRegistry'
import {
  DEFAULT_POINT_MATERIAL_ID,
  isPointMaterial,
  pointsMaterial,
} from './materials/pointMaterials'
import { DEFAULT_LINE_MATERIAL_ID, isLineMaterial } from './materials/lineMaterials'
import { generateId } from '@/utils/stemColors'
import {
  DEFAULT_TRANSFORM,
  type RenderBackend,
  type SceneObject,
  type SceneObjectType,
} from '@/types/visual'

/** Build a SceneObject from a brick id.
 *
 *  Lives here rather than inside `useSceneStore` because two callers need it: adding a shape to
 *  the live scene, and building the default scene a new **state** starts from. A store cannot be
 *  the home of that — `useProjectStore` calling into `useSceneStore` to construct an object it is
 *  about to store somewhere else would be a cycle for no reason.
 *
 *  Everything a brick can decide is asked of the brick. What is decided here is only what a brick
 *  cannot know: where the thing lands, what it is called, and what colour it arrives. */
export function buildObject(
  brickId: string,
  options: {
    type?: SceneObjectType
    /** Existing objects, for a unique name and the next palette colour. */
    siblings?: readonly SceneObject[]
  } = {},
): SceneObject {
  const siblings = options.siblings ?? []
  const lightBrick = LightRegistry.get(brickId)
  const geometryBrick = lightBrick ? null : BrickRegistry.get(brickId)

  const materialId = defaultMaterialFor(geometryBrick?.backend ?? 'mesh')

  // A light lands at eye height and slightly off-axis rather than at the origin: a light inside
  // the object it is meant to light is the least useful default there is.
  const position: [number, number, number] = lightBrick
    ? [12, 14, 12]
    : [...DEFAULT_TRANSFORM.position]

  return {
    id: generateId(),
    name: uniqueName(siblings, lightBrick?.label ?? geometryBrick?.label ?? 'Object'),
    type: options.type ?? (lightBrick ? 'light' : 'shape'),
    backend: geometryBrick?.backend ?? 'mesh',
    meshKind: geometryBrick?.meshKind,
    brickId,
    transform: {
      position,
      rotation: [...DEFAULT_TRANSFORM.rotation],
      scale: [...DEFAULT_TRANSFORM.scale],
    },
    params: lightBrick
      ? LightRegistry.defaultParams(brickId)
      : BrickRegistry.defaultParams(brickId),
    materialId,
    material: MaterialRegistry.defaultParams(materialId),
    // The next slot along, so the second shape does not arrive the same colour as the first — and
    // so re-picking the palette re-colours all of them. A light takes no slot: its colour is a
    // lighting decision, not an identity.
    paletteSlot: lightBrick ? null : siblings.filter((o) => o.type !== 'light').length,
    effects: [],
    visible: true,
    locked: false,
  }
}

/** Can this object be drawn as a cloud of its own vertices?
 *
 *  Any triangle mesh can: a vertex is a point. The reverse is not true — a point brick's buffer has
 *  no faces, so drawing it as a mesh joins unrelated scattered vertices into shards. So the switch
 *  is one-way, and a point brick simply has no switch. */
export function canRenderAsPoints(object: SceneObject): boolean {
  return object.type === 'shape' && BrickRegistry.get(object.brickId)?.backend === 'mesh'
}

/** Which family of material a backend can actually render.
 *
 *  Three families, and every mismatch reads as a bug rather than as a choice: a `PointsMaterial` on
 *  a mesh draws nothing, a `MeshStandardMaterial` on `THREE.Points` draws unshaded squares, and a
 *  mesh material on `THREE.LineSegments` draws black. This is the single authority — the picker
 *  filters through it and `withBackend` repairs through it. */
export function materialFamilyOf(backend: RenderBackend): 'points' | 'lines' | 'surface' {
  if (backend === 'points') return 'points'
  if (backend === 'lines') return 'lines'
  return 'surface'
}

export function materialFamilyOfId(materialId: string): 'points' | 'lines' | 'surface' {
  if (isPointMaterial(materialId)) return 'points'
  if (isLineMaterial(materialId)) return 'lines'
  return 'surface'
}

export function defaultMaterialFor(backend: RenderBackend): string {
  const family = materialFamilyOf(backend)
  if (family === 'points') return DEFAULT_POINT_MATERIAL_ID
  if (family === 'lines') return DEFAULT_LINE_MATERIAL_ID
  return DEFAULT_MATERIAL_ID
}

/** Move an object to a render backend, keeping its material renderable.
 *
 *  The backend and the material are changed together and never separately, because every mismatched
 *  pair looks exactly like the object vanished. Colour survives the swap because the palette owns it.
 *
 *  Shared by the Surface/Points switch and by swapping the brick underneath an object — the second
 *  is where it used to go wrong: a point brick swapped to a sphere kept its point material and the
 *  sphere rendered as nothing. */
export function withBackend(object: SceneObject, backend: RenderBackend): SceneObject {
  const wanted = materialFamilyOf(backend)
  if (wanted === materialFamilyOfId(object.materialId)) return { ...object, backend }

  // Occluding dots, not additive ones — the opposite of what a scatter brick wants. A mesh's
  // vertices are packed tightly along its surface, so additive light accumulates until the cloud is
  // a white smear with colour surviving only at the thin edges. Verified by looking at a torus knot.
  // The scatter bricks are sparse by construction and keep the additive default.
  const materialId = wanted === 'points' ? pointsMaterial.id : defaultMaterialFor(backend)
  const material = MaterialRegistry.migrateParams(materialId, object.material)

  return {
    ...object,
    backend,
    materialId,
    material: wanted === 'points' ? { ...material, size: pointSizeFor(object) } : material,
  }
}

/** A dot size that suits this particular mesh.
 *
 *  One fixed default cannot work. An icosahedron has a few hundred well-spread vertices and reads as
 *  clean dots at 0.6; a torus knot packs thousands into a thin tube and at the same size they merge
 *  into a blocky mass that looks like a rendering fault. Both were tried.
 *
 *  So the size comes from the actual spacing. Spread `count` points over a sphere of `radius` and the
 *  mean gap between them is `√(4πr²/count)`; a dot a little under that reads as separate dots.
 *  Geometry is cached and needed for drawing anyway, so asking for it here costs nothing. */
function pointSizeFor(object: SceneObject): number {
  const geometry = BrickRegistry.buildGeometry(object.brickId, object.params)
  const count = geometry?.getAttribute('position')?.count ?? 0
  if (!geometry || count === 0) return 0.6

  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere?.radius ?? 1
  const gap = Math.sqrt((4 * Math.PI * radius * radius) / count)

  // Clamped to the material's own declared range, so this can never write a value the slider
  // cannot represent.
  return Math.min(8, Math.max(0.02, gap * 0.8))
}

/** "Sphere", "Sphere 2", "Sphere 3" — never a duplicate name in the outliner. */
export function uniqueName(objects: readonly SceneObject[], base: string): string {
  const taken = new Set(objects.map((o) => o.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}
