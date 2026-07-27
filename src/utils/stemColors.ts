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

/** Next colour from the rotating stem palette. */
export function getNextStemColor(): string {
  const slot = colorIndex % STEM_COLOR_TOKENS.length
  colorIndex++
  return readToken(STEM_COLOR_TOKENS[slot], FALLBACKS[slot])
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
