import { BlendFunction, Effect } from 'postprocessing'
import { DataTexture, LinearFilter, NearestFilter, RGBAFormat, Uniform, Vector2 } from 'three'
import { bool, num, postChoice, postParam, type PostBrick, type PostHandle } from '../types'

/** The 1-bit family — dither, halftone and ASCII.
 *
 *  Everything else in this catalogue makes the frame *smoother*: glow, blur, grade, trails. These
 *  three go the other way, and that is the point. Clean high-resolution WebGL is, in 2026, the
 *  visual signature of something a machine generated; a frame that has been visibly reduced —
 *  quantised, screened, typed — reads as something a person made. The trend writing is explicit
 *  about the cause, and dither-effect interest is up roughly 900 % year on year
 *  ([19-RESEARCH-2026 §4](../../../../docs/19-RESEARCH-2026.md)).
 *
 *  They are also the one place where "another post effect" is not a permutation inside the existing
 *  image family, which is the objection [17-EXPRESSIVE-RANGE](../../../../docs/17-EXPRESSIVE-RANGE.md)
 *  raises against more of them. A dithered frame is a different *kind* of image from a bloomed one.
 *
 *  All three sample the input away from their own pixel — they average or quantise over a cell — so
 *  every one declares `standalone` and gets its own pass rather than being merged. */

/** Ordered-dither threshold, computed rather than tabulated.
 *
 *  A `const` array indexed by a varying value is illegal in GLSL ES 1.0, so the classic 8×8 Bayer
 *  table cannot simply be looked up. It is recursive by construction, though —
 *  `M(2n) = 4·M(n)(⌊p/2⌋) + M(2)(p mod 2)` — so three lines of arithmetic reproduce it exactly.
 *  `b2` is the 2×2 base matrix `[[0,2],[3,1]]` written as a formula. */
const BAYER = /* glsl */ `
float b2(vec2 p) { return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
float bayer4(vec2 p) { return 4.0 * b2(floor(p * 0.5)) + b2(mod(p, 2.0)); }
float bayer8(vec2 p) { return 4.0 * bayer4(floor(p * 0.5)) + b2(mod(p, 2.0)); }
`

const LUMA = /* glsl */ `
float luma(const in vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`

function effectOf(
  name: string,
  fragmentShader: string,
  initial: Record<string, number | Vector2 | DataTexture>,
): { effect: Effect; set: (key: string, value: number) => void } {
  const uniforms = new Map<string, Uniform>()
  for (const [key, value] of Object.entries(initial)) uniforms.set(key, new Uniform(value))

  const effect = new Effect(name, fragmentShader, {
    blendFunction: BlendFunction.NORMAL,
    uniforms,
  })

  return {
    effect,
    set: (key, value) => {
      const uniform = uniforms.get(key)
      if (uniform) uniform.value = value
    },
  }
}

/** Cell size in device pixels. Shared by all three, because it is the same decision each time:
 *  how coarse the reduction is, and therefore how much the frame stops looking rendered. */
function cellParam(defaultValue: number) {
  return postParam('cell', 'Cell Size', 1, 32, defaultValue, { step: 1 })
}

function amountParam() {
  // Not a toggle: half-strength dithering over a lit render is a texture rather than a conversion,
  // and it is where most of the usable settings are.
  return postParam('amount', 'Amount', 0, 1, 1)
}

// ─────────────────────────────────────────────────────────────────────────────

