import { create } from 'zustand'
import type { ID } from '@/types/audio'
import type { Generator, GeneratorType } from '@/types/generator'
import { DEFAULT_GENERATOR, GENERATOR_TYPES } from '@/types/generator'
import { generateId } from '@/utils/stemColors'
import { readToken } from '@/utils/tokens'

/** Synthetic stems — LFOs and noise, treated exactly like audio tracks.
 *
 *  Kept in its own store rather than folded into `useAudioStore`: a generator has no
 *  buffer, no trim, no solo, and no analysis. Sharing a type with `Track` would mean a
 *  dozen fields that are permanently null. */

const GENERATOR_COLORS = [
  '--color-aura-node-parameter',
  '--color-aura-node-processor',
  '--color-aura-stem-5',
  '--color-aura-stem-7',
]

interface GeneratorState {
  generators: Generator[]
  addGenerator: (type?: GeneratorType) => ID
  removeGenerator: (id: ID) => void
  updateGenerator: (id: ID, patch: Partial<Generator>) => void
  clear: () => void
}

export const useGeneratorStore = create<GeneratorState>((set, get) => ({
  generators: [],

  addGenerator: (type = 'lfo-sine') => {
    const id = generateId()
    const index = get().generators.length
    const label = GENERATOR_TYPES.find((t) => t.value === type)?.label ?? 'LFO'

    set((s) => ({
      generators: [
        ...s.generators,
        {
          ...DEFAULT_GENERATOR,
          id,
          type,
          name: uniqueName(s.generators, label),
          color: readToken(GENERATOR_COLORS[index % GENERATOR_COLORS.length], '#3b82f6'),
        },
      ],
    }))
    return id
  },

  removeGenerator: (id) =>
    set((s) => ({ generators: s.generators.filter((g) => g.id !== id) })),

  updateGenerator: (id, patch) =>
    set((s) => ({
      generators: s.generators.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    })),

  clear: () => set({ generators: [] }),
}))

function uniqueName(generators: Generator[], base: string): string {
  const taken = new Set(generators.map((g) => g.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Lookup used by field evaluation. Passed into the engine via FieldContext, never
 *  imported by it — the engine boundary is absolute. */
export function getGenerator(id: string): Generator | null {
  return useGeneratorStore.getState().generators.find((g) => g.id === id) ?? null
}
