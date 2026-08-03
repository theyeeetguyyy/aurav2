import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector2 } from 'three'
import {
  choiceIndex,
  num,
  postChoice,
  postParam,
  type PostBrick,
  type PostHandle,
} from '../types'

/** Hand-written post effects — the ones no library ships, or ships badly.
 *
 *  `postprocessing` compiles several of these into ONE fullscreen pass, so a stack of
 *  five costs roughly what one costs. Effects that need to read the input buffer at a
 *  coordinate other than their own pixel (Zoom Blur) are convolutions and cannot be
 *  merged; they declare `standalone` so the composer builder gives them their own pass.
 *
 *  Available for free from the material: `inputBuffer`, `resolution`, `texelSize`,
 *  `aspect`, `time`. `time` is the composer's own wall clock and is therefore BANNED
 *  here — anything animated takes its time from the active Clock through a uniform we
 *  own (HC-2), or it cannot be exported. */

const TAU = '6.283185307179586'

/** Wrap a fragment shader plus its uniforms into an Effect and a typed setter map.
 *
 *  Every uniform must be declared here, before the Effect is constructed. Adding one
 *  afterwards requires `setChanged()` and a recompile, and an EffectPass built in between
 *  would silently omit it. */
function shaderEffect(
  name: string,
  fragmentShader: string,
  initial: Record<string, number | Vector2>,
  options: { blendFunction?: BlendFunction; attributes?: EffectAttribute; defines?: Record<string, string> } = {},
): { effect: Effect; set: (key: string, value: number) => void; vec: (key: string) => Vector2 } {
  const uniforms = new Map<string, Uniform>()
  for (const [key, value] of Object.entries(initial)) uniforms.set(key, new Uniform(value))

  const defines = new Map<string, string>()
  for (const [key, value] of Object.entries(options.defines ?? {})) defines.set(key, value)

  const effect = new Effect(name, fragmentShader, {
    blendFunction: options.blendFunction ?? BlendFunction.NORMAL,
    attributes: options.attributes ?? EffectAttribute.NONE,
    uniforms,
    defines,
  })

  return {
    effect,
    set: (key, value) => {
      const uniform = uniforms.get(key)
      if (uniform) uniform.value = value
    },
    vec: (key) => uniforms.get(key)!.value as Vector2,
  }
}

/** Fold the frame back onto itself outside 0–1 instead of clamping, so a UV transform
 *  that leaves the frame tiles seamlessly rather than smearing the edge pixel. */
const MIRROR_WRAP = /* glsl */ `
vec2 mirrorWrap(const in vec2 p) {
  vec2 m = mod(p, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Distort
// ─────────────────────────────────────────────────────────────────────────────

/** The highest-leverage single effect in the catalogue: it turns any scene, however
 *  plain, into something that reads as designed (docs/10-ELEMENTS.md §H). */
export const kaleidoscopeBrick: PostBrick = {
  id: 'post-kaleidoscope',
  label: 'Kaleidoscope',
  hint: 'Folds the frame into radial mirrored wedges. Makes any scene look composed.',
  group: 'Distort',
  descriptors: [
    postParam('segments', 'Segments', 2, 32, 6, { step: 1 }),
    postParam('spin', 'Spin', -180, 180, 0, { unit: 'deg' }),
    postParam('roll', 'Roll', -180, 180, 0, { unit: 'deg' }),
    postParam('zoom', 'Zoom', 0.2, 3, 1, { unit: 'x' }),
    postParam('centerX', 'Centre X', 0, 1, 0.5),
    postParam('centerY', 'Centre Y', 0, 1, 0.5),
  ],
  create(): PostHandle {
    const { effect, set, vec } = shaderEffect(
      'Kaleidoscope',
      /* glsl */ `
uniform float segments;
uniform float spin;
uniform float roll;
uniform float zoom;
uniform vec2 pivot;
${MIRROR_WRAP}
void mainUv(inout vec2 uv) {
  vec2 p = uv - pivot;
  p.x *= aspect;
  float r = length(p);
  float a = atan(p.y, p.x) - spin;
  float seg = ${TAU} / max(2.0, segments);
  a = mod(a, seg);
  // Reflect the second half of each wedge back over the first — this is the mirror
  // that makes it a kaleidoscope rather than a pie chart of copies.
  a = min(a, seg - a) + roll;
  p = vec2(cos(a), sin(a)) * (r / max(0.05, zoom));
  p.x /= aspect;
  uv = mirrorWrap(p + pivot);
}`,
      { segments: 6, spin: 0, roll: 0, zoom: 1, pivot: new Vector2(0.5, 0.5) },
    )

    const pivot = vec('pivot')
    const DEG = Math.PI / 180

    return {
      node: effect,
      update(params) {
        set('segments', num(params, 'segments', 6))
        set('spin', num(params, 'spin', 0) * DEG)
        set('roll', num(params, 'roll', 0) * DEG)
        set('zoom', num(params, 'zoom', 1))
        pivot.set(num(params, 'centerX', 0.5), num(params, 'centerY', 0.5))
      },
      dispose: () => effect.dispose(),
    }
  },
}

const MIRROR_MODES = ['x', 'y', 'quad'] as const

export const mirrorBrick: PostBrick = {
  id: 'post-mirror',
  label: 'Mirror',
  hint: 'Reflects one half of the frame over the other. Instant symmetry.',
  group: 'Distort',
  descriptors: [
    postChoice('mode', 'Axis', 'x', [
      { value: 'x', label: 'Horizontal' },
      { value: 'y', label: 'Vertical' },
      { value: 'quad', label: 'Quad' },
    ]),
    postParam('seam', 'Seam', 0, 1, 0.5),
    postChoice('flip', 'Flip', false),
  ],
  create(): PostHandle {
    const { effect, set } = shaderEffect(
      'Mirror',
      /* glsl */ `
