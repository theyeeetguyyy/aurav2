import { readToken, STEM_COLOR_TOKENS } from './tokens'

/** Stem identity colour assignment.
 *
 *  Colours come from the design-system tokens in index.css (docs/05-DESIGN-SYSTEM.md
 *  §3.3), read at runtime rather than duplicated as hex literals here. */

let colorIndex = 0

/** Fallbacks, used only if the stylesheet has not applied yet. */
const FALLBACKS = [
  '#f97316', '#f59e0b', '#10b981', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e',
]

/** Palette colour at a position, wrapping. Deterministic, so anything that already has a
 *  natural index can colour itself without touching the stem rotation below. */
export function paletteColor(index: number): string {
  const length = STEM_COLOR_TOKENS.length
  const slot = ((Math.trunc(index) % length) + length) % length
  return readToken(STEM_COLOR_TOKENS[slot], FALLBACKS[slot])
}

/** Next colour from the rotating stem palette.
 *
 *  Only stems may draw from this counter. Anything else that consumed it would shift the
 *  colour the next imported stem gets, and stem colour is an identity users rely on across
 *  the waveform rack, the routing graph and the automation lanes. */
export function getNextStemColor(): string {
  return paletteColor(colorIndex++)
}

/** Restart colour assignment. Call when a project is cleared or loaded, otherwise
 *  a second project in the same session starts mid-palette. */
export function resetStemColors(): void {
  colorIndex = 0
}

/** Collision-resistant unique identifier. */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
