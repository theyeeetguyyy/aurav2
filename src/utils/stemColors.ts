/** Stem identity colors from DESIGN_SYSTEM.md v2 */
const STEM_COLORS = [
  '#f97316', // drums — orange
  '#f59e0b', // bass — amber
  '#10b981', // lead — emerald
  '#06b6d4', // atmo — cyan
  '#8b5cf6', // extra 1 — violet
  '#ec4899', // extra 2 — pink
  '#14b8a6', // extra 3 — teal
  '#f43f5e', // extra 4 — rose
] as const

let colorIndex = 0

/** Assign the next stem color from the rotating palette */
export function getNextStemColor(): string {
  const color = STEM_COLORS[colorIndex % STEM_COLORS.length]
  colorIndex++
  return color
}

/** Reset color assignment (e.g., on project clear) */
export function resetStemColors(): void {
  colorIndex = 0
}

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
