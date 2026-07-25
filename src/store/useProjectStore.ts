import { create } from 'zustand'
import type { Project, VisualState, Strip, SectionMarker } from '@/types/project'
import type { ID } from '@/types/audio'

interface ProjectState {
  project: Project

  // State library actions
  addState: (state: VisualState) => void
  removeState: (id: ID) => void
  updateState: (id: ID, patch: Partial<VisualState>) => void

  // Timeline strip actions
  addStrip: (strip: Strip) => void
  removeStrip: (id: ID) => void
  updateStrip: (id: ID, patch: Partial<Strip>) => void

  // Marker actions
  addMarker: (marker: SectionMarker) => void
  removeMarker: (id: ID) => void
  updateMarker: (id: ID, patch: Partial<SectionMarker>) => void

  // Project-level
  setProjectName: (name: string) => void
  setBpm: (bpm: number | null) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: {
    name: 'Untitled Project',
    bpm: null,
    statesLibrary: {},
    timelineStrips: [],
    markers: [],
  },

  addState: (state) =>
    set((s) => ({
      project: {
        ...s.project,
        statesLibrary: { ...s.project.statesLibrary, [state.id]: state },
      },
    })),
  removeState: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.project.statesLibrary
      return { project: { ...s.project, statesLibrary: rest } }
    }),
  updateState: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        statesLibrary: {
          ...s.project.statesLibrary,
          [id]: { ...s.project.statesLibrary[id], ...patch },
        },
      },
    })),

  addStrip: (strip) =>
    set((s) => ({
      project: { ...s.project, timelineStrips: [...s.project.timelineStrips, strip] },
    })),
  removeStrip: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        timelineStrips: s.project.timelineStrips.filter((st) => st.id !== id),
      },
    })),
  updateStrip: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        timelineStrips: s.project.timelineStrips.map((st) =>
          st.id === id ? { ...st, ...patch } : st
        ),
      },
    })),

  addMarker: (marker) =>
    set((s) => ({
      project: { ...s.project, markers: [...s.project.markers, marker] },
    })),
  removeMarker: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        markers: s.project.markers.filter((m) => m.id !== id),
      },
    })),
  updateMarker: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        markers: s.project.markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      },
    })),

  setProjectName: (name) => set((s) => ({ project: { ...s.project, name } })),
  setBpm: (bpm) => set((s) => ({ project: { ...s.project, bpm } })),
}))
