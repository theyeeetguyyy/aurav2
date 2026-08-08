import { Vector3, type CatmullRomCurve3 } from 'three'
import { samplePath, samplePathAhead } from './cameraPath'
import type { ParamDescriptor, ParamValue } from '@/types/params'

/** Camera behaviours — the declarative layer over the Scene Camera (Principle 1, §4.4).
 *
 *  Phase 7 as specified is keyframes plus constraints, and keyframes need a time axis
 *  that Phase 6 has not built. Constraints do not. This is that half, built now, because
 *  it is what the rest of the product is waiting on:
 *
 *  Feedback trails, zoom blur and kaleidoscope all key off MOVEMENT, and the Scene Camera
 *  — the only camera that renders — has never moved. Until it does, the post chain reads
 *  as flat in the one view that matters, and an export would show a static frame with
 *  effects painted on it.
 *
 *  Every behaviour is a pure function of `(time, params)`. No accumulators, no easing
 *  toward a previous value: scrubbing backwards must reproduce exactly (HC-3), and an
 *  offline render steps frames out of order. That constraint is also what makes them
 *  composable — behaviours sum, and the order they are declared in does not matter.
 *
 *  Amplitudes are ordinary modulation targets, so "shake rises with the drop" is a wire,
 *  not a feature. */

export const CAMERA_STACK_ID = '@camera'

export interface BehaviourContext {
  /** Seconds from the active clock (HC-2). */
  time: number
  /** The camera path, when one is defined. Passed in rather than imported, so a behaviour still
   *  has no idea a store exists. */
  path?: CatmullRomCurve3 | null
  /** Resolved values for this frame, base plus modulation. */
  params: Record<string, ParamValue>
  /** In/out. Behaviours ADD to the rig; they never assign. */
  rig: CameraRig
}

/** What the behaviour stack produces. Applied to the Scene Camera after every behaviour
 *  has contributed, so no behaviour can stomp another. */
export interface CameraRig {
  /** Offset from the camera's authored position, in world units. */
  offsetX: number
  offsetY: number
  offsetZ: number
  /** Additional orbit around the target, in radians. */
  azimuth: number
  elevation: number
  /** Multiplies the authored distance from the target. */
  distanceScale: number
  /** Rotation added after aiming, in radians. Roll is the one nobody thinks of and the
   *  one that reads most as "handheld". */
  roll: number
  /** Field of view offset, in degrees. */
  fovOffset: number

  /** A behaviour that **places** the camera rather than nudging it — a path, and eventually a
   *  constraint. Offsets still apply on top, so a handheld shake shakes a camera on a path.
   *
   *  Flat numbers and a flag rather than a nullable vector, to match the rest of the rig and to
   *  keep `resetRig` allocation-free: it runs every frame. */
  hasPlacement: boolean
  placeX: number
  placeY: number
  placeZ: number

  /** A point to aim at, when the camera should look where it is going rather than at its
   *  Look-At target. */
  hasAim: boolean
  aimX: number
  aimY: number
  aimZ: number
}

export function emptyRig(): CameraRig {
  return {
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    azimuth: 0,
    elevation: 0,
    distanceScale: 1,
    roll: 0,
    fovOffset: 0,
    hasPlacement: false,
    placeX: 0,
    placeY: 0,
    placeZ: 0,
    hasAim: false,
    aimX: 0,
    aimY: 0,
    aimZ: 0,
  }
}

export function resetRig(rig: CameraRig): void {
  rig.offsetX = 0
  rig.offsetY = 0
  rig.offsetZ = 0
  rig.azimuth = 0
  rig.elevation = 0
  rig.distanceScale = 1
  rig.roll = 0
  rig.fovOffset = 0
  rig.hasPlacement = false
  rig.hasAim = false
}

export interface BehaviourBrick {
  id: string
  label: string
  hint: string
  descriptors: ParamDescriptor[]
  apply(ctx: BehaviourContext): void
}

export function camParam(
  key: string,
  label: string,
  min: number,
  max: number,
  defaultValue: number,
  options: Partial<ParamDescriptor> = {},
): ParamDescriptor {
  return {
    key,
    label,
    type: 'float',
    min,
    max,
    step: (max - min) / 200,
    defaultValue,
    group: 'Camera',
    exposed: true,
    realtime: true,
    ...options,
  }
}

