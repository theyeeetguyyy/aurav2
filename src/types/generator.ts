import type { ID } from './audio'

/** A Generator is a synthetic stem.
 *
 *  It behaves exactly like an imported track — it has a name, a colour, and it appears in
 *  the patchbay's source column — except its signal comes from maths rather than audio.
 *
 *  Why first-class rather than a fixed list of LFOs: you frequently want *several*,
 *  differently configured. "A slow sine for the background drift" and "a fast saw for the
 *  strobe" are two different sources, and they should be two rows you can name, not one
 *  shared LFO whose rate is set per-connection.
 *
 *  This is also what makes D-36 workable — deformers have no built-in motion, so anything
 *  that should move on its own gets a Generator wired to it. */

export type GeneratorType =
  | 'lfo-sine'
  | 'lfo-triangle'
  | 'lfo-saw'
  | 'lfo-square'
  | 'noise'
  | 'random-walk'

export interface Generator {
  id: ID
  name: string
  type: GeneratorType
  color: string
  /** Cycles per second. */
  rate: number
  /** Phase offset 0–1. Lets two generators of the same rate run out of step. */
  offset: number
  /** Output range — the generator's own min/max before the connection's chain. */
  depth: number
  bias: number
  /** Pulse width for square, unused otherwise. */
  shape: number
}

export const GENERATOR_TYPES: { value: GeneratorType; label: string }[] = [
  { value: 'lfo-sine', label: 'Sine' },
  { value: 'lfo-triangle', label: 'Triangle' },
  { value: 'lfo-saw', label: 'Saw' },
  { value: 'lfo-square', label: 'Square' },
  { value: 'noise', label: 'Noise' },
  { value: 'random-walk', label: 'Random Walk' },
]

export const DEFAULT_GENERATOR: Omit<Generator, 'id' | 'name' | 'color'> = {
  type: 'lfo-sine',
  rate: 0.25,
  offset: 0,
  depth: 1,
  bias: 0,
  shape: 0.5,
}
