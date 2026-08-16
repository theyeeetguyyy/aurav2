import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PALETTE,
  STARTER_PALETTES,
  mixHex,
  paletteAt,
  paletteRamp,
  shiftHue,
  type Palette,
} from './palette'
import { linearToOklab, srgbToLinear } from './oklab'

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

  it('interpolates between stops perceptually, not channel-wise', () => {
    // Halfway from black to red. sRGB's channel midpoint is #800000; Oklab's is darker, because
    // half the *perceived* lightness of red is not half its red channel. The perceptual answer is
    // the one that makes a ramp across a clone array read as evenly spaced.
    const mid = paletteRamp(four, 1 / 6)
    expect(mid).toMatch(/^#[0-9a-f]{6}$/)
    expect(mid).not.toBe('#800000')
    const red = Number.parseInt(mid.slice(1, 3), 16)
    expect(red).toBeGreaterThan(0x40)
    expect(red).toBeLessThan(0x80)
  })

  it('spaces a ramp evenly in perceived lightness', () => {
    // Oklab's actual guarantee, and what makes a clone array read as an even progression rather
    // than as a dark clump and a bright clump. Channel-wise sRGB bunches the steps because its
    // numbers are not perceptual; here every step should be about the same size.
    //
    // Note what is NOT claimed: that the midpoint stays vivid. Two near-complementary colours
    // pass close to neutral in *any* perceptual space, and a test asserting otherwise was wrong.
    const two: Palette = { ...four, colors: ['#12060a', '#ffb400'] }
    const lightness = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(Number.parseInt(hex.slice(i, i + 2), 16) / 255))
      return linearToOklab(r, g, b).L
    }

    const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => lightness(paletteRamp(two, t)))
    const deltas = steps.slice(1).map((v, i) => v - steps[i])
    for (const d of deltas) expect(d).toBeGreaterThan(0)
    // Within a few percent — only 8-bit rounding and gamut clamping separate them from identical.
    expect(Math.max(...deltas) / Math.min(...deltas)).toBeLessThan(1.1)
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

describe('shiftHue', () => {
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

  it('rotates towards the expected part of the wheel', () => {
    // Not to pure green: pure green is far brighter than pure red, and a rotation that arrived
    // there would have changed the lightness — which is the entire thing this is built to avoid.
    // What it must do is move the dominant channel from red to green to blue.
    const dominant = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
      return r >= g && r >= b ? 'r' : g >= b ? 'g' : 'b'
    }
    expect(dominant('#ff0000')).toBe('r')
    expect(dominant(shiftHue('#ff0000', 120))).toBe('g')
    expect(dominant(shiftHue('#ff0000', 240))).toBe('b')
  })

  it('holds perceptual lightness across a full turn — the reason for Oklab', () => {
    // The defect this replaced: rotating in HSL swings apparent brightness as it turns, so a stem
    // wired to Hue Shift pumped the object's lightness as well as its colour. Sampled every 30°,
    // Oklab's L must barely move. sRGB luma is a stand-in for it here and is enough to catch a
    // swing of the size HSL produced.
    const luma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    for (const start of ['#6366f1', '#ff7a18', '#00ffa3']) {
      const base = luma(start)
      for (let deg = 30; deg < 360; deg += 30) {
        expect(Math.abs(luma(shiftHue(start, deg)) - base), `${start} @${deg}`).toBeLessThan(0.22)
      }
    }
  })

  it('is the identity at zero and at a full turn', () => {
    // A wired parameter passes through both constantly, and a colour that drifts on every lap would
    // mean the render is not a pure function of the signal.
    for (const hex of ['#6366f1', '#ff7a18', '#00ffa3']) {
      expect(shiftHue(hex, 0)).toBe(hex)
      expect(channels(shiftHue(hex, 360)).join()).toBe(channels(hex).join())
    }
  })

  it('wraps rather than clamping, so an overshooting signal lands somewhere sensible', () => {
    expect(shiftHue('#ff0000', 480)).toBe(shiftHue('#ff0000', 120))
    expect(shiftHue('#ff0000', -240)).toBe(shiftHue('#ff0000', 120))
  })

  it('stays inside the gamut at every angle', () => {
    // A rotation can leave what sRGB can show. Clamping is the answer, and the thing to assert is
    // that it produces a real colour rather than a wrapped or NaN one.
    for (const start of ['#ff0000', '#00ffa3', '#b026ff', '#f5f0e6']) {
      for (let deg = 0; deg < 360; deg += 15) {
        expect(shiftHue(start, deg), `${start} @${deg}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('leaves greys alone at every angle', () => {
    // Correct, and worth knowing: a Mono palette cannot be driven this way and no amount of signal
    // will make it move.
    for (const hex of ['#000000', '#6e6e6e', '#ffffff']) {
      expect(shiftHue(hex, 137)).toBe(hex)
    }
  })
})
