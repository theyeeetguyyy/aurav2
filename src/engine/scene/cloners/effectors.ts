import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { FEATURE_KEYS, type FeatureKey } from '@/engine/audio/featureTypes'
import type { ParamDescriptor } from '@/types/params'
import {
  cloneChoice,
  cloneParam,
  num,
  text,
  type EffectorBrick,
  type EffectorContext,
} from './types'

/** Effectors — what makes a cloner interesting rather than a copy machine.
 *
 *  Each one computes a weight per clone and applies the SAME set of transform deltas
 *  through it. Splitting "how strongly does this clone respond" from "what does the
 *  response do" is what lets four effectors cover the space: a cascade, a scatter, a
 *  travelling wave and a delay line are four weight functions, not four features.
 *
 *  Every output below is additive on top of the cloner's layout and on top of earlier
 *  effectors, so stacking two is meaningful rather than a fight over the last write. */

const DEG = Math.PI / 180

/** The shared response. Declared once and spread into every effector, so a user who
 *  learns one has learned all four. */
function outputDescriptors(): ParamDescriptor[] {
  return [
    cloneParam('amount', 'Amount', -2, 2, 1, { unit: 'x' }),
    cloneParam('posX', 'Move X', -100, 100, 0, { unit: 'm' }),
    cloneParam('posY', 'Move Y', -100, 100, 0, { unit: 'm' }),
    cloneParam('posZ', 'Move Z', -100, 100, 0, { unit: 'm' }),
    cloneParam('rotX', 'Rotate X', -360, 360, 0, { unit: 'deg' }),
    cloneParam('rotY', 'Rotate Y', -360, 360, 0, { unit: 'deg' }),
    cloneParam('rotZ', 'Rotate Z', -360, 360, 0, { unit: 'deg' }),
    cloneParam('scale', 'Scale', -1, 3, 0, { unit: 'x' }),
    cloneParam('tint', 'Brightness', -1, 3, 0),
  ]
}

/** Apply one clone's weight through the shared outputs. Called count× per frame per
 *  effector, so it reads its parameters from pre-hoisted locals rather than the record. */
interface Outputs {
  amount: number
  posX: number
  posY: number
  posZ: number
  rotX: number
  rotY: number
  rotZ: number
  scale: number
  tint: number
}

function readOutputs(ctx: EffectorContext): Outputs {
  const p = ctx.params
  return {
    amount: num(p, 'amount', 1),
    posX: num(p, 'posX', 0),
    posY: num(p, 'posY', 0),
    posZ: num(p, 'posZ', 0),
    rotX: num(p, 'rotX', 0) * DEG,
    rotY: num(p, 'rotY', 0) * DEG,
    rotZ: num(p, 'rotZ', 0) * DEG,
    scale: num(p, 'scale', 0),
    tint: num(p, 'tint', 0),
  }
}

function applyWeight(ctx: EffectorContext, out: Outputs, index: number, weight: number): void {
  const w = weight * out.amount
  if (w === 0) return

  const { position, rotation, scale, tint } = ctx.clones
  const o = index * 3

  position[o] += out.posX * w
  position[o + 1] += out.posY * w
  position[o + 2] += out.posZ * w

  rotation[o] += out.rotX * w
  rotation[o + 1] += out.rotY * w
  rotation[o + 2] += out.rotZ * w

  const s = out.scale * w
  scale[o] = Math.max(0.001, scale[o] + s)
  scale[o + 1] = Math.max(0.001, scale[o + 1] + s)
  scale[o + 2] = Math.max(0.001, scale[o + 2] + s)

  const t = out.tint * w
  tint[o] = Math.max(0, tint[o] + t)
  tint[o + 1] = Math.max(0, tint[o + 1] + t)
  tint[o + 2] = Math.max(0, tint[o + 2] + t)
}

// ─────────────────────────────────────────────────────────────────────────────

export const stepEffector: EffectorBrick = {
  id: 'eff-step',
  label: 'Step Effector',
  family: 'instancing',
  hint: 'Ramps across the clones. The cascade — first one barely moves, last one fully.',
  descriptors: [
    cloneParam('bias', 'Bias', 0.1, 5, 1, {
      // A power curve on the ramp is the difference between a mechanical staircase and
      // something that eases into its extreme.
    }),
    cloneChoice('reverse', 'Reverse', false),
    ...outputDescriptors(),
  ],
  affect(ctx) {
    const out = readOutputs(ctx)
    const count = ctx.clones.count
    const bias = Math.max(0.01, num(ctx.params, 'bias', 1))
    const reverse = ctx.params.reverse === true
    const divisor = Math.max(1, count - 1)

    for (let i = 0; i < count; i++) {
      const t = reverse ? 1 - i / divisor : i / divisor
      applyWeight(ctx, out, i, Math.pow(t, bias))
    }
  },
}

