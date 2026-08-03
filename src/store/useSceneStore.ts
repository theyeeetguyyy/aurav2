import { create } from 'zustand'
import type { ID } from '@/types/audio'
import type { ParamAddress, ParamValue } from '@/types/params'
import type { EffectInstance, MaterialParams, SceneObject, SceneObjectType } from '@/types/visual'
import { DEFAULT_TRANSFORM } from '@/types/visual'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { EffectRegistry } from '@/engine/scene/EffectRegistry'
import { DEFAULT_MATERIAL_ID, MaterialRegistry } from '@/engine/scene/materials/MaterialRegistry'
import { LightRegistry } from '@/engine/scene/lights/LightRegistry'
import { axisIndex } from '@/engine/params/ParamRegistry'
import { useModulationStore } from '@/store/useModulationStore'
import { generateId } from '@/utils/stemColors'

/** useSceneStore — the open SceneObject layer stack (docs/03-ARCHITECTURE.md).
 *
 *  The centre of the application. Shapes, lights, particle emitters, backgrounds and
 *  images all share one ordered layer model (Figma/Blender outliner), rather than the
 *  rigid primary/secondary shape slots the original design assumed.
 *
 *  Holds plain data only — never a THREE.Object3D, a geometry, or a GPU handle. The
 *  renderer derives Three objects from this; the store never knows they exist. */

interface SceneState {
  /** Ordered back-to-front. Array order IS layer order — no separate index field to
   *  drift out of sync. */
  objects: SceneObject[]
  selectedId: ID | null

  /** Type is inferred from which registry knows the brick — a caller should not have
   *  to know that 'light-spot' is a light. */
  addObject: (brickId: string, type?: SceneObjectType) => ID
  removeObject: (id: ID) => void
  duplicateObject: (id: ID) => ID | null
  renameObject: (id: ID, name: string) => void
  reorderObject: (id: ID, toIndex: number) => void
  setVisible: (id: ID, visible: boolean) => void
  setLocked: (id: ID, locked: boolean) => void
  select: (id: ID | null) => void

  /** Swap an object's geometry brick, keeping any parameters both bricks share. */
  setBrick: (id: ID, brickId: string) => void
  /** Swap an object's shading model, keeping any values both materials share. */
  setMaterialBrick: (id: ID, materialId: string) => void

  setParam: (address: ParamAddress, value: ParamValue) => void
  setMaterial: (id: ID, patch: MaterialParams) => void

  addEffect: (id: ID, effect: EffectInstance) => void
  /** Add by registered brick id, using its declared defaults. */
  addEffectBrick: (id: ID, effectId: string) => ID | null
  removeEffect: (id: ID, effectId: ID) => void
  updateEffect: (id: ID, effectId: ID, patch: Partial<EffectInstance>) => void
  /** Move an effect within the stack. Order is evaluation order. */
  reorderEffect: (id: ID, effectId: ID, delta: number) => void

  clear: () => void
}