export function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const TAU = Math.PI * 2
const DEG = Math.PI / 180

/** Deterministic value noise. `Math.random()` and an accumulator are both banned here —
 *  the same `t` must always give the same answer (HC-3). */
function noise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  // Smoothstep between integer lattice points: cheap, and continuous enough that the
  // camera never jumps between frames.
  const smooth = f * f * (3 - 2 * f)
  return hash(i, seed) * (1 - smooth) + hash(i + 1, seed) * smooth
}

function hash(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1
}

// ─────────────────────────────────────────────────────────────────────────────

export const orbitBehaviour: BehaviourBrick = {
  id: 'cam-orbit',
  label: 'Orbit',
  hint: 'Circles the target. The cheapest way to make a static scene read as filmed.',
  descriptors: [
    // Revolutions per minute rather than radians per second: a musician thinks in
    // tempo, and "one revolution every four bars" is arithmetic from here.
    camParam('speed', 'Speed', -20, 20, 2, { unit: 'hz' }),
    camParam('phase', 'Phase', 0, 1, 0),
    camParam('elevation', 'Elevation', -80, 80, 0, { unit: 'deg' }),
  ],
  apply(ctx) {
    const rpm = num(ctx.params, 'speed', 2)
    const phase = num(ctx.params, 'phase', 0)
    ctx.rig.azimuth += (ctx.time * (rpm / 60) + phase) * TAU
    ctx.rig.elevation += num(ctx.params, 'elevation', 0) * DEG
  },
}

export const dollyBehaviour: BehaviourBrick = {
  id: 'cam-dolly',
  label: 'Dolly',
  hint: 'Moves toward and away from the target. Wire Distance to a stem and the room breathes.',
  descriptors: [
    camParam('distance', 'Distance', 0.05, 4, 1, { unit: 'x' }),
    camParam('bobSpeed', 'Bob Speed', 0, 10, 0, { unit: 'hz' }),
    camParam('bobDepth', 'Bob Depth', 0, 1, 0),
  ],
  apply(ctx) {
    const bob =
      Math.sin(ctx.time * num(ctx.params, 'bobSpeed', 0) * TAU) * num(ctx.params, 'bobDepth', 0)
    ctx.rig.distanceScale *= Math.max(0.01, num(ctx.params, 'distance', 1) + bob)
  },
}

export const shakeBehaviour: BehaviourBrick = {
  id: 'cam-shake',
  label: 'Handheld Shake',
  hint: 'Organic imperfection. Wire Amplitude to a kick and the camera takes the hit.',
  descriptors: [
    camParam('amplitude', 'Amplitude', 0, 10, 0.4, { unit: 'm', curve: 'exp' }),
    camParam('frequency', 'Frequency', 0.1, 30, 6, { unit: 'hz' }),
    camParam('roll', 'Roll', 0, 30, 2, { unit: 'deg' }),
    camParam('seed', 'Seed', 0, 99, 1, { step: 1, realtime: false }),
  ],
  apply(ctx) {
    const amplitude = num(ctx.params, 'amplitude', 0.4)
    const frequency = num(ctx.params, 'frequency', 6)
    const seed = Math.round(num(ctx.params, 'seed', 1))
    const t = ctx.time * frequency

    // Three decorrelated noise streams. One stream reused across axes reads as a slide
    // along a diagonal rather than as a handheld operator.
    ctx.rig.offsetX += noise1(t, seed) * amplitude
    ctx.rig.offsetY += noise1(t + 37.1, seed + 13) * amplitude
    ctx.rig.offsetZ += noise1(t + 71.7, seed + 29) * amplitude * 0.5
    ctx.rig.roll += noise1(t + 101.3, seed + 47) * num(ctx.params, 'roll', 2) * DEG
  },
}

export const swayBehaviour: BehaviourBrick = {
  id: 'cam-sway',
  label: 'Sway',
  hint: 'A slow deliberate drift. Reads as a crane, where shake reads as a hand.',
  descriptors: [
    camParam('amplitude', 'Amplitude', 0, 40, 4, { unit: 'm' }),
    camParam('speed', 'Speed', 0.01, 2, 0.12, { unit: 'hz' }),
    camParam('verticality', 'Verticality', 0, 1, 0.35),
  ],
  apply(ctx) {
    const amplitude = num(ctx.params, 'amplitude', 4)
    const speed = num(ctx.params, 'speed', 0.12)
    const vertical = num(ctx.params, 'verticality', 0.35)
    const t = ctx.time * speed * TAU

    // Lissajous rather than a circle: the path never exactly repeats, so a long shot
    // does not visibly loop.
    ctx.rig.offsetX += Math.sin(t) * amplitude
    ctx.rig.offsetY += Math.sin(t * 1.618 + 1.3) * amplitude * vertical
    ctx.rig.offsetZ += Math.cos(t * 0.786) * amplitude
  },
}

