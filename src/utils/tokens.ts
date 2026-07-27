/** Design token access for non-CSS consumers (canvas 2D, Three.js materials).
 *
 *  Per docs/05-DESIGN-SYSTEM.md: tokens are declared exactly once, in index.css.
 *  Canvas and WebGL code cannot use Tailwind classes, so it reads the same custom
 *  properties at runtime instead of duplicating hex literals. This is what keeps
 *  the viewport and the chrome from drifting apart. */

const cache = new Map<string, string>()

/** Read a CSS custom property from :root. Cached — tokens do not change at runtime. */
export function readToken(name: string, fallback = '#000000'): string {
  const cached = cache.get(name)
  if (cached !== undefined) return cached

  if (typeof window === 'undefined') return fallback

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()

  const resolved = value || fallback
  cache.set(name, resolved)
  return resolved
}

/** Clear the token cache. Call if a theme is ever swapped at runtime. */
export function clearTokenCache(): void {
  cache.clear()
}

/** Stem identity palette, in assignment order. Declared in index.css. */
export const STEM_COLOR_TOKENS = [
  '--color-aura-stem-drums',
  '--color-aura-stem-bass',
  '--color-aura-stem-lead',
  '--color-aura-stem-atmo',
  '--color-aura-stem-5',
  '--color-aura-stem-6',
  '--color-aura-stem-7',
  '--color-aura-stem-8',
] as const
