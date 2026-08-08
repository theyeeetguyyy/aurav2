import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PALETTE,
  STARTER_PALETTES,
  mixHex,
  paletteAt,
  paletteRamp,
  type Palette,
} from './palette'

const four: Palette = {
  colors: ['#000000', '#ff0000', '#00ff00', '#ffffff'],
  background: '#000000',
  backgroundEnd: '#111111',
}

describe('paletteAt', () => {
  it('returns the colour at a slot', () => {
    expect(paletteAt(four, 0)).toBe('#000000')
    expect(paletteAt(four, 2)).toBe('#00ff00')
  })

  it('wraps, so nine objects on a four-colour palette cycle rather than run out', () => {
    expect(paletteAt(four, 4)).toBe(paletteAt(four, 0))
    expect(paletteAt(four, 9)).toBe(paletteAt(four, 1))
  })

  it('wraps negatives too', () => {
    expect(paletteAt(four, -1)).toBe('#ffffff')
  })

  it('survives a palette shortened under an object still pointing past its end', () => {
    const two: Palette = { ...four, colors: ['#111111', '#222222'] }
    expect(paletteAt(two, 5)).toBe('#222222')
  })

  it('never returns undefined for an empty palette', () => {
    expect(paletteAt({ ...four, colors: [] }, 3)).toBe('#ffffff')
  })
})

describe('paletteRamp', () => {
  it('lands exactly on palette entries at the ends', () => {
    // The property that matters: a ramp across an array starts and finishes on colours the user
    // actually chose, so the array reads as composed rather than as a smear.
    expect(paletteRamp(four, 0)).toBe('#000000')
    expect(paletteRamp(four, 1)).toBe('#ffffff')
  })

  it('hits interior stops exactly', () => {
    expect(paletteRamp(four, 1 / 3)).toBe('#ff0000')
    expect(paletteRamp(four, 2 / 3)).toBe('#00ff00')
  })

  it('interpolates between stops', () => {
    // Halfway from black to red.
    expect(paletteRamp(four, 1 / 6)).toBe('#800000')
  })

  it('clamps outside 0–1 rather than wrapping', () => {
    // A ramp is a position along the palette, not an index — wrapping would make the far end of a
    // clone array jump back to the near end.
    expect(paletteRamp(four, -2)).toBe('#000000')
    expect(paletteRamp(four, 5)).toBe('#ffffff')
  })

  it('handles one-colour and empty palettes', () => {
    expect(paletteRamp({ ...four, colors: ['#abcdef'] }, 0.5)).toBe('#abcdef')
    expect(paletteRamp({ ...four, colors: [] }, 0.5)).toBe('#ffffff')
  })
})

describe('mixHex', () => {
  it('mixes channel-wise', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff')
  })

  it('accepts three-digit shorthand, which appears in hand-written palettes', () => {
    expect(mixHex('#fff', '#000', 0)).toBe('#ffffff')
  })

  it('clamps t and survives malformed input rather than emitting NaN', () => {
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 9)).toBe('#ffffff')
    expect(mixHex('nonsense', '#000000', 0)).toBe('#ffffff')
  })

  it('always returns a parseable six-digit hex', () => {
    for (const t of [0, 0.13, 0.5, 0.87, 1]) {
      expect(mixHex('#010203', '#f0e0d0', t)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('starter palettes', () => {
  it('offers several, because one default is what caused the sameness', () => {
    expect(STARTER_PALETTES.length).toBeGreaterThanOrEqual(5)
  })

  it('all entries are well-formed', () => {
    for (const { name, palette } of STARTER_PALETTES) {
      expect(name.length, name).toBeGreaterThan(0)
      expect(palette.colors.length, name).toBeGreaterThanOrEqual(3)
      for (const colour of [...palette.colors, palette.background, palette.backgroundEnd]) {
        expect(colour, `${name} / ${colour}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })

  it('includes a non-hue option, so the control does not read as "pick a hue"', () => {
    const mono = STARTER_PALETTES.find((p) => p.name === 'Mono')
    expect(mono).toBeDefined()
    // Every entry is a grey: r === g === b.
    for (const colour of mono!.palette.colors) {
      const [r, g, b] = [1, 3, 5].map((i) => colour.slice(i, i + 2))
      expect(r).toBe(g)
      expect(g).toBe(b)
    }
  })

  it('the default is the first, so existing projects are unchanged by this landing', () => {
    expect(DEFAULT_PALETTE).toBe(STARTER_PALETTES[0].palette)
  })

  it('every background is a real gradient, not two shades of near-black', () => {
    // The first version of this test asserted both stops were DARK, which reproduced the exact
    // problem the palette exists to fix — "an accent colour on black" for everyone. What matters is
    // that the upper stop lifts the frame off the void while the horizon stays dark enough for
    // geometry to sit against.
    const luma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      return (r + g + b) / 3
    }

    for (const { name, palette } of STARTER_PALETTES) {
      const low = luma(palette.background)
      const high = luma(palette.backgroundEnd)
      expect(low, `${name} horizon`).toBeLessThan(40)
      expect(high, `${name} sky`).toBeGreaterThan(low + 25)
    }
  })
})