uniform float mode;
uniform float seam;
uniform float flip;
${MIRROR_WRAP}
void mainUv(inout vec2 uv) {
  float s = mix(1.0, -1.0, step(0.5, flip));
  vec2 folded = vec2(seam) + s * abs(uv - vec2(seam));
  // Which axes fold: X only, Y only, or both.
  vec2 mask = vec2(step(mode, 0.5) + step(1.5, mode), step(0.5, mode));
  uv = mirrorWrap(mix(uv, folded, clamp(mask, 0.0, 1.0)));
}`,
      { mode: 0, seam: 0.5, flip: 0 },
    )

    return {
      node: effect,
      update(params) {
        set('mode', choiceIndex(params, 'mode', MIRROR_MODES))
        set('seam', num(params, 'seam', 0.5))
        set('flip', params.flip === true ? 1 : 0)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const zoomBlurBrick: PostBrick = {
  id: 'post-zoom-blur',
  label: 'Zoom Blur',
  hint: 'Radial streaks out of a point. Wire it to a kick for a shockwave on every hit.',
  group: 'Distort',
  standalone: true,
  descriptors: [
    postParam('strength', 'Strength', -0.5, 0.5, 0),
    postParam('centerX', 'Centre X', 0, 1, 0.5),
    postParam('centerY', 'Centre Y', 0, 1, 0.5),
  ],
  create(): PostHandle {
    const { effect, set, vec } = shaderEffect(
      'ZoomBlur',
      /* glsl */ `
uniform float strength;
uniform vec2 origin;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 dir = origin - uv;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < ZOOM_SAMPLES; i++) {
    float t = float(i) / float(ZOOM_SAMPLES - 1);
    sum += texture2D(inputBuffer, uv + dir * t * strength);
  }
  outputColor = sum / float(ZOOM_SAMPLES);
}`,
      { strength: 0, origin: new Vector2(0.5, 0.5) },
      // Reads the input buffer away from its own pixel, so it is a convolution and must
      // not be merged with other effects.
      { attributes: EffectAttribute.CONVOLUTION, defines: { ZOOM_SAMPLES: '14' } },
    )

    const origin = vec('origin')

    return {
      node: effect,
      update(params) {
        set('strength', num(params, 'strength', 0))
        origin.set(num(params, 'centerX', 0.5), num(params, 'centerY', 0.5))
      },
      dispose: () => effect.dispose(),
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour
// ─────────────────────────────────────────────────────────────────────────────

export const gradeBrick: PostBrick = {
  id: 'post-grade',
  label: 'Colour Grade',
  hint: 'Exposure, contrast, saturation and white balance, with ACES filmic roll-off.',
  group: 'Colour',
  descriptors: [
    postParam('exposure', 'Exposure', -3, 3, 0, { unit: 'x' }),
    postParam('contrast', 'Contrast', 0, 3, 1, { unit: 'x' }),
    postParam('saturation', 'Saturation', 0, 3, 1, { unit: 'x' }),
    postParam('temperature', 'Temperature', -1, 1, 0),
    postParam('tint', 'Tint', -1, 1, 0),
    postParam('lift', 'Lift', -0.5, 0.5, 0),
    postParam('gamma', 'Gamma', 0.2, 3, 1),
    // Filmic roll-off is what stops bloom from clipping into flat white blobs, so it
    // matters most on exactly the stack people will build first.
    postParam('filmic', 'Filmic', 0, 1, 0),
  ],
  create(): PostHandle {
    const { effect, set } = shaderEffect(
      'ColourGrade',
      /* glsl */ `
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float temperature;
uniform float tint;
uniform float lift;
uniform float gammaValue;
uniform float filmic;

