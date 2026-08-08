import { BrickRegistry } from './BrickRegistry'
import { LightRegistry } from './lights/LightRegistry'
import { DEFAULT_MATERIAL_ID, MaterialRegistry } from './materials/MaterialRegistry'
import { generateId } from '@/utils/stemColors'
import { DEFAULT_TRANSFORM, type SceneObject, type SceneObjectType } from '@/types/visual'

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
    materialId: DEFAULT_MATERIAL_ID,
    material: MaterialRegistry.defaultParams(DEFAULT_MATERIAL_ID),
    // The next slot along, so the second shape does not arrive the same colour as the first — and
    // so re-picking the palette re-colours all of them. A light takes no slot: its colour is a
    // lighting decision, not an identity.
    paletteSlot: lightBrick ? null : siblings.filter((o) => o.type !== 'light').length,
    effects: [],
    visible: true,
    locked: false,
  }
}

/** "Sphere", "Sphere 2", "Sphere 3" — never a duplicate name in the outliner. */
export function uniqueName(objects: readonly SceneObject[], base: string): string {
  const taken = new Set(objects.map((o) => o.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}
