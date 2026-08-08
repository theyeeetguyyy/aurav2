/** The scene palette — colour as something you author, not something that happens.
 *
 *  Before this, colour worked like so: each new object took the next entry from a rotating stem
 *  palette, over a near-black background, under one fixed three-point rig. Which means a user who
 *  makes **no colour decision** — most users, because nothing invited one — gets the same colours as
 *  everyone else. Every scene was "an accent colour on dark", and that is a large part of why ten
 *  users produced eight similar outputs ([17-EXPRESSIVE-RANGE.md](../../../docs/17-EXPRESSIVE-RANGE.md)).
 *
 *  A palette is an **ordered list of colours owned by the state**. Objects reference a *slot* rather
 *  than holding a hex string, so changing the palette re-colours the whole scene at once — which is
 *  the edit people actually want to make and previously required visiting every object.
 *
 *  Slots are indices and they wrap. That is deliberate: a four-colour palette driving nine objects
 *  should cycle rather than run out, and a palette shortened from six to three must not leave three
 *  objects pointing at nothing.
 *
 *  An object may still hold an explicit colour and ignore the palette. Both matter — the palette is
 *  for the scene reading as one thing, the override is for the one object that has to differ. */

export interface Palette {
  /** Ordered. Index 0 is the lead colour and is what a single-object scene gets. */
  colors: string[]
  /** Background, drawn behind everything. Kept in the palette rather than the environment because
   *  it is the largest area of every frame and therefore the most important colour decision — and
   *  it was the least authored one. */
  background: string
  /** The **upper** background stop, and the one that decides whether the frame reads as lit or as a
   *  void. It is deliberately much brighter than `background` — the first version of these palettes
   *  kept both near-black, which reproduced exactly the problem this whole pass exists to fix. The
   *  horizon stays dark so geometry has something to sit against. */
  backgroundEnd: string
}

/** Palettes to start from.
 *
 *  Not "presets" in the sense the docs reject — those were pre-baked *musical structures* that
 *  decided the shape of someone's piece. A palette decides nothing about structure; it is a starting
 *  point for a decision that currently is not being made at all. The failure mode being fixed is
 *  everyone landing on the same colours by default, and a single default cannot fix that. */
export const STARTER_PALETTES: { name: string; palette: Palette }[] = [
  {
    // The current default, kept so existing projects are unchanged by this landing.
    name: 'Indigo',
    palette: {
      colors: ['#6366f1', '#f472b6', '#38bdf8', '#a78bfa'],
      background: '#07070b',
      backgroundEnd: '#2e2e6b',
    },
  },
  {
    name: 'Ember',
    palette: {
      colors: ['#ff7a18', '#ffb400', '#ff3d5a', '#7a1f3d'],
      background: '#12060a',
      backgroundEnd: '#7a2438',
    },
  },
  {
    name: 'Chlorine',
    palette: {
      colors: ['#00ffa3', '#00d4ff', '#c6ff00', '#0b6e4f'],
      background: '#04120f',
      backgroundEnd: '#12615a',
    },
  },
  {
    name: 'Bone',
    palette: {
      colors: ['#f5f0e6', '#c9c1b0', '#8a8272', '#2e2b26'],
      background: '#0d0c0a',
      backgroundEnd: '#5c5445',
    },
  },
  {
    name: 'Ultraviolet',
    palette: {
      colors: ['#b026ff', '#ff2df7', '#5d00ff', '#1a0033'],
      background: '#0a0014',
      backgroundEnd: '#5b1596',
    },
  },
  {
    // Deliberately not a hue scheme. A scene can be about value rather than colour, and having one
    // of these in the list is what stops the palette control reading as "pick a hue".
    name: 'Mono',
    palette: {
      colors: ['#ffffff', '#b8b8b8', '#6e6e6e', '#2a2a2a'],
      background: '#000000',
      backgroundEnd: '#3d3d3d',
    },
  },
]

export const DEFAULT_PALETTE: Palette = STARTER_PALETTES[0].palette

/** The colour at a slot. Wraps, so a slot always resolves to something. */
export function paletteAt(palette: Palette, slot: number): string {
  const colors = palette.colors
  if (colors.length === 0) return '#ffffff'
  const index = Math.trunc(slot)
  return colors[((index % colors.length) + colors.length) % colors.length]
}

/** Blend two palette entries, for ramping a value across an array of clones.
 *
 *  Interpolated in linear-ish sRGB rather than through a colour space conversion. Not because that
 *  is correct — it is not, and a proper OkLab ramp would be smoother — but because a wrong ramp
 *  between two chosen colours still lands on colours from the palette at both ends, which is what
 *  keeps an array reading as composed. Worth revisiting when there is a reason to. */
export function paletteRamp(palette: Palette, position: number): string {
  const colors = palette.colors
  if (colors.length === 0) return '#ffffff'
  if (colors.length === 1) return colors[0]

  const clamped = Math.min(1, Math.max(0, position))
  const scaled = clamped * (colors.length - 1)
  const low = Math.floor(scaled)
  const high = Math.min(colors.length - 1, low + 1)
  return mixHex(colors[low], colors[high], scaled - low)
}

/** Linear mix of two `#rrggbb` strings. Returns hex, because that is what the material stores. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const mix = (x: number, y: number) => Math.round(x + (y - x) * Math.min(1, Math.max(0, t)))
  return toHex(mix(ar, br), mix(ag, bg), mix(ab, bb))
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  // Three-digit shorthand is valid CSS and appears in hand-written palettes.
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const value = Number.parseInt(full.slice(0, 6), 16)
  if (!Number.isFinite(value)) return [255, 255, 255]
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