vec3 acesFilmic(const in vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * exp2(exposure);
  c += vec3(temperature, 0.0, -temperature) * 0.15;
  c += vec3(tint, -tint, tint) * 0.15;
  c = max(c, vec3(0.0));
  c = mix(c, acesFilmic(c), filmic);
  c = (c - 0.5) * contrast + 0.5;
  c += lift * (1.0 - c);
  c = pow(max(c, vec3(0.0)), vec3(1.0 / max(0.05, gammaValue)));
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(clamp(mix(vec3(luma), c, saturation), 0.0, 1.0), inputColor.a);
}`,
      {
        exposure: 0,
        contrast: 1,
        saturation: 1,
        temperature: 0,
        tint: 0,
        lift: 0,
        gammaValue: 1,
        filmic: 0,
      },
    )

    return {
      node: effect,
      update(params) {
        set('exposure', num(params, 'exposure', 0))
        set('contrast', num(params, 'contrast', 1))
        set('saturation', num(params, 'saturation', 1))
        set('temperature', num(params, 'temperature', 0))
        set('tint', num(params, 'tint', 0))
        set('lift', num(params, 'lift', 0))
        set('gammaValue', num(params, 'gamma', 1))
        set('filmic', num(params, 'filmic', 0))
      },
      dispose: () => effect.dispose(),
    }
  },
}

/** Recolours the whole frame from a cosine palette (Inigo Quilez). Four scalars replace
 *  a colour picker, which means the palette itself is modulatable — cycle it on the bar
 *  and the video changes key with the music. */
export const paletteBrick: PostBrick = {
  id: 'post-palette',
  label: 'Palette',
  hint: 'Remaps brightness onto a cosine palette. Cycle it on the beat.',
  group: 'Colour',
  descriptors: [
    postParam('amount', 'Amount', 0, 1, 0.8),
    postParam('cycle', 'Cycle', 0, 1, 0),
    postParam('spread', 'Spread', 0.1, 3, 1),
    postParam('bias', 'Bias', -0.5, 0.5, 0),
    postParam('shade', 'Flatten', 0, 1, 0.35),
  ],
  create(): PostHandle {
    const { effect, set } = shaderEffect(
      'Palette',
      /* glsl */ `
uniform float amount;
uniform float cycle;
uniform float spread;
uniform float bias;
uniform float shade;

vec3 cosPalette(const in float t) {
  vec3 phase = vec3(0.0, 0.33, 0.67) + cycle;
  return 0.5 + 0.5 * cos(${TAU} * (spread * t + phase));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Scaling the mapped colour by luma keeps blacks black. A flat remap lights the
  // background up to mid-grey and destroys the contrast bloom depends on.
  vec3 mapped = cosPalette(clamp(luma + bias, 0.0, 1.0)) * (shade + (1.0 - shade) * luma);
  outputColor = vec4(mix(inputColor.rgb, mapped, amount), inputColor.a);
}`,
      { amount: 0.8, cycle: 0, spread: 1, bias: 0, shade: 0.35 },
    )

    return {
      node: effect,
      update(params) {
        set('amount', num(params, 'amount', 0.8))
        set('cycle', num(params, 'cycle', 0))
        set('spread', num(params, 'spread', 1))
        set('bias', num(params, 'bias', 0))
        set('shade', num(params, 'shade', 0.35))
      },
      dispose: () => effect.dispose(),
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Texture
// ─────────────────────────────────────────────────────────────────────────────

export const grainBrick: PostBrick = {
  id: 'post-grain',
  label: 'Film Grain',
  hint: 'Animated sensor noise. Kills the plastic CG look faster than anything else.',
  group: 'Texture',
  descriptors: [
    postParam('amount', 'Amount', 0, 0.6, 0.08),
    postParam('size', 'Size', 0.5, 8, 1.5, { unit: 'x' }),
    // Quantising the seed to a rate is what makes it read as film rather than as video
    // static — 24 steps a second is the classic look.
    postParam('rate', 'Rate', 1, 60, 24, { step: 1, unit: 'hz' }),
    postChoice('chroma', 'Colour Noise', false),
  ],
  create(): PostHandle {
    const { effect, set } = shaderEffect(
      'FilmGrain',
      /* glsl */ `
uniform float amount;
uniform float grainSize;
uniform float seed;
uniform float chroma;

float grainHash(const in vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 cell = floor(uv * resolution / max(0.5, grainSize));
  float n = grainHash(cell + seed);
  vec3 colourNoise = vec3(grainHash(cell + seed + 13.7), grainHash(cell + seed + 41.3), n);
  // step/mix rather than a ternary: GLSL ES 1.00 only guarantees ?: on scalars.
  vec3 noise = mix(vec3(n), colourNoise, step(0.5, chroma));
  outputColor = vec4(inputColor.rgb + (noise - 0.5) * amount, inputColor.a);
}`,
      { amount: 0.08, grainSize: 1.5, seed: 0, chroma: 0 },
    )

    return {
      node: effect,
      update(params, ctx) {
        set('amount', num(params, 'amount', 0.08))
        set('grainSize', num(params, 'size', 1.5))
        set('chroma', params.chroma === true ? 1 : 0)
        // Seed comes from the CLOCK, not from a counter (HC-2). Rendering frame 5000
        // before frame 12 therefore produces the same grain either way.
        set('seed', Math.floor(ctx.time * num(params, 'rate', 24)))
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const SHADER_POST_BRICKS: PostBrick[] = [
  kaleidoscopeBrick,
  mirrorBrick,
  zoomBlurBrick,
  gradeBrick,
  paletteBrick,
  grainBrick,
]
