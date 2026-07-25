import { create } from 'zustand'
import type { ModulationConnection, EventTrigger } from '@/types/modulation'
import type { ID } from '@/types/audio'

interface ModulationState {
  connections: ModulationConnection[]
  eventTriggers: EventTrigger[]

  addConnection: (conn: ModulationConnection) => void
  removeConnection: (id: ID) => void
  updateConnection: (id: ID, patch: Partial<ModulationConnection>) => void

  addEventTrigger: (trigger: EventTrigger) => void
  removeEventTrigger: (id: ID) => void
  updateEventTrigger: (id: ID, patch: Partial<EventTrigger>) => void
}

export const useModulationStore = create<ModulationState>((set) => ({
  connections: [],
  eventTriggers: [],

  addConnection: (conn) =>
    set((s) => ({ connections: [...s.connections, conn] })),
  removeConnection: (id) =>
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
  updateConnection: (id, patch) =>
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  addEventTrigger: (trigger) =>
    set((s) => ({ eventTriggers: [...s.eventTriggers, trigger] })),
  removeEventTrigger: (id) =>
    set((s) => ({ eventTriggers: s.eventTriggers.filter((t) => t.id !== id) })),
  updateEventTrigger: (id, patch) =>
    set((s) => ({
      eventTriggers: s.eventTriggers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
}))
