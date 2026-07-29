import { create } from 'zustand'
import type { ID } from '@/types/audio'
import type { EventTrigger, ModulationConnection, SignalChain } from '@/types/modulation'
import { DEFAULT_EVENT_TRIGGER, DEFAULT_SIGNAL_CHAIN } from '@/types/modulation'
import type { FieldRef, ParamAddress } from '@/types/params'
import { formatAddress } from '@/types/params'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { generateId } from '@/utils/stemColors'

/** The modulation graph is PROJECT-GLOBAL (docs/03-ARCHITECTURE.md HC-8).
 *
 *  A VisualState holds a set of *activations* — which connections are live and any
 *  per-state weight overrides — rather than owning connections itself. If routing lived
 *  inside states, every timeline cut would hard-reset every envelope in the project,
 *  which is musically wrong in the common case: you want "drums → scale" to survive the
 *  cut and only the scene to change. */

interface ModulationState {
  connections: ModulationConnection[]
  triggers: EventTrigger[]

  connect: (source: FieldRef, target: ParamAddress, chain?: Partial<SignalChain>) => ID
  disconnect: (id: ID) => void
  updateConnection: (id: ID, patch: Partial<ModulationConnection>) => void
  updateChain: (id: ID, patch: Partial<SignalChain>) => void

  addTrigger: (source: FieldRef, target: ParamAddress) => ID
  removeTrigger: (id: ID) => void
  updateTrigger: (id: ID, patch: Partial<EventTrigger>) => void

  /** Every connection pointing at one address. */
  connectionsFor: (address: ParamAddress) => ModulationConnection[]
  /** Drop everything routed to or from an object, e.g. when it is deleted. */
  releaseObject: (objectId: ID) => void
  /** Drop everything routed at one effect's parameters, when the effect is removed. */
  releaseEffect: (objectId: ID, effectId: ID) => void
  clear: () => void
}

export const useModulationStore = create<ModulationState>((set, get) => ({
  connections: [],
  triggers: [],

  connect: (source, target, chain) => {
    const id = generateId()
    set((s) => ({
      connections: [
        ...s.connections,
        { id, source, target, chain: { ...DEFAULT_SIGNAL_CHAIN, ...chain }, enabled: true },
      ],
    }))
    return id
  },

  disconnect: (id) => {
    // Drop the follower too, or a later connection reusing this id inherits its
    // envelope state and the first frame after reconnecting is wrong.
    ModulationMatrix.releaseConnection(id)
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }))
  },

  updateConnection: (id, patch) =>
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  updateChain: (id, patch) =>
    set((s) => ({
      connections: s.connections.map((c) =>
        c.id === id ? { ...c, chain: { ...c.chain, ...patch } } : c,
      ),
    })),

  addTrigger: (source, target) => {
    const id = generateId()
    set((s) => ({
      triggers: [...s.triggers, { id, source, target, ...DEFAULT_EVENT_TRIGGER }],
    }))
    return id
  },

  removeTrigger: (id) => set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) })),

  updateTrigger: (id, patch) =>
    set((s) => ({ triggers: s.triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  connectionsFor: (address) => {
    const key = formatAddress(address)
    return get().connections.filter((c) => formatAddress(c.target) === key)
  },

  releaseObject: (objectId) =>
    set((s) => {
      for (const c of s.connections) {
        if (c.target.objectId === objectId) ModulationMatrix.releaseConnection(c.id)
      }
      return {
        connections: s.connections.filter(
          (c) => c.target.objectId !== objectId && c.source.sourceId !== objectId,
        ),
        triggers: s.triggers.filter((t) => t.target.objectId !== objectId),
      }
    }),

  releaseEffect: (objectId, effectId) =>
    set((s) => {
      const orphaned = (target: { objectId: ID; effectId?: ID }) =>
        target.objectId === objectId && target.effectId === effectId

      for (const c of s.connections) {
        if (orphaned(c.target)) ModulationMatrix.releaseConnection(c.id)
      }
      return {
        connections: s.connections.filter((c) => !orphaned(c.target)),
        triggers: s.triggers.filter((t) => !orphaned(t.target)),
      }
    }),

  clear: () => {
    ModulationMatrix.reset()
    set({ connections: [], triggers: [] })
  },
}))