export const zoomBehaviour: BehaviourBrick = {
  id: 'cam-zoom',
  label: 'Lens',
  hint: 'Field of view. Punching in on the drop is one wire and reads enormous.',
  descriptors: [
    camParam('fov', 'FOV Offset', -35, 60, 0, { unit: 'deg' }),
    camParam('pulseSpeed', 'Pulse Speed', 0, 10, 0, { unit: 'hz' }),
    camParam('pulseDepth', 'Pulse Depth', 0, 20, 0, { unit: 'deg' }),
  ],
  apply(ctx) {
    const pulse =
      Math.sin(ctx.time * num(ctx.params, 'pulseSpeed', 0) * TAU) *
      num(ctx.params, 'pulseDepth', 0)
    ctx.rig.fovOffset += num(ctx.params, 'fov', 0) + pulse
  },
}

/** Scratch for the path brick. Module-level and reused, because `apply` runs every frame and
 *  a behaviour that allocates is a behaviour that stutters. */
const pathPoint = new Vector3()
const pathAhead = new Vector3()

/** Follow a path through space.
 *
 *  The path is geometry and this is the thing that reads it — `progress` says where along it the
 *  camera is, and progress is an ordinary parameter, so it can be typed, drawn as a clip, or
 *  driven by a stem. That split is the whole reason a camera move here can be retimed without
 *  being redrawn.
 *
 *  Does nothing without a path, rather than dragging the camera to the origin: adding a behaviour
 *  before defining what it should follow must not throw the shot away. */
export const followPathBrick: BehaviourBrick = {
  id: 'cam-follow-path',
  label: 'Follow Path',
  hint: 'Moves the camera along a path you place in space. Progress is automatable like anything else.',
  descriptors: [
    camParam('progress', 'Progress', 0, 1, 0, { unit: 'x' }),
    // Aiming along the tangent is what makes a path read as a camera move rather than as a camera
    // being slid sideways. A real boolean, not a 0–1 float: it was rendering as a numeric field
    // reading "0.00×", which says nothing about what it does or how to turn it on.
    {
      key: 'aim',
      label: 'Aim Along Path',
      type: 'bool',
      min: 0,
      max: 1,
      step: 1,
      defaultValue: false,
      group: 'Camera',
      // Not a modulation target: there is nothing useful between aiming and not aiming, and a
      // wire that flickered it would be a strobe rather than a camera move.
      exposed: false,
      realtime: false,
    },
  ],
  apply(ctx) {
    const curve = ctx.path
    if (!curve) return

    const progress = num(ctx.params, 'progress', 0)
    samplePath(curve, progress, pathPoint)

    ctx.rig.hasPlacement = true
    ctx.rig.placeX = pathPoint.x
    ctx.rig.placeY = pathPoint.y
    ctx.rig.placeZ = pathPoint.z

    if (ctx.params.aim === true) {
      samplePathAhead(curve, progress, pathAhead)
      ctx.rig.hasAim = true
      ctx.rig.aimX = pathAhead.x
      ctx.rig.aimY = pathAhead.y
      ctx.rig.aimZ = pathAhead.z
    }
  },
}

export const BEHAVIOUR_BRICKS: BehaviourBrick[] = [
  followPathBrick,
  orbitBehaviour,
  swayBehaviour,
  shakeBehaviour,
  dollyBehaviour,
  zoomBehaviour,
]

export function getBehaviour(id: string): BehaviourBrick | null {
  return BEHAVIOUR_BRICKS.find((b) => b.id === id) ?? null
}

export function behaviourDefaults(id: string): Record<string, ParamValue> {
  const brick = getBehaviour(id)
  if (!brick) return {}
  const params: Record<string, ParamValue> = {}
  for (const descriptor of brick.descriptors) params[descriptor.key] = descriptor.defaultValue
  return params
}