export const ditherBrick: PostBrick = {
  id: 'post-dither',
  label: 'Dither',
  hint: 'Quantises the frame to a few levels with an ordered pattern. Game Boy, riso, 1-bit.',
  group: 'Texture',
  standalone: true,
  descriptors: [
    // Two is the true 1-bit look; the interesting range is all below eight.
    postParam('levels', 'Levels', 2, 16, 4, { step: 1 }),
    cellParam(2),
    amountParam(),
    postChoice('mono', 'Monochrome', false),
  ],
  create(): PostHandle {
    const { effect, set } = effectOf(
      'Dither',
      /* glsl */ `
uniform float levels;
uniform float cell;
uniform float amount;
uniform float mono;
${BAYER}
${LUMA}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = uv * resolution;
  vec2 grid = floor(px / max(1.0, cell));
  vec2 source = (grid * max(1.0, cell) + max(1.0, cell) * 0.5) / resolution;

  vec3 c = texture2D(inputBuffer, source).rgb;
  c = mix(c, vec3(luma(c)), mono);

  // The threshold varies per cell, so a value between two levels resolves as a PATTERN of the two
  // rather than as a flat band. That is the whole mechanism.
  float t = (bayer8(grid) + 0.5) / 64.0;
  float n = max(1.0, levels - 1.0);
  vec3 q = floor(c * n + t) / n;

  outputColor = vec4(mix(inputColor.rgb, clamp(q, 0.0, 1.0), amount), inputColor.a);
}`,
      { levels: 4, cell: 2, amount: 1, mono: 0 },
    )

    return {
      node: effect,
      update(params) {
        set('levels', num(params, 'levels', 4))
        set('cell', num(params, 'cell', 2))
        set('amount', num(params, 'amount', 1))
        set('mono', bool(params, 'mono', false) ? 1 : 0)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const halftoneBrick: PostBrick = {
  id: 'post-halftone',
  label: 'Halftone',
  hint: 'Print screen — brightness becomes dot size on a rotated grid. Newsprint and risograph.',
  group: 'Texture',
  standalone: true,
  descriptors: [
    cellParam(6),
    // 15° is the traditional screen angle, and off-axis is what stops the dots reading as a
    // rendering artefact aligned to the pixel grid.
    postParam('angle', 'Screen Angle', 0, 90, 15, { unit: 'deg' }),
    postParam('softness', 'Edge Softness', 0.01, 0.5, 0.08),
    amountParam(),
    postChoice('mono', 'Monochrome', false),
  ],
  create(): PostHandle {
    const { effect, set } = effectOf(
      'Halftone',
      /* glsl */ `
uniform float cell;
uniform float angle;
uniform float softness;
uniform float amount;
uniform float mono;
${LUMA}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float c = max(2.0, cell);
  vec2 px = uv * resolution;

  float s = sin(angle), co = cos(angle);
  mat2 rot = mat2(co, -s, s, co);
  vec2 r = (rot * px) / c;

  // Sample at the cell's CENTRE, rotated back into screen space, so every dot takes one colour
  // from the picture instead of smearing across the cell.
  vec2 centre = (mat2(co, s, -s, co) * ((floor(r) + 0.5) * c)) / resolution;
  vec3 src = texture2D(inputBuffer, clamp(centre, 0.0, 1.0)).rgb;
  vec3 tint = mix(src, vec3(luma(src)), mono);

  // Radius from the square root of brightness: dot AREA should track brightness, and area goes as
  // r². Without the root, midtones print far too dark — the mistake every naive halftone makes.
  float radius = sqrt(clamp(luma(src), 0.0, 1.0)) * 0.72;
  float d = length(fract(r) - 0.5);
  float ink = smoothstep(radius + softness, radius - softness, d);

  outputColor = vec4(mix(inputColor.rgb, tint * ink, amount), inputColor.a);
}`,
      { cell: 6, angle: 15 * (Math.PI / 180), softness: 0.08, amount: 1, mono: 0 },
    )

    return {
      node: effect,
      update(params) {
        set('cell', num(params, 'cell', 6))
        set('angle', num(params, 'angle', 15) * (Math.PI / 180))
        set('softness', num(params, 'softness', 0.08))
        set('amount', num(params, 'amount', 1))
        set('mono', bool(params, 'mono', false) ? 1 : 0)
      },
      dispose: () => effect.dispose(),
    }
  },
}

/** Glyphs, darkest last, as 5×5 bitmaps.
 *
 *  Built into a texture rather than packed into shader constants. Packing was the first attempt and
 *  it does not survive contact with float precision: a 5×5 mask needs 25 bits and a `float` is exact
 *  only to 24, so the densest glyphs silently lost their last row. A texture has no such limit, it
 *  needs no bitwise operations (illegal in GLSL ES 1.0 anyway), and the point sprite in
 *  `pointMaterials.ts` already established the pattern. */
const GLYPHS = [
  ['.....', '.....', '.....', '.....', '.....'], // space
  ['.....', '.....', '.....', '..#..', '.....'], // .
  ['.....', '..#..', '.....', '..#..', '.....'], // :
  ['.....', '.....', '.###.', '.....', '.....'], // -
  ['.....', '.###.', '.....', '.###.', '.....'], // =
  ['..#..', '..#..', '#####', '..#..', '..#..'], // +
  ['#.#.#', '.###.', '#####', '.###.', '#.#.#'], // *
  ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'], // #
  ['#####', '#####', '#####', '#####', '#####'], // solid
]

const GLYPH_SIZE = 5

/** One row of glyphs, `GLYPHS.length` wide. Built once and shared. */
let glyphTexture: DataTexture | null = null

function glyphAtlas(): DataTexture {
  if (glyphTexture) return glyphTexture

  const width = GLYPHS.length * GLYPH_SIZE
  const data = new Uint8Array(width * GLYPH_SIZE * 4)

  GLYPHS.forEach((glyph, index) => {
    for (let y = 0; y < GLYPH_SIZE; y++) {
      for (let x = 0; x < GLYPH_SIZE; x++) {
        // Row 0 of the pattern is the TOP of the glyph, and texture row 0 is the bottom.
        const on = glyph[GLYPH_SIZE - 1 - y][x] === '#'
        const o = (y * width + index * GLYPH_SIZE + x) * 4
        data[o] = data[o + 1] = data[o + 2] = data[o + 3] = on ? 255 : 0
      }
    }
  })

  glyphTexture = new DataTexture(data, width, GLYPH_SIZE, RGBAFormat)
  // Nearest, always: a glyph is a bitmap and interpolating it produces grey mush at the exact size
  // it is meant to be read at.
  glyphTexture.magFilter = NearestFilter
  glyphTexture.minFilter = LinearFilter
  glyphTexture.generateMipmaps = false
  glyphTexture.needsUpdate = true
  return glyphTexture
}

export const asciiBrick: PostBrick = {
  id: 'post-ascii',
  label: 'ASCII',
  hint: 'Redraws the frame as characters — brightness picks the glyph. Terminal, teletext, 1-bit.',
  group: 'Texture',
  standalone: true,
  descriptors: [
    cellParam(10),
    amountParam(),
    // Off, the glyph takes the picture's colour, which keeps a palette legible through the
    // reduction. On, it is a terminal.
    postChoice('mono', 'Monochrome', false),
    postParam('gamma', 'Contrast', 0.3, 3, 1),
  ],
  create(): PostHandle {
    const { effect, set } = effectOf(
      'ASCII',
      /* glsl */ `
uniform float cell;
uniform float amount;
uniform float mono;
uniform float gamma;
uniform sampler2D glyphs;
uniform float glyphCount;
${LUMA}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float c = max(3.0, cell);
  vec2 px = uv * resolution;
  vec2 grid = floor(px / c);

  vec2 source = (grid * c + c * 0.5) / resolution;
  vec3 src = texture2D(inputBuffer, clamp(source, 0.0, 1.0)).rgb;

  float l = pow(clamp(luma(src), 0.0, 1.0), gamma);
  // Nudged inside the last glyph so the brightest cells land on the solid block rather than
  // half-way off the end of the atlas.
  float index = floor(min(l * glyphCount, glyphCount - 1.0));

  vec2 inCell = fract(px / c);
  vec2 atlas = vec2((index + inCell.x) / glyphCount, inCell.y);
  float ink = texture2D(glyphs, atlas).a;

  vec3 tint = mix(src, vec3(1.0), mono);
  outputColor = vec4(mix(inputColor.rgb, tint * ink, amount), inputColor.a);
}`,
      { cell: 10, amount: 1, mono: 0, gamma: 1, glyphs: glyphAtlas(), glyphCount: GLYPHS.length },
    )

    return {
      node: effect,
      update(params) {
        set('cell', num(params, 'cell', 10))
        set('amount', num(params, 'amount', 1))
        set('mono', bool(params, 'mono', false) ? 1 : 0)
        set('gamma', num(params, 'gamma', 1))
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const ONE_BIT_POST_BRICKS: PostBrick[] = [ditherBrick, halftoneBrick, asciiBrick]
