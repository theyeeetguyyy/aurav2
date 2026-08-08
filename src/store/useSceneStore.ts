import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import type { ID } from '@/types/audio'
import { formatAddress, type ParamAddress, type ParamValue } from '@/types/params'
import type { EffectInstance, MaterialParams, SceneObject, SceneObjectType } from '@/types/visual'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { EffectRegistry } from '@/engine/scene/EffectRegistry'
import { MaterialRegistry } from '@/engine/scene/materials/MaterialRegistry'
import { buildObject, uniqueName } from '@/engine/scene/buildObject'
import { DEFAULT_PALETTE, type Palette } from '@/engine/scene/palette'
import { axisIndex } from '@/engine/params/ParamRegistry'
import { useModulationStore } from '@/store/useModulationStore'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
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
  /** The active state's colours. Lives here while loaded because the render path reads it every
   *  frame; `useProjectStore` owns it as part of the state and swaps it on a switch. */
  palette: Palette

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


  setPalette: (palette: Palette) => void
  setPaletteColor: (slot: number, color: string) => void
  setPaletteBackground: (start: string, end: string) => void
  /** Bind an object to a palette slot, or null to let it keep its own colour. */
  setPaletteSlot: (id: ID, slot: number | null) => void

  clear: () => void
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
  palette: DEFAULT_PALETTE,
  selectedId: null,

  addObject: (brickId, type) => {
    recordChange('Add object', ['scene'])
    const object = buildObject(brickId, { type, siblings: get().objects })
    set((s) => ({ objects: [...s.objects, object], selectedId: object.id }))
    return object.id
  },

  removeObject: (id) => {
    recordChange('Delete object', ['scene', 'modulation'])
    // Drop any routing that targeted this object, or the matrix keeps evaluating
    // connections pointing at something that no longer exists.
    useModulationStore.getState().releaseObject(id)
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }))
  },

  duplicateObject: (id) => {
    recordChange('Duplicate object', ['scene'])
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

  renameObject: (id, name) => {
    recordChange('Rename object', ['scene'])
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, name: name.trim() || o.name } : o)),
    }))
  },

  reorderObject: (id, toIndex) => {
    recordChange('Reorder object', ['scene'])
    set((s) => {
      const from = s.objects.findIndex((o) => o.id === id)
      if (from === -1) return s
      const clamped = Math.max(0, Math.min(s.objects.length - 1, toIndex))
      if (from === clamped) return s

      const objects = [...s.objects]
      const [moved] = objects.splice(from, 1)
      objects.splice(clamped, 0, moved)
      return { objects }
    })
  },

  setVisible: (id, visible) => {
    recordChange(visible ? 'Show object' : 'Hide object', ['scene'])
    set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, visible } : o)) }))
  },

  setLocked: (id, locked) => {
    recordChange(locked ? 'Lock object' : 'Unlock object', ['scene'])
    set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, locked } : o)) }))
  },

  select: (id) => set({ selectedId: id }),

  setBrick: (id, brickId) => {
    recordChange('Change shape', ['scene'])
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
    }))
  },

  setMaterialBrick: (id, materialId) => {
    recordChange('Change material', ['scene'])
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id
          ? { ...o, materialId, material: MaterialRegistry.migrateParams(materialId, o.material) }
          : o,
      ),
    }))
  },

  setParam: (address, value) => {
    // Coalesced by address: a scrub drag emits a change per pixel, and without this one
    // drag would cost two hundred presses of Ctrl+Z.
    recordChange('Edit parameter', ['scene'], `scene:${formatAddress(address)}`)
    set((s) => ({
      objects: s.objects.map((o) => (o.id === address.objectId ? writeParam(o, address, value) : o)),
    }))
  },

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
    recordChange('Add effect', ['scene'])
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

  reorderEffect: (id, effectId, delta) => {
    recordChange('Reorder effect', ['scene'])
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
    }))
  },

  removeEffect: (id, effectId) => {
    recordChange('Remove effect', ['scene', 'modulation'])
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

  updateEffect: (id, effectId, patch) => {
    recordChange('Update effect', ['scene'])
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id
          ? {
              ...o,
              effects: o.effects.map((e) => (e.id === effectId ? { ...e, ...patch } : e)),
            }
          : o,
      ),
    }))
  },

  setPalette: (palette) => {
    recordChange('Change palette', ['scene', 'environment'])
    set({ palette })

    // The background is drawn by the environment section, and that stays the one render path for
    // it. So a palette *writes* its background once, when chosen, rather than binding to it live —
    // which means you can tweak the background afterwards without the palette fighting you. A
    // palette is a starting point, not a lock.
    const env = useEnvironmentStore.getState()
    env.setParam('background', 'topColor', palette.backgroundEnd)
    env.setParam('background', 'bottomColor', palette.background)
  },

  setPaletteBackground: (start, end) => {
    recordChange('Edit background', ['scene', 'environment'], 'palette:bg')
    set((s) => ({ palette: { ...s.palette, background: start, backgroundEnd: end } }))
    const env = useEnvironmentStore.getState()
    env.setParam('background', 'topColor', end)
    env.setParam('background', 'bottomColor', start)
  },

  setPaletteColor: (slot, color) => {
    // Coalesced per slot: dragging a colour picker is one undo step.
    recordChange('Edit palette', ['scene'], `palette:${slot}`)
    set((s) => {
      const colors = [...s.palette.colors]
      if (slot < 0 || slot >= colors.length) return s
      colors[slot] = color
      return { palette: { ...s.palette, colors } }
    })
  },

  setPaletteSlot: (id, slot) => {
    recordChange('Change object colour', ['scene'])
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, paletteSlot: slot } : o)),
    }))
  },

  clear: () => set({ objects: [], palette: DEFAULT_PALETTE, selectedId: null }),
}))

/** Convenience selector for the currently selected object. */
export function useSelectedObject(): SceneObject | null {
  return useSceneStore((s) => s.objects.find((o) => o.id === s.selectedId) ?? null)
}
