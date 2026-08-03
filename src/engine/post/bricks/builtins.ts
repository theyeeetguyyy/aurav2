import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  DotScreenEffect,
  LensDistortionEffect,
  PixelationEffect,
  ScanlineEffect,
  VignetteEffect,
} from 'postprocessing'
import { Vector2 } from 'three'
import { num, postParam, type PostBrick } from '../types'

/** Post bricks wrapping `postprocessing`'s own effects.
 *
 *  Each one is re-declared here rather than exposed raw, for three reasons: the library's
 *  option names are not the vocabulary a musician thinks in, its defaults are tuned for
 *  demos rather than for a dark viewport, and — the structural one — every knob has to
 *  arrive as a `ParamDescriptor` with a real range or it cannot become a modulation
 *  target (HC-5).
 *
 *  Anything the library animates from its own internal timer is deliberately NOT exposed
 *  (ScanlineEffect.scrollSpeed, GlitchEffect). Those read the composer's wall clock, and
 *  a value that depends on wall time cannot be exported deterministically (HC-2). Where
 *  that motion is wanted, the parameter is exposed as a static offset and the user wires
 *  a Generator to it — same movement, but authored and sync-able. */

const DEG_TO_RAD = Math.PI / 180

export const bloomBrick: PostBrick = {
  id: 'post-bloom',
  label: 'Bloom',
  hint: 'Light bleeds out of bright areas. The single largest quality jump available.',
  group: 'Glow',
  descriptors: [
    postParam('intensity', 'Intensity', 0, 8, 1.6, { curve: 'exp' }),
    postParam('threshold', 'Threshold', 0, 1, 0.55),
    postParam('smoothing', 'Smoothing', 0, 1, 0.3),
    postParam('radius', 'Radius', 0, 1, 0.75),
  ],
  create() {
    const effect = new BloomEffect({
      mipmapBlur: true,
      intensity: 1.6,
      luminanceThreshold: 0.55,
      luminanceSmoothing: 0.3,
      radius: 0.75,
    })
    return {
      node: effect,
      update(params) {
        effect.intensity = num(params, 'intensity', 1.6)
        effect.luminanceMaterial.threshold = num(params, 'threshold', 0.55)
        effect.luminanceMaterial.smoothing = num(params, 'smoothing', 0.3)
        effect.mipmapBlurPass.radius = num(params, 'radius', 0.75)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const chromaticAberrationBrick: PostBrick = {
  id: 'post-chromatic',
  label: 'Chromatic Aberration',
  hint: 'Splits the colour channels apart. Reads as a lens, or as damage.',
  group: 'Colour',
  descriptors: [
    postParam('offsetX', 'Offset X', -0.03, 0.03, 0.0015),
    postParam('offsetY', 'Offset Y', -0.03, 0.03, 0.0015),
    // Radial modulation concentrates the split at the edges, which is what a real lens
    // does; without it the whole frame smears evenly and reads as a mistake.
    postParam('radial', 'Radial', 0, 1, 0.15),
  ],
  create() {
    const effect = new ChromaticAberrationEffect({
      offset: new Vector2(0.0015, 0.0015),
      radialModulation: true,
      modulationOffset: 0.15,
    })
    return {
      node: effect,
      update(params) {
        effect.offset.set(num(params, 'offsetX', 0.0015), num(params, 'offsetY', 0.0015))
        effect.modulationOffset = num(params, 'radial', 0.15)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const vignetteBrick: PostBrick = {
  id: 'post-vignette',
  label: 'Vignette',
  hint: 'Darkens the corners. Pushes the eye to the centre of frame.',
  group: 'Texture',
  descriptors: [
    postParam('offset', 'Offset', 0, 1, 0.4),
    postParam('darkness', 'Darkness', 0, 1, 0.6),
  ],
  create() {
    const effect = new VignetteEffect({ offset: 0.4, darkness: 0.6 })
    return {
      node: effect,
      update(params) {
        effect.offset = num(params, 'offset', 0.4)
        effect.darkness = num(params, 'darkness', 0.6)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const scanlinesBrick: PostBrick = {
  id: 'post-scanlines',
  label: 'Scanlines',
  hint: 'Horizontal CRT lines. Cheap analogue texture over anything.',
  group: 'Texture',
  descriptors: [
    postParam('density', 'Density', 0.1, 4, 1.25),
    postParam('opacity', 'Opacity', 0, 1, 0.25),
  ],
  create() {
    const effect = new ScanlineEffect({ density: 1.25 })
    effect.blendMode.blendFunction = BlendFunction.OVERLAY
    return {
      node: effect,
      update(params) {
        effect.density = num(params, 'density', 1.25)
        effect.blendMode.opacity.value = num(params, 'opacity', 0.25)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const pixelateBrick: PostBrick = {
  id: 'post-pixelate',
  label: 'Pixelate',
  hint: 'Quantises the frame into blocks. Wire it to a stem for a rhythmic crush.',
  group: 'Texture',
  descriptors: [postParam('granularity', 'Block Size', 1, 60, 6)],
  create() {
    const effect = new PixelationEffect(6)
    return {
      node: effect,
      update(params) {
        effect.granularity = num(params, 'granularity', 6)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const dotScreenBrick: PostBrick = {
  id: 'post-dotscreen',
  label: 'Halftone',
  hint: 'Print-style dot screen. Turns any render into something that looks drawn.',
  group: 'Texture',
  descriptors: [
    postParam('scale', 'Scale', 0.1, 4, 1),
    postParam('angle', 'Angle', -180, 180, 45, { unit: 'deg' }),
    postParam('opacity', 'Opacity', 0, 1, 0.5),
  ],
  create() {
    const effect = new DotScreenEffect({ angle: 45 * DEG_TO_RAD, scale: 1 })
    effect.blendMode.blendFunction = BlendFunction.OVERLAY
    return {
      node: effect,
      update(params) {
        effect.scale = num(params, 'scale', 1)
        effect.angle = num(params, 'angle', 45) * DEG_TO_RAD
        effect.blendMode.opacity.value = num(params, 'opacity', 0.5)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const lensDistortionBrick: PostBrick = {
  id: 'post-lens',
  label: 'Lens Distortion',
  hint: 'Barrel and pincushion warp. Negative values bulge, positive values pinch.',
  group: 'Distort',
  descriptors: [
    postParam('distortionX', 'Distortion X', -1, 1, 0),
    postParam('distortionY', 'Distortion Y', -1, 1, 0),
    postParam('skew', 'Skew', -1, 1, 0),
  ],
  create() {
    const effect = new LensDistortionEffect({
      distortion: new Vector2(0, 0),
      principalPoint: new Vector2(0, 0),
      focalLength: new Vector2(1, 1),
    })
    return {
      node: effect,
      update(params) {
        effect.distortion.set(num(params, 'distortionX', 0), num(params, 'distortionY', 0))
        effect.skew = num(params, 'skew', 0)
      },
      dispose: () => effect.dispose(),
    }
  },
}

export const BUILTIN_POST_BRICKS: PostBrick[] = [
  bloomBrick,
  chromaticAberrationBrick,
  lensDistortionBrick,
  pixelateBrick,
  dotScreenBrick,
  scanlinesBrick,
  vignetteBrick,
]
