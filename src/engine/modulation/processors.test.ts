import { describe, expect, it } from 'vitest'
import {
  PROCESSOR_BRICKS,
  applyProcessors,
  getProcessorBrick,
  processorDefaults,
  processorTimeOffset,
  type ModulationProcessor,
  type ProcessorKind,
} from './processors'

function processor(kind: ProcessorKind, params: Record<string, number> = {}): ModulationProcessor {
  return {
    id: `p-${kind}`,
    kind,
    name: kind,
    enabled: true,
    params: { ...processorDefaults(kind), ...params },
  }
}

describe('processor bricks', () => {
  it('every kind has a brick and sane defaults', () => {
    for (const brick of PROCESSOR_BRICKS) {
      expect(getProcessorBrick(brick.kind)).toBe(brick)
      const defaults = processorDefaults(brick.kind)
      for (const descriptor of brick.descriptors) {
        expect(defaults[descriptor.key]).toBe(Number(descriptor.defaultValue))
      }
    }
  })

  it('none of them duplicate the signal chain', () => {
    // Gain, curve and rise/fall belong to the wire. A second way to smooth a signal would be a
    // second thing to get wrong, so this list must stay disjoint from the chain's stages.
    const keys = PROCESSOR_BRICKS.flatMap((b) => b.descriptors.map((d) => d.key))
    for (const forbidden of ['gain', 'rise', 'fall', 'curve', 'weight', 'min', 'max']) {
      expect(keys).not.toContain(forbidden)
    }
  })
})

describe('quantise', () => {
  const steps = (n: number, value: number) =>
    applyProcessors([processor('quantise', { steps: n })], value)

  it('snaps to levels', () => {
    expect(steps(2, 0.4)).toBe(0)
    expect(steps(2, 0.6)).toBe(1)
    expect(steps(3, 0.5)).toBeCloseTo(0.5)
  })

  it('keeps both ends reachable', () => {
    // Dividing by `steps` rather than `steps - 1` would make full range unreachable, and a
    // parameter that never quite arrives reads as a bug.
    expect(steps(5, 1)).toBe(1)
    expect(steps(5, 0)).toBe(0)
  })

  it('produces exactly N distinct values', () => {
    const seen = new Set<number>()
    for (let i = 0; i <= 100; i++) seen.add(steps(4, i / 100))
    expect(seen.size).toBe(4)
  })

  it('stays in range whatever it is given', () => {
    for (const value of [-5, 0, 0.5, 1, 5, Number.NaN]) {
      const out = steps(8, value)
      expect(out).toBeGreaterThanOrEqual(0)
      expect(out).toBeLessThanOrEqual(1)
    }
  })
})

describe('sample & hold', () => {
  it('reads the source at the last tick of its rate', () => {
    const hold = [processor('hold', { rate: 4 })] // every 0.25s
    expect(processorTimeOffset(hold, 0.1)).toBeCloseTo(0)
    expect(processorTimeOffset(hold, 0.3)).toBeCloseTo(0.25)
    expect(processorTimeOffset(hold, 0.74)).toBeCloseTo(0.5)
    expect(processorTimeOffset(hold, 0.75)).toBeCloseTo(0.75)
  })

  it('holds — every time inside one tick reads the same moment', () => {
    const hold = [processor('hold', { rate: 2 })]
    const first = processorTimeOffset(hold, 0.51)
    expect(processorTimeOffset(hold, 0.6)).toBeCloseTo(first)
    expect(processorTimeOffset(hold, 0.99)).toBeCloseTo(first)
    expect(processorTimeOffset(hold, 1.01)).not.toBeCloseTo(first)
  })

  it('is a pure function of time, which a remembered sample could never be', () => {
    const hold = [processor('hold', { rate: 3 })]
    const forwards = processorTimeOffset(hold, 5.4)
    processorTimeOffset(hold, 90)
    // Asking again for the same moment gives the same answer, in any order.
    expect(processorTimeOffset(hold, 5.4)).toBeCloseTo(forwards)
  })
})

describe('delay', () => {
  it('reads the source as it was earlier', () => {
    expect(processorTimeOffset([processor('delay', { seconds: 0.5 })], 3)).toBeCloseTo(2.5)
  })

  it('never asks for a moment before the piece started', () => {
    // Every source is silent there, so a delayed wire would drop to zero for its delay length
    // instead of holding its first value.
    expect(processorTimeOffset([processor('delay', { seconds: 2 })], 0.5)).toBe(0)
  })

  it('passes the value through unchanged — it changes WHEN, not what', () => {
    expect(applyProcessors([processor('delay', { seconds: 1 })], 0.37)).toBeCloseTo(0.37)
  })
})

describe('stacks', () => {
  it('compose in order — delay then hold holds the value from earlier', () => {
    const stack = [processor('delay', { seconds: 1 }), processor('hold', { rate: 4 })]
    // t=3 → delay to 2 → hold snaps 2 to the tick at 2.
    expect(processorTimeOffset(stack, 3)).toBeCloseTo(2)
    // t=3.1 → 2.1 → snaps back to 2.
    expect(processorTimeOffset(stack, 3.1)).toBeCloseTo(2)
  })

  it('skips disabled stages entirely', () => {
    const off = { ...processor('delay', { seconds: 2 }), enabled: false }
    expect(processorTimeOffset([off], 5)).toBe(5)
    const quantOff = { ...processor('quantise', { steps: 2 }), enabled: false }
    expect(applyProcessors([quantOff], 0.4)).toBeCloseTo(0.4)
  })

  it('an empty stack is the identity, in both time and value', () => {
    expect(processorTimeOffset([], 7.5)).toBe(7.5)
    expect(applyProcessors([], 0.42)).toBeCloseTo(0.42)
  })

  it('ignores an unknown kind rather than throwing', () => {
    const bogus = { ...processor('quantise'), kind: 'nope' as ProcessorKind }
    expect(applyProcessors([bogus], 0.4)).toBeCloseTo(0.4)
    expect(processorTimeOffset([bogus], 5)).toBe(5)
  })
})