/** "Sphere", "Sphere 2", "Sphere 3" — never a duplicate name in the outliner. */
function uniqueName(objects: SceneObject[], base: string): string {
  const taken = new Set(objects.map((o) => o.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Apply a parameter write to an object, returning a new object.
 *  Centralises the mapping from flat address keys onto the structured shape of
 *  SceneObject, so callers only ever deal in addresses. */
function writeParam(object: SceneObject, address: ParamAddress, value: ParamValue): SceneObject {
  if (address.effectId) {
    return {
      ...object,
      effects: object.effects.map((effect) =>
        effect.id === address.effectId
          ? { ...effect, params: { ...effect.params, [address.paramKey]: value } }
          : effect,
      ),
    }
  }

  const [head, axisKey] = address.paramKey.split('.')

  switch (head) {
    case 'position':
    case 'rotation':
    case 'scale': {
      if (typeof value !== 'number') return object

      if (axisKey === 'uniform') {
        return { ...object, transform: { ...object.transform, scale: [value, value, value] } }
      }

      const index = axisIndex(axisKey)
      if (index === -1) return object

      const next: [number, number, number] = [...object.transform[head]]
      next[index] = value
      return { ...object, transform: { ...object.transform, [head]: next } }
    }

    case 'material':
      return { ...object, material: { ...object.material, [axisKey]: value } }

    default:
      return { ...object, params: { ...object.params, [address.paramKey]: value } }
  }
}

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: [],
  selectedId: null,

  addObject: (brickId, type) => {
    const lightBrick = LightRegistry.get(brickId)
    const geometryBrick = lightBrick ? null : BrickRegistry.get(brickId)
    const resolvedType: SceneObjectType = type ?? (lightBrick ? 'light' : 'shape')
    const id = generateId()

    // A light lands at eye height and slightly off-axis rather than at the origin: a
    // light inside the object it is meant to light is the least useful default there is.
    const position: [number, number, number] = lightBrick
      ? [12, 14, 12]
      : [...DEFAULT_TRANSFORM.position]

    set((s) => ({
      objects: [
        ...s.objects,
        {
          id,
          name: uniqueName(s.objects, lightBrick?.label ?? geometryBrick?.label ?? 'Object'),
          type: resolvedType,
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
          effects: [],
          visible: true,
          locked: false,
        },
      ],
      selectedId: id,
    }))

    return id
  },

  removeObject: (id) => {
    // Drop any routing that targeted this object, or the matrix keeps evaluating
    // connections pointing at something that no longer exists.
    useModulationStore.getState().releaseObject(id)
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }))
  },

  duplicateObject: (id) => {
    const source = get().objects.find((o) => o.id === id)
    if (!source) return null

    const newId = generateId()
    set((s) => {
      const index = s.objects.findIndex((o) => o.id === id)
      const copy: SceneObject = {
        ...source,
        id: newId,
        name: uniqueName(s.objects, source.name.replace(/ \d+$/, '')),
        transform: {
          position: [...source.transform.position],
          rotation: [...source.transform.rotation],
          scale: [...source.transform.scale],
        },
        params: { ...source.params },
        material: { ...source.material },
        // Effects get fresh IDs — otherwise both copies' parameter addresses would
        // collide and a modulation connection would drive two objects at once.
        effects: source.effects.map((e) => ({ ...e, id: generateId(), params: { ...e.params } })),
      }
      const objects = [...s.objects]
      objects.splice(index + 1, 0, copy)
      return { objects, selectedId: newId }
    })

    return newId
  },

  renameObject: (id, name) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, name: name.trim() || o.name } : o)),
    })),

  reorderObject: (id, toIndex) =>
    set((s) => {
      const from = s.objects.findIndex((o) => o.id === id)
      if (from === -1) return s
      const clamped = Math.max(0, Math.min(s.objects.length - 1, toIndex))
      if (from === clamped) return s

      const objects = [...s.objects]
      const [moved] = objects.splice(from, 1)
      objects.splice(clamped, 0, moved)
      return { objects }
    }),

  setVisible: (id, visible) =>
    set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, visible } : o)) })),

  setLocked: (id, locked) =>
    set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, locked } : o)) })),

  select: (id) => set({ selectedId: id }),

  setBrick: (id, brickId) =>
    set((s) => ({
      objects: s.objects.map((o) => {
        if (o.id !== id) return o
        const brick = BrickRegistry.get(brickId)
        const defaults = BrickRegistry.defaultParams(brickId)
        // Carry over shared keys (radius stays radius) so swapping brick does not
        // silently reset a shape the user has already dialled in.
        const params: Record<string, ParamValue> = { ...defaults }
        for (const key of Object.keys(defaults)) {
          if (key in o.params) params[key] = o.params[key]
        }
        return {
          ...o,
          brickId,
          backend: brick?.backend ?? o.backend,
          meshKind: brick?.meshKind,
          params,
        }
      }),
    })),

  setMaterialBrick: (id, materialId) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id
          ? { ...o, materialId, material: MaterialRegistry.migrateParams(materialId, o.material) }
          : o,
      ),
    })),

  setParam: (address, value) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === address.objectId ? writeParam(o, address, value) : o)),
    })),

  setMaterial: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? { ...o, material: { ...o.material, ...patch } } : o,
      ),
    })),

  addEffect: (id, effect) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, effects: [...o.effects, effect] } : o)),
    })),

  /** Add an effect by brick id, with its registered defaults. The path the UI uses. */
  addEffectBrick: (id, effectId) => {
    const brick = EffectRegistry.get(effectId)
    if (!brick) return null

    const instanceId = generateId()
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id
          ? {
              ...o,
              effects: [
                ...o.effects,
                {
                  id: instanceId,
                  effectId,
                  name: brick.label,
                  family: brick.family,
                  params: EffectRegistry.defaultParams(effectId),
                  enabled: true,
                },
              ],
            }
          : o,
      ),
    }))
    return instanceId
  },

  reorderEffect: (id, effectId, delta) =>
    set((s) => ({
      objects: s.objects.map((o) => {
        if (o.id !== id) return o
        const from = o.effects.findIndex((e) => e.id === effectId)
        if (from === -1) return o
        const to = Math.max(0, Math.min(o.effects.length - 1, from + delta))
        if (from === to) return o
        const effects = [...o.effects]
        const [moved] = effects.splice(from, 1)
        effects.splice(to, 0, moved)
        return { ...o, effects }
      }),
    })),

  removeEffect: (id, effectId) => {
    // Deleting a deformer must also delete the wires pointing at its parameters.
    // Otherwise the matrix keeps evaluating connections whose target no longer exists —
    // invisible in the patchbay, but still burning a shaper and an envelope every frame.
    useModulationStore.getState().releaseEffect(id, effectId)
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? { ...o, effects: o.effects.filter((e) => e.id !== effectId) } : o,
      ),
    }))
  },

  updateEffect: (id, effectId, patch) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id
          ? {
              ...o,
              effects: o.effects.map((e) => (e.id === effectId ? { ...e, ...patch } : e)),
            }
          : o,
      ),
    })),

  clear: () => set({ objects: [], selectedId: null }),
}))

/** Convenience selector for the currently selected object. */
export function useSelectedObject(): SceneObject | null {
  return useSceneStore((s) => s.objects.find((o) => o.id === s.selectedId) ?? null)
}
