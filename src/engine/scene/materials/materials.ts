import * as THREE from 'three'
import {
  flag,
  matColour,
  matParam,
  matToggle,
  num,
  str,
  type MaterialBrick,
  type MaterialHandle,
} from './types'

/** The shading models. Seven genuinely different answers to "what is this surface",
 *  not seven presets of one.
 *
 *  Split the way a lighting artist splits them: lit-and-physical (Standard, Physical),
 *  lit-and-stylised (Toon), and unlit (Unlit, Normal, Fresnel, Gradient). The unlit family
 *  matters more than it looks — bloom, feedback and kaleidoscope all key off bright flat
 *  colour, and a PBR surface in a dark scene never gets bright enough to drive them. */

/** Opacity below 1 needs `transparent`, but toggling it recompiles the shader, so it is
 *  only ever written on a real change. */
function applyOpacity(material: THREE.Material, opacity: number): void {
  const clamped = clamp01(opacity)
  material.opacity = clamped
  const needed = clamped < 1
  if (material.transparent !== needed) {
    material.transparent = needed
    material.needsUpdate = true
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

const SHARED_SURFACE = [
  matColour('color', 'Colour', '#6366f1'),
  matParam('opacity', 'Opacity', 0, 1, 1),
  matToggle('wireframe', 'Wireframe', false),
  matToggle('flatShading', 'Flat Shading', false),
]

const EMISSIVE = [
  matColour('emissive', 'Emissive', '#000000'),
  // Range goes well past 1 on purpose: emissive intensity is the natural thing to wire a
  // kick to, and it is what pushes a surface over bloom's luminance threshold.
  matParam('emissiveIntensity', 'Emissive Int.', 0, 20, 0, { curve: 'exp' }),
]

export const standardMaterial: MaterialBrick = {
  id: 'mat-standard',
  label: 'Standard',
  hint: 'Physically-based metal and roughness. The dependable default.',
  descriptors: [
    ...SHARED_SURFACE,
    matParam('roughness', 'Roughness', 0, 1, 0.35),
    matParam('metalness', 'Metalness', 0, 1, 0.1),
    ...EMISSIVE,
    matParam('envIntensity', 'Reflections', 0, 4, 1, { unit: 'x' }),
  ],
  create(): MaterialHandle {
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
    return {
      material,
      update(params) {
        material.color.set(str(params, 'color', '#6366f1'))
        material.roughness = clamp01(num(params, 'roughness', 0.35))
        material.metalness = clamp01(num(params, 'metalness', 0.1))
        material.emissive.set(str(params, 'emissive', '#000000'))
        material.emissiveIntensity = Math.max(0, num(params, 'emissiveIntensity', 0))
        material.envMapIntensity = Math.max(0, num(params, 'envIntensity', 1))
        setFlags(material, params)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose: () => material.dispose(),
    }
  },
}

export const physicalMaterial: MaterialBrick = {
  id: 'mat-physical',
  label: 'Physical',
  hint: 'Standard plus clearcoat, iridescence and transmission. Glass, car paint, soap.',
  descriptors: [
    ...SHARED_SURFACE,
    matParam('roughness', 'Roughness', 0, 1, 0.2),
    matParam('metalness', 'Metalness', 0, 1, 0),
    matParam('clearcoat', 'Clearcoat', 0, 1, 0.6),
    matParam('clearcoatRoughness', 'Clearcoat Rough.', 0, 1, 0.1),
    matParam('iridescence', 'Iridescence', 0, 1, 0),
    matParam('iridescenceIOR', 'Iridescence IOR', 1, 2.5, 1.3),
    matParam('transmission', 'Transmission', 0, 1, 0),
    matParam('thickness', 'Thickness', 0, 20, 1, { unit: 'm' }),
    matParam('ior', 'IOR', 1, 2.5, 1.5),
    matParam('sheen', 'Sheen', 0, 1, 0),
    ...EMISSIVE,
    matParam('envIntensity', 'Reflections', 0, 4, 1, { unit: 'x' }),
  ],
  create(): MaterialHandle {
    const material = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide })
    return {
      material,
      update(params) {
        material.color.set(str(params, 'color', '#6366f1'))
        material.roughness = clamp01(num(params, 'roughness', 0.2))
        material.metalness = clamp01(num(params, 'metalness', 0))
        material.clearcoat = clamp01(num(params, 'clearcoat', 0.6))
        material.clearcoatRoughness = clamp01(num(params, 'clearcoatRoughness', 0.1))
        material.iridescence = clamp01(num(params, 'iridescence', 0))
        material.iridescenceIOR = num(params, 'iridescenceIOR', 1.3)
        material.transmission = clamp01(num(params, 'transmission', 0))
        material.thickness = Math.max(0, num(params, 'thickness', 1))
        material.ior = num(params, 'ior', 1.5)
        material.sheen = clamp01(num(params, 'sheen', 0))
        material.emissive.set(str(params, 'emissive', '#000000'))
        material.emissiveIntensity = Math.max(0, num(params, 'emissiveIntensity', 0))
        material.envMapIntensity = Math.max(0, num(params, 'envIntensity', 1))
        setFlags(material, params)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose: () => material.dispose(),
    }
  },
}

export const unlitMaterial: MaterialBrick = {
  id: 'mat-unlit',
  label: 'Unlit',
  hint: 'Flat colour, no lighting. The neon look, and what bloom feeds on.',
  descriptors: [
    ...SHARED_SURFACE,
    matParam('brightness', 'Brightness', 0, 20, 1, { curve: 'exp', unit: 'x' }),
  ],
  create(): MaterialHandle {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    const base = new THREE.Color()
    return {
      material,
      update(params) {
        // Brightness multiplies past 1 deliberately: with a half-float composer buffer a
        // value of 4 is a real HDR value that bloom picks up, not a clipped white.
        base.set(str(params, 'color', '#6366f1'))
        material.color.copy(base).multiplyScalar(Math.max(0, num(params, 'brightness', 1)))
        material.wireframe = flag(params, 'wireframe', false)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose: () => material.dispose(),
    }
  },
}

export const normalMaterial: MaterialBrick = {
  id: 'mat-normal',
  label: 'Normal',
  hint: 'Colours the surface by its facing direction. Iridescent for free.',
  descriptors: [
    matParam('opacity', 'Opacity', 0, 1, 1),
    matToggle('wireframe', 'Wireframe', false),
    matToggle('flatShading', 'Flat Shading', false),
  ],
  create(): MaterialHandle {
    const material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide })
    return {
      material,
      update(params) {
        setFlags(material, params)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose: () => material.dispose(),
    }
  },
}

export const toonMaterial: MaterialBrick = {
  id: 'mat-toon',
  label: 'Toon',
  hint: 'Banded shading with hard steps. Graphic and illustrative.',
  descriptors: [
    ...SHARED_SURFACE,
    matParam('steps', 'Steps', 2, 8, 3, { step: 1, realtime: false }),
    ...EMISSIVE,
  ],
  create(): MaterialHandle {
    const material = new THREE.MeshToonMaterial({ side: THREE.DoubleSide })
    let steps = -1

    return {
      material,
      update(params) {
        const next = Math.max(2, Math.round(num(params, 'steps', 3)))
        if (next !== steps) {
          steps = next
          material.gradientMap?.dispose()
          material.gradientMap = toonGradient(next)
          material.needsUpdate = true
        }
        material.color.set(str(params, 'color', '#6366f1'))
        material.emissive.set(str(params, 'emissive', '#000000'))
        material.emissiveIntensity = Math.max(0, num(params, 'emissiveIntensity', 0))
        setFlags(material, params)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose() {
        material.gradientMap?.dispose()
        material.dispose()
      },
    }
  },
}

/** Nearest-filtered ramp — the steps are the whole point, so it must not interpolate. */
function toonGradient(steps: number): THREE.DataTexture {
  const data = new Uint8Array(steps * 4)
  for (let i = 0; i < steps; i++) {
    const value = Math.round((i / (steps - 1)) * 255)
    data[i * 4 + 0] = value
    data[i * 4 + 1] = value
    data[i * 4 + 2] = value
    data[i * 4 + 3] = 255
  }
  const texture = new THREE.DataTexture(data, steps, 1)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.needsUpdate = true
  return texture
}

const FRESNEL_VERTEX = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDirection;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDirection = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`

const FRESNEL_FRAGMENT = /* glsl */ `
uniform vec3 baseColor;
uniform vec3 rimColor;
uniform float rimPower;
uniform float rimIntensity;
uniform float fill;
uniform float alpha;
varying vec3 vWorldNormal;
varying vec3 vViewDirection;

void main() {
  // Flip the normal on back faces, or the rim inverts on anything double-sided and the
  // inside of a shape lights up instead of its silhouette.
  vec3 normal = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  float facing = clamp(dot(normal, normalize(vViewDirection)), 0.0, 1.0);
  float rim = pow(1.0 - facing, max(0.01, rimPower));
  gl_FragColor = vec4(baseColor * fill + rimColor * rim * rimIntensity, alpha);
}`

export const fresnelMaterial: MaterialBrick = {
  id: 'mat-fresnel',
  label: 'Fresnel Rim',
  hint: 'Glows at the silhouette and falls away facing you. Reads as designed instantly.',
  descriptors: [
    matColour('color', 'Core', '#0b0b18'),
    matColour('rimColor', 'Rim', '#6366f1'),
    matParam('rimPower', 'Rim Falloff', 0.2, 8, 2.5),
    matParam('rimIntensity', 'Rim Intensity', 0, 20, 2.5, { curve: 'exp' }),
    matParam('fill', 'Core Fill', 0, 2, 0.35),
    matParam('opacity', 'Opacity', 0, 1, 1),
    matToggle('wireframe', 'Wireframe', false),
  ],
  create(): MaterialHandle {
    const material = new THREE.ShaderMaterial({
      name: 'FresnelRimMaterial',
      side: THREE.DoubleSide,
      vertexShader: FRESNEL_VERTEX,
      fragmentShader: FRESNEL_FRAGMENT,
      uniforms: {
        baseColor: { value: new THREE.Color('#0b0b18') },
        rimColor: { value: new THREE.Color('#6366f1') },
        rimPower: { value: 2.5 },
        rimIntensity: { value: 2.5 },
        fill: { value: 0.35 },
        alpha: { value: 1 },
      },
    })

    return {
      material,
      update(params) {
        const u = material.uniforms
        ;(u.baseColor.value as THREE.Color).set(str(params, 'color', '#0b0b18'))
        ;(u.rimColor.value as THREE.Color).set(str(params, 'rimColor', '#6366f1'))
        u.rimPower.value = num(params, 'rimPower', 2.5)
        u.rimIntensity.value = Math.max(0, num(params, 'rimIntensity', 2.5))
        u.fill.value = Math.max(0, num(params, 'fill', 0.35))
        u.alpha.value = clamp01(num(params, 'opacity', 1))
        material.wireframe = flag(params, 'wireframe', false)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose: () => material.dispose(),
    }
  },
}

const GRADIENT_VERTEX = /* glsl */ `
varying vec3 vLocalPosition;
void main() {
  vLocalPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const GRADIENT_FRAGMENT = /* glsl */ `
uniform vec3 colorA;
uniform vec3 colorB;
uniform float axis;
uniform float spread;
uniform float offset;
uniform float brightness;
uniform float alpha;
varying vec3 vLocalPosition;

void main() {
  // Pick the axis without branching so the shader stays one code path.
  vec3 selector = vec3(step(axis, 0.5), step(0.5, axis) * step(axis, 1.5), step(1.5, axis));
  float coordinate = dot(vLocalPosition, selector);
  float t = clamp(coordinate / max(0.001, spread) + 0.5 + offset, 0.0, 1.0);
  gl_FragColor = vec4(mix(colorA, colorB, t) * brightness, alpha);
}`

export const gradientMaterial: MaterialBrick = {
  id: 'mat-gradient',
  label: 'Gradient',
  hint: 'Two colours ramped across the shape. Unlit, so it survives any lighting.',
  descriptors: [
    matColour('colorA', 'Colour A', '#6366f1'),
    matColour('colorB', 'Colour B', '#f43f5e'),
    {
      key: 'material.axis',
      label: 'Axis',
      type: 'enum',
      min: 0,
      max: 2,
      step: 1,
      defaultValue: 'y',
      options: [
        { value: 'x', label: 'X' },
        { value: 'y', label: 'Y' },
        { value: 'z', label: 'Z' },
      ],
      group: 'Material',
      exposed: false,
      realtime: false,
    },
    matParam('spread', 'Spread', 0.1, 100, 20, { unit: 'm' }),
    matParam('offset', 'Offset', -1, 1, 0),
    matParam('brightness', 'Brightness', 0, 20, 1, { curve: 'exp', unit: 'x' }),
    matParam('opacity', 'Opacity', 0, 1, 1),
    matToggle('wireframe', 'Wireframe', false),
  ],
  create(): MaterialHandle {
    const material = new THREE.ShaderMaterial({
      name: 'GradientMaterial',
      side: THREE.DoubleSide,
      vertexShader: GRADIENT_VERTEX,
      fragmentShader: GRADIENT_FRAGMENT,
      uniforms: {
        colorA: { value: new THREE.Color('#6366f1') },
        colorB: { value: new THREE.Color('#f43f5e') },
        axis: { value: 1 },
        spread: { value: 20 },
        offset: { value: 0 },
        brightness: { value: 1 },
        alpha: { value: 1 },
      },
    })

    return {
      material,
      update(params) {
        const u = material.uniforms
        ;(u.colorA.value as THREE.Color).set(str(params, 'colorA', '#6366f1'))
        ;(u.colorB.value as THREE.Color).set(str(params, 'colorB', '#f43f5e'))
        const axis = str(params, 'axis', 'y')
        u.axis.value = axis === 'x' ? 0 : axis === 'z' ? 2 : 1
        u.spread.value = Math.max(0.001, num(params, 'spread', 20))
        u.offset.value = num(params, 'offset', 0)
        u.brightness.value = Math.max(0, num(params, 'brightness', 1))
        u.alpha.value = clamp01(num(params, 'opacity', 1))
        material.wireframe = flag(params, 'wireframe', false)
        applyOpacity(material, num(params, 'opacity', 1))
      },
      dispose: () => material.dispose(),
    }
  },
}

function setFlags(
  material: THREE.Material & { wireframe?: boolean; flatShading?: boolean },
  params: Record<string, import('@/types/params').ParamValue>,
): void {
  const wireframe = flag(params, 'wireframe', false)
  if (material.wireframe !== wireframe) material.wireframe = wireframe

  const flatShading = flag(params, 'flatShading', false)
  // Flat shading rebuilds normals in the shader, so it is a recompile, not a uniform.
  if (material.flatShading !== undefined && material.flatShading !== flatShading) {
    material.flatShading = flatShading
    material.needsUpdate = true
  }
}

export const MATERIAL_BRICKS: MaterialBrick[] = [
  standardMaterial,
  physicalMaterial,
  unlitMaterial,
  gradientMaterial,
  fresnelMaterial,
  toonMaterial,
  normalMaterial,
]
