import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import type { ParamValue } from '@/types/params'
import { envDefaults } from '@/engine/environment/sections'

/** The world settings — background, fog, lighting, reflections, grid.
 *
 *  One flat record per section rather than a typed object per aspect: the renderer reads
 *  it by descriptor key, the patchbay addresses it by descriptor key, and a named field
 *  per parameter would mean editing three files to add a knob. */

interface EnvironmentState {
  params: Record<string, Record<string, ParamValue>>
  /** Sections switched off. Grid defaults off in the render sense but on for authoring. */
  disabled: Record<string, boolean>

  setParam: (sectionId: string, paramKey: string, value: ParamValue) => void
  setSectionEnabled: (sectionId: string, enabled: boolean) => void
  reset: () => void
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  params: envDefaults(),
  // Fog off by default. It is a look, not a baseline — and an unexpected one hides the
  // scene the moment the camera moves away from the origin.
  disabled: { fog: true },

  setParam: (sectionId, paramKey, value) => {
    recordChange('Edit world', ['environment'], `env:${sectionId}:${paramKey}`)
    set((s) => ({
      params: {
        ...s.params,
        [sectionId]: { ...s.params[sectionId], [paramKey]: value },
      },
    }))
  },

  setSectionEnabled: (sectionId, enabled) => {
    recordChange(enabled ? 'Enable world section' : 'Disable world section', ['environment'])
    set((s) => ({ disabled: { ...s.disabled, [sectionId]: !enabled } }))
  },

  reset: () => set({ params: envDefaults(), disabled: { fog: true } }),
}))

export function isSectionEnabled(sectionId: string): boolean {
  return useEnvironmentStore.getState().disabled[sectionId] !== true
}
