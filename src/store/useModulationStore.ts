import { create } from 'zustand'
import { recordChange } from '@/store/historyHook'
import {
  getProcessorBrick,
  processorDefaults,
  type ModulationProcessor,
  type ProcessorKind,
} from '@/engine/modulation/processors'
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

  /** Shared processing stages, keyed by id. Several wires may reference one, which is the whole
   *  reason they are objects rather than more fields on a chain. */
  processors: Record<ID, ModulationProcessor>

  addProcessor: (kind: ProcessorKind) => ID
  removeProcessor: (id: ID) => void
  setProcessorParam: (id: ID, key: string, value: number) => void
  setProcessorEnabled: (id: ID, enabled: boolean) => void
  renameProcessor: (id: ID, name: string) => void
  /** Insert or remove a processor on one wire. Order is evaluation order. */
  toggleWireProcessor: (connectionId: ID, processorId: ID) => void

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
  processors: {},
  triggers: [],

  addProcessor: (kind) => {
    recordChange('Add processor', ['modulation'])
    const id = generateId()
    const brick = getProcessorBrick(kind)
    set((s) => ({
      processors: {
        ...s.processors,
        [id]: {
          id,
          kind,
          name: brick?.label ?? kind,
          enabled: true,
          params: processorDefaults(kind),
        },
      },
    }))
    return id
  },

  removeProcessor: (id) => {
    recordChange('Remove processor', ['modulation'])
    set((s) => {
      const { [id]: _gone, ...processors } = s.processors
      return {
        processors,
        // Drop the reference from every wire that used it. Leaving a dangling id would work —
        // the matrix skips what it cannot resolve — but the wire would keep claiming a stage it
        // no longer has, and the graph would draw an edge to nothing.
        connections: s.connections.map((connection) =>
          connection.processorIds?.includes(id)
            ? { ...connection, processorIds: connection.processorIds.filter((p) => p !== id) }
            : connection,
        ),
      }
    })
  },

  setProcessorParam: (id, key, value) => {
    recordChange('Edit processor', ['modulation'], `proc:${id}:${key}`)
    set((s) =>
      s.processors[id]
        ? {
            processors: {
              ...s.processors,
              [id]: { ...s.processors[id], params: { ...s.processors[id].params, [key]: value } },
            },
          }
        : s,
    )
  },

  setProcessorEnabled: (id, enabled) => {
    recordChange(enabled ? 'Enable processor' : 'Bypass processor', ['modulation'])
    set((s) =>
      s.processors[id]
        ? { processors: { ...s.processors, [id]: { ...s.processors[id], enabled } } }
        : s,
    )
  },

  renameProcessor: (id, name) => {
    recordChange('Rename processor', ['modulation'], `procName:${id}`)
    set((s) =>
      s.processors[id]
        ? {
            processors: {
              ...s.processors,
              [id]: { ...s.processors[id], name: name.trim() || s.processors[id].name },
            },
          }
        : s,
    )
  },

  toggleWireProcessor: (connectionId, processorId) => {
    recordChange('Change wire processing', ['modulation'])
    set((s) => ({
      connections: s.connections.map((connection) => {
        if (connection.id !== connectionId) return connection
        const current = connection.processorIds ?? []
        return {
          ...connection,
          processorIds: current.includes(processorId)
            ? current.filter((id) => id !== processorId)
            : [...current, processorId],
        }
      }),
    }))
  },

  connect: (source, target, chain) => {
    recordChange('Connect', ['modulation'])
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
    recordChange('Disconnect', ['modulation'])
    // Drop the follower too, or a later connection reusing this id inherits its
    // envelope state and the first frame after reconnecting is wrong.
    ModulationMatrix.releaseConnection(id)
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }))
  },

  updateConnection: (id, patch) => {
    recordChange('Update connection', ['modulation'])
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  },

  updateChain: (id, patch) => {
    // One key per connection: dragging a chain slider is one undo step.
    recordChange('Edit signal chain', ['modulation'], `chain:${id}`)
    set((s) => ({
      connections: s.connections.map((c) =>
        c.id === id ? { ...c, chain: { ...c.chain, ...patch } } : c,
      ),
    }))
  },

  addTrigger: (source, target) => {
    recordChange('Add trigger', ['modulation'])
    const id = generateId()
    set((s) => ({
      triggers: [...s.triggers, { id, source, target, ...DEFAULT_EVENT_TRIGGER }],
    }))
    return id
  },

  removeTrigger: (id) => {
    recordChange('Remove trigger', ['modulation'])
    set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) }))
  },

  updateTrigger: (id, patch) => {
    recordChange('Update trigger', ['modulation'], `trigger:${id}`)
    set((s) => ({ triggers: s.triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
  },

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
    set({ connections: [], triggers: [], processors: {} })
  },
}))

/** Processor lookup for the field context. Passed into the engine, never imported by it. */
export function getProcessor(id: string): ModulationProcessor | null {
  return useModulationStore.getState().processors[id] ?? null
}
