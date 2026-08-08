import type { ParamDescriptor } from '@/types/params'

/** Shared processing stages, between a source and everything it drives.
 *
 *  A connection already has a `SignalChain` — its own gain, curve, smoothing and range. That is
 *  the *wire's* trim, and it is private to the wire. A processor is different: it is an object
 *  with an id, and **several connections can reference the same one**, so editing it changes
 *  everything downstream at once. One "quantise to 8 steps" driving six parameters is one object,
 *  not six copies that drift.
 *
 *  Which is also why the routing page is worth drawing as a graph rather than two columns: a
 *  patchbay with computed layout *is* a two-column node graph. The middle column is the reason
 *  to have one.
 *
 *  **Every processor here does something the chain cannot.** Nothing duplicates gain, curve or
 *  rise/fall — a second way to smooth a signal would be a second thing to get wrong. What is
 *  here is stepping, holding and delaying, and all three are new capability:
 *
 *  | | |
 *  |---|---|
 *  | **Quantise** | Snap to N levels. Continuous motion becomes stepped motion — the single cheapest way to make something read as deliberate rather than as drifting |
 *  | **Sample & Hold** | Re-read the input at a fixed rate and hold between reads. The classic stepped-random look, and what turns a smooth envelope into a sequence |
 *  | **Delay** | Read the source as it was `t` seconds ago. Stagger six objects off one stem and they cascade instead of moving as a block |
 *
 *  **All three are pure functions of time**, which is what makes them legal here (HC-3). Delay is
 *  the one that looks stateful and is not: it asks the source for `t - d` rather than remembering
 *  what it saw. Every source in this system is already a function of `t`, so that works — and it
 *  means an out-of-order offline render reproduces exactly, which a buffer of past values could
 *  never guarantee. */

export type ProcessorKind = 'quantise' | 'hold' | 'delay'

export interface ModulationProcessor {
  id: string
  kind: ProcessorKind
  name: string
  enabled: boolean
  params: Record<string, number>
}

export interface ProcessorBrick {
  kind: ProcessorKind
  label: string
  hint: string
  descriptors: ParamDescriptor[]
  /** Transform a 0–1 signal into a 0–1 signal.
   *
   *  Absent on stages that work by changing *when* the source is read rather than what comes
   *  back — Delay and Sample & Hold both do, and both are handled by `processorTimeOffset`.
   *  A pass-through `apply` for them would be a function whose whole body is a comment. */
  apply?(value: number, params: Record<string, number>): number
}

function param(
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
    step: (max - min) / 100,
    defaultValue,
    group: 'Processor',
    exposed: true,
    realtime: true,
    ...options,
  }
}

function num(params: Record<string, number>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Clamp to 0–1, treating a non-number as zero.
 *
 *  The NaN case is the point. `NaN < 0` and `NaN > 1` are both false, so the obvious two-branch
 *  clamp passes NaN straight through — and a NaN reaching a parameter poisons a transform matrix
 *  silently, which shows up as geometry vanishing rather than as an error. */
const clamp01 = (value: number) =>
  Number.isFinite(value) ? (value < 0 ? 0 : value > 1 ? 1 : value) : 0

export const quantiseBrick: ProcessorBrick = {
  kind: 'quantise',
  label: 'Quantise',
  hint: 'Snaps the signal to a number of levels. Turns drifting motion into stepped motion.',
  descriptors: [param('steps', 'Steps', 2, 32, 4, { step: 1 })],
  apply(value, params) {
    const steps = Math.max(2, Math.round(num(params, 'steps', 4)))
    // `steps - 1` intervals, so both 0 and 1 remain reachable. Dividing by `steps` instead would
    // make full range unreachable, and a parameter that never quite arrives reads as a bug.
    return clamp01(Math.round(clamp01(value) * (steps - 1)) / (steps - 1))
  },
}

export const holdBrick: ProcessorBrick = {
  kind: 'hold',
  label: 'Sample & Hold',
  hint: 'Re-reads the input at a fixed rate and holds between reads. Stepped, rhythmic motion.',
  // No `apply`: holding is expressed as *when* the source is read, not as a transform of what
  // comes back. The held value is the value at the last tick of the rate, which
  // `processorTimeOffset` computes — so it stays a pure function of `t` and survives an
  // out-of-order render, which a buffer of past samples never could.
  descriptors: [param('rate', 'Rate', 0.25, 32, 4, { unit: 'hz' })],
}

export const delayBrick: ProcessorBrick = {
  kind: 'delay',
  label: 'Delay',
  hint: 'Reads the source as it was earlier. Stagger several objects off one stem to cascade them.',
  // No `apply`, for the same reason as Sample & Hold: it changes which moment is read.
  descriptors: [param('seconds', 'Delay', 0, 4, 0.25, { unit: 's' })],
}

export const PROCESSOR_BRICKS: ProcessorBrick[] = [quantiseBrick, holdBrick, delayBrick]

export function getProcessorBrick(kind: ProcessorKind): ProcessorBrick | null {
  return PROCESSOR_BRICKS.find((brick) => brick.kind === kind) ?? null
}

export function processorDefaults(kind: ProcessorKind): Record<string, number> {
  const brick = getProcessorBrick(kind)
  if (!brick) return {}
  const params: Record<string, number> = {}
  for (const descriptor of brick.descriptors) {
    params[descriptor.key] = Number(descriptor.defaultValue)
  }
  return params
}

/** When to sample the source, given a stack of processors.
 *
 *  This is the whole trick. Rather than each stage remembering what it saw, the stages that care
 *  about *other moments* say so, and the caller samples the source at that moment instead. Delay
 *  subtracts a fixed amount; Sample & Hold snaps to the last tick of its rate.
 *
 *  Composes in order, so `Delay 1s → Hold 4Hz` holds the value from a second ago, which is what
 *  reading the stack top to bottom would lead you to expect. */
export function processorTimeOffset(
  processors: readonly ModulationProcessor[],
  time: number,
): number {
  let sampleAt = time

  for (const processor of processors) {
    if (!processor.enabled) continue

    if (processor.kind === 'delay') {
      sampleAt -= Math.max(0, num(processor.params, 'seconds', 0.25))
      continue
    }

    if (processor.kind === 'hold') {
      const rate = Math.max(0.01, num(processor.params, 'rate', 4))
      // Floor to the last tick. Negative times floor away from zero correctly, so scrubbing
      // before the start does not produce a phase that jumps.
      sampleAt = Math.floor(sampleAt * rate) / rate
    }
  }

  // Never ask for a moment before the piece started: every source is silent there, so a delayed
  // wire would drop to zero for its delay length rather than holding its first value.
  return Math.max(0, sampleAt)
}

/** Run a stack of processors over a value. */
export function applyProcessors(
  processors: readonly ModulationProcessor[],
  value: number,
): number {
  let out = value
  for (const processor of processors) {
    if (!processor.enabled) continue
    const brick = getProcessorBrick(processor.kind)
    if (brick?.apply) out = brick.apply(out, processor.params)
  }
  return out
}
