import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import {
  flag,
  intensityParam,
  lightColour,
  lightParam,
  num,
  shadowToggle,
  str,
  type LightBrick,
  type LightHandle,
} from './types'

/** The five light types, chosen so that none of them is reachable by configuring another.
 *
 *  Point is a bulb, Spot is a beam, Sun is parallel rays from infinity, Area is a soft
 *  panel, Ambient is unshaped fill. Everything a lighting artist reaches for is one of
 *  those five plus a transform — and the transform already exists on every SceneObject. */

const DEG = Math.PI / 180

/** Shadow map size. 1024 is the point where a shadow stops looking like stairs at typical
 *  scene scale; 2048 doubles the cost for a difference nobody sees at 1080p. */
const SHADOW_MAP = 1024

/** Only lights that own a `shadow` reach here — ambient and area have none. */
function applyShadow(light: THREE.Light & { shadow: THREE.LightShadow }, enabled: boolean): void {
  if (light.castShadow === enabled) return
  light.castShadow = enabled
  if (enabled) {
    light.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP)
    // Acne shows up as dark stippling on lit surfaces; a small negative bias is the
    // standard fix and costs nothing.
    light.shadow.bias = -0.0005
    light.shadow.normalBias = 0.02
  }
}

export const pointLight: LightBrick = {
  id: 'light-point',
  label: 'Point',
  hint: 'A bulb. Falls off in every direction — the workhorse for shaping a single object.',
  castsShadows: true,
  descriptors: [
    intensityParam(60, 400),
    lightColour('#ffffff'),
    // Distance 0 means "never cut off", which is what you want until you are lighting a
    // room and need one lamp to stop before it reaches the next.
    lightParam('distance', 'Range', 0, 500, 0, { unit: 'm' }),
    lightParam('decay', 'Falloff', 0, 4, 2, { realtime: false }),
    shadowToggle(),
  ],
  create(): LightHandle {
    const light = new THREE.PointLight(0xffffff, 60)
    return {
      light,
      target: null,
      update(params) {
        light.intensity = Math.max(0, num(params, 'intensity', 60))
        light.color.set(str(params, 'color', '#ffffff'))
        light.distance = Math.max(0, num(params, 'distance', 0))
        light.decay = Math.max(0, num(params, 'decay', 2))
        applyShadow(light, flag(params, 'shadows', false))
      },
      dispose: () => light.dispose(),
    }
  },
}

export const spotLight: LightBrick = {
  id: 'light-spot',
  label: 'Spot',
  hint: 'A beam with a cone. Aims along the object rotation; the only light that reads as theatrical.',
  castsShadows: true,
  descriptors: [
    intensityParam(120, 800),
    lightColour('#ffffff'),
    lightParam('angle', 'Cone Angle', 1, 89, 30, { unit: 'deg' }),
    // Penumbra is the difference between a hard theatrical edge and a soft wash, and it
    // is a genuinely good modulation target — softening a beam on the drop reads well.
    lightParam('penumbra', 'Softness', 0, 1, 0.4),
    lightParam('distance', 'Range', 0, 500, 0, { unit: 'm' }),
    lightParam('decay', 'Falloff', 0, 4, 2, { realtime: false }),
    shadowToggle(),
  ],
  create(): LightHandle {
    const light = new THREE.SpotLight(0xffffff, 120)
    // A spot aims at its target, not along its own rotation. Parenting the target to the
    // light one unit down -Z makes the object's rotation aim the beam, which is what a
    // user expects from a transform.
    const target = new THREE.Object3D()
    target.position.set(0, 0, -1)
    light.add(target)
    light.target = target

    return {
      light,
      target,
      update(params) {
        light.intensity = Math.max(0, num(params, 'intensity', 120))
        light.color.set(str(params, 'color', '#ffffff'))
        light.angle = Math.min(89, Math.max(1, num(params, 'angle', 30))) * DEG
        light.penumbra = Math.min(1, Math.max(0, num(params, 'penumbra', 0.4)))
        light.distance = Math.max(0, num(params, 'distance', 0))
        light.decay = Math.max(0, num(params, 'decay', 2))
        applyShadow(light, flag(params, 'shadows', false))
      },
      dispose: () => light.dispose(),
    }
  },
}

export const sunLight: LightBrick = {
  id: 'light-sun',
  label: 'Sun',
  hint: 'Parallel rays from infinity. Position only sets direction — distance is irrelevant.',
  castsShadows: true,
  descriptors: [
    intensityParam(3, 20),
    lightColour('#ffffff'),
    lightParam('shadowRadius', 'Shadow Area', 10, 400, 80, { unit: 'm', realtime: false }),
    shadowToggle(),
  ],
  create(): LightHandle {
    const light = new THREE.DirectionalLight(0xffffff, 3)
    const target = new THREE.Object3D()
    target.position.set(0, 0, -1)
    light.add(target)
    light.target = target

    return {
      light,
      target,
      update(params) {
        light.intensity = Math.max(0, num(params, 'intensity', 3))
        light.color.set(str(params, 'color', '#ffffff'))
        applyShadow(light, flag(params, 'shadows', false))

        // A directional light's shadow is an orthographic box, and geometry outside it
        // simply has no shadow. Exposing the radius is the difference between "shadows
        // are broken" and "the box is too small".
        const camera = light.shadow.camera
        const radius = Math.max(1, num(params, 'shadowRadius', 80))
        if (camera && camera.right !== radius) {
          camera.left = -radius
          camera.right = radius
          camera.top = radius
          camera.bottom = -radius
          camera.far = radius * 6
          camera.updateProjectionMatrix()
        }
      },
      dispose: () => light.dispose(),
    }
  },
}

export const areaLight: LightBrick = {
  id: 'light-area',
  label: 'Area',
  hint: 'A soft glowing panel. The most flattering light there is, and it shows in reflections.',
  castsShadows: false,
  descriptors: [
    intensityParam(15, 200),
    lightColour('#ffffff'),
    lightParam('width', 'Width', 0.1, 100, 12, { unit: 'm' }),
    lightParam('height', 'Height', 0.1, 100, 6, { unit: 'm' }),
  ],
  create(): LightHandle {
    // RectAreaLight needs its BRDF lookup tables initialised once before first use, or it
    // renders black with no error.
    RectAreaLightUniformsLib.init()
    const light = new THREE.RectAreaLight(0xffffff, 15, 12, 6)

    return {
      light,
      target: null,
      update(params) {
        light.intensity = Math.max(0, num(params, 'intensity', 15))
        light.color.set(str(params, 'color', '#ffffff'))
        light.width = Math.max(0.1, num(params, 'width', 12))
        light.height = Math.max(0.1, num(params, 'height', 6))
      },
      dispose: () => light.dispose(),
    }
  },
}

export const ambientLight: LightBrick = {
  id: 'light-ambient',
  label: 'Ambient',
  hint: 'Unshaped fill from everywhere. Lifts the blacks; cannot create form on its own.',
  castsShadows: false,
  descriptors: [intensityParam(0.5, 10), lightColour('#ffffff')],
  create(): LightHandle {
    const light = new THREE.AmbientLight(0xffffff, 0.5)
    return {
      light,
      target: null,
      update(params) {
        light.intensity = Math.max(0, num(params, 'intensity', 0.5))
        light.color.set(str(params, 'color', '#ffffff'))
      },
      dispose: () => light.dispose(),
    }
  },
}

export const LIGHT_BRICKS: LightBrick[] = [pointLight, spotLight, sunLight, areaLight, ambientLight]
