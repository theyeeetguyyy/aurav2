/** Oklab — the colour space every operation in this product should have been using.
 *
 *  sRGB's numbers are not perceptual. Two colours with the same "lightness" in HSL look nothing
 *  alike; interpolating two saturated colours through sRGB passes through a muddy middle; and
 *  rotating a hue in HSL changes how bright the colour *looks* as it turns. That last one is not a
 *  subtlety here — a stem wired to Hue Shift (D-116) made the object pump in **lightness** as well
 *  as colour, which is not what anyone asked for and reads as a bug in the modulation rather than
 *  in the colour maths.
 *
 *  Oklab fixes all three by construction: `L` is perceptual lightness, and `a`/`b` carry the colour
 *  with no lightness in them. A hue rotation is therefore a rotation of `(a, b)` about the origin,
 *  and `L` does not move.
 *
 *  Hand-rolled rather than adding `culori`: it is two matrices and a cube root, this codebase
 *  already hand-rolls its FFT for the same reason, and a colour dependency that ships parsers for
 *  twenty spaces is a poor trade for forty lines.
 *
 *  Matrices are Björn Ottosson's published constants. */

export interface Oklab {
  /** Perceptual lightness, 0–1. */
  L: number
  a: number
  b: number
}

/** sRGB 0–1 to linear light. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Linear light to sRGB 0–1, clamped — a rotation can leave the gamut and something has to give. */
export function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.min(1, Math.max(0, v))
}

export function linearToOklab(r: number, g: number, b: number): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function oklabToLinear({ L, a, b }: Oklab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Chroma — distance from the neutral axis. Zero for any grey, at any lightness. */
export function chroma({ a, b }: Oklab): number {
  return Math.hypot(a, b)
}