export const randomEffector: EffectorBrick = {
  id: 'eff-random',
  label: 'Random Effector',
  family: 'instancing',
  hint: 'Scatters each clone by a different amount. Deterministic from its seed.',
  descriptors: [
    cloneParam('seed', 'Seed', 0, 999, 1, { step: 1, realtime: false }),
    cloneChoice('perAxis', 'Vary Per Axis', true),
    ...outputDescriptors(),
  ],
  affect(ctx) {
    const out = readOutputs(ctx)
    const count = ctx.clones.count
    const seed = Math.round(num(ctx.params, 'seed', 1))
    const perAxis = ctx.params.perAxis !== false

    if (!perAxis) {
      for (let i = 0; i < count; i++) applyWeight(ctx, out, i, hash(i, seed) * 2 - 1)
      return
    }

    // One hash per axis, or every clone moves along the same diagonal and the scatter
    // reads as a line rather than as noise.
    const { position, rotation, scale, tint } = ctx.clones
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const a = out.amount

      position[o] += out.posX * (hash(i, seed) * 2 - 1) * a
      position[o + 1] += out.posY * (hash(i, seed + 101) * 2 - 1) * a
      position[o + 2] += out.posZ * (hash(i, seed + 211) * 2 - 1) * a

      rotation[o] += out.rotX * (hash(i, seed + 307) * 2 - 1) * a
      rotation[o + 1] += out.rotY * (hash(i, seed + 401) * 2 - 1) * a
      rotation[o + 2] += out.rotZ * (hash(i, seed + 509) * 2 - 1) * a

      const s = out.scale * (hash(i, seed + 601) * 2 - 1) * a
      scale[o] = Math.max(0.001, scale[o] + s)
      scale[o + 1] = Math.max(0.001, scale[o + 1] + s)
      scale[o + 2] = Math.max(0.001, scale[o + 2] + s)

      const t = out.tint * (hash(i, seed + 701) * 2 - 1) * a
      tint[o] = Math.max(0, tint[o] + t)
      tint[o + 1] = Math.max(0, tint[o + 1] + t)
      tint[o + 2] = Math.max(0, tint[o + 2] + t)
    }
  },
}

export const waveEffector: EffectorBrick = {
  id: 'eff-wave',
  label: 'Wave Effector',
  family: 'instancing',
  hint: 'A sine across the clone set. Wire Phase to a saw LFO and it travels.',
  descriptors: [
    cloneParam('frequency', 'Cycles', 0.1, 12, 1),
    // Phase is the point of this effector: it is the parameter you wire, and doing so
    // turns a static ripple into a wave that runs around the array in time.
    cloneParam('phase', 'Phase', 0, 1, 0),
    cloneParam('sharpness', 'Sharpness', 1, 8, 1),
    ...outputDescriptors(),
  ],
  affect(ctx) {
    const out = readOutputs(ctx)
    const count = ctx.clones.count
    const frequency = num(ctx.params, 'frequency', 1)
    const phase = num(ctx.params, 'phase', 0)
    const sharpness = Math.max(1, num(ctx.params, 'sharpness', 1))
    const divisor = Math.max(1, count)

    for (let i = 0; i < count; i++) {
      const wave = Math.sin(Math.PI * 2 * ((i / divisor) * frequency + phase))
      // Raising |sin| to a power keeps the sign but narrows the peak, so the wave reads
      // as a pulse travelling through the array rather than a gentle undulation.
      const shaped = Math.sign(wave) * Math.pow(Math.abs(wave), sharpness)
      applyWeight(ctx, out, i, shaped)
    }
  },
}

const METRIC_CHOICES = FEATURE_KEYS.map((key) => ({ value: key, label: metricLabel(key) }))

function metricLabel(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** The one nothing else on the market can do.
 *
 *  Clone i reads a stem's feature timeline at `t − i × delay`. Clone 0 is now, clone 7 is
 *  half a second ago, and the ring becomes a physical waveform of the recent past — every
 *  hit visibly travels outward through the array (14-VISUAL-IDEAS §1.2).
 *
 *  Only possible because features are timelines sampled by `t` rather than live taps
 *  (HC-3). A live-analyser architecture knows the present and nothing else, so it cannot
 *  express this at all — not slowly, not approximately.
 *
 *  It reads `AudioFeatures` directly rather than going through the modulation matrix
 *  because the matrix evaluates one value per address per frame, and this needs `count`
 *  different values at `count` different moments. Still a pure function of time, so
 *  scrubbing backwards reproduces exactly. */
export const delayEffector: EffectorBrick = {
  id: 'eff-delay',
  label: 'Time Delay Effector',
  family: 'instancing',
  hint: 'Each clone reads the stem a little further in the past. The array becomes a waveform.',
  descriptors: [
    {
      key: 'stem',
      label: 'Stem',
      type: 'stem',
      min: 0,
      max: 0,
      step: 1,
      defaultValue: '',
      group: 'Cloner',
      exposed: false,
      realtime: false,
    },
    cloneChoice('metric', 'Metric', 'envelope', METRIC_CHOICES),
    cloneParam('delay', 'Delay Per Clone', -0.5, 0.5, 0.06, { unit: 's', step: 0.001 }),
    cloneParam('lookAhead', 'Look Ahead', -1, 1, 0, { unit: 's', step: 0.005 }),
    ...outputDescriptors(),
  ],
  affect(ctx) {
    const trackId = text(ctx.params, 'stem', '')
    if (!trackId) return

    const out = readOutputs(ctx)
    const metric = text(ctx.params, 'metric', 'envelope') as FeatureKey
    const delay = num(ctx.params, 'delay', 0.06)
    // Positive look-ahead reads the future, so the array braces a moment before the hit
    // lands. Also structurally impossible without feature timelines (§1.1).
    const lead = num(ctx.params, 'lookAhead', 0)
    const count = ctx.clones.count

    for (let i = 0; i < count; i++) {
      const t = ctx.time + lead - i * delay
      applyWeight(ctx, out, i, t < 0 ? 0 : AudioFeatures.sample(trackId, metric, t))
    }
  },
}

/** Deterministic per-clone noise. Integer hash rather than Math.random, because a
 *  scatter that changes on every frame is a flicker, not a scatter. */
function hash(index: number, seed: number): number {
  let h = (index * 374761393 + seed * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export const EFFECTOR_BRICKS: EffectorBrick[] = [
  stepEffector,
  randomEffector,
  waveEffector,
  delayEffector,
]
