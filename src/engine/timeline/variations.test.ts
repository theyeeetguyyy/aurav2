import { describe, expect, it } from 'vitest'
import {
  ARC_SECTIONS,
  MIN_STRIP_SECONDS,
  generateVariations,
  planSequence,
  type Variation,
  type VariationSeed,
} from './variations'
import { SECTION_TYPES, type SectionMarker, type SectionType } from '@/types/project'

function seed(patch: Partial<VariationSeed> = {}): VariationSeed {
  return {
    shapeIds: ['a', 'b', 'c', 'd'],
    lightIds: ['key', 'fill'],
    postIds: ['grade', 'bloom', 'kaleido'],
    connectionIds: ['w1', 'w2'],
    ...patch,
  }
}

function marker(time: number, type: SectionType): SectionMarker {
  return { id: `m-${time}`, time, type, label: type }
}

describe('generateVariations', () => {
  it('names only sections the vocabulary actually has', () => {
    // A section named in the arc but missing here could never be matched by a marker, and
    // planSequence would silently fall back to cycling forever.
    for (const section of ARC_SECTIONS) {
      expect(SECTION_TYPES).toContain(section)
    }
  })

  it('returns nothing for an empty scene rather than four identical empty states', () => {
    expect(generateVariations(seed({ shapeIds: [] }))).toEqual([])
  })

  it('walks an arc from least to most', () => {
    const variations = generateVariations(seed())
    expect(variations.map((v) => v.section)).toEqual(['intro', 'build-up', 'drop', 'breakdown'])

    const shapes = (v: Variation) => v.sceneObjectIds.filter((id) => !id.startsWith('key') && id !== 'fill')
    expect(shapes(variations[0])).toHaveLength(1) // intro — hero only
    expect(shapes(variations[1])).toHaveLength(2) // build — half
    expect(shapes(variations[2])).toHaveLength(4) // drop — everything
    expect(shapes(variations[3])).toHaveLength(1) // breakdown — hero only again
  })

  it('keeps the lights on in every variation, because the alternative is a black frame', () => {
    for (const variation of generateVariations(seed())) {
      expect(variation.sceneObjectIds).toContain('key')
      expect(variation.sceneObjectIds).toContain('fill')
    }
  })

  it('keeps every wire live, so a cut changes the scene and not the motion (HC-8)', () => {
    for (const variation of generateVariations(seed())) {
      expect(variation.activeConnectionIds).toEqual(['w1', 'w2'])
    }
  })

  it('escalates post: none in the intro, all of it in the drop', () => {
    const variations = generateVariations(seed())
    expect(variations[0].activePostIds).toEqual([])
    expect(variations[2].activePostIds).toEqual(['grade', 'bloom', 'kaleido'])
    // A breakdown is emptier than the drop but not calmer — that is the point of it.
    expect(variations[3].activePostIds).toEqual(['grade', 'bloom', 'kaleido'])
  })

  it('still produces distinguishable variations from a single shape and no post', () => {
    const variations = generateVariations(
      seed({ shapeIds: ['solo'], postIds: [], lightIds: [] }),
    )
    expect(variations).toHaveLength(4)
    for (const variation of variations) {
      expect(variation.sceneObjectIds).toEqual(['solo'])
    }
  })

  it('does not mutate the seed', () => {
    const input = seed()
    const before = JSON.stringify(input)
    generateVariations(input)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('planSequence', () => {
  const variations = generateVariations(seed())

  it('divides evenly and walks the arc when there are no markers', () => {
    const plan = planSequence(variations, [], 120)
    expect(plan).toHaveLength(4)
    expect(plan.map((p) => p.variationIndex)).toEqual([0, 1, 2, 3])
    expect(plan[0]).toEqual({ variationIndex: 0, startTime: 0, duration: 30 })
    expect(plan[3].startTime + plan[3].duration).toBeCloseTo(120)
  })

  it('covers the whole song with no gaps', () => {
    const plan = planSequence(variations, [marker(20, 'drop'), marker(50, 'breakdown')], 100)
    expect(plan[0].startTime).toBe(0)
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].startTime).toBeCloseTo(plan[i - 1].startTime + plan[i - 1].duration)
    }
    const last = plan[plan.length - 1]
    expect(last.startTime + last.duration).toBeCloseTo(100)
  })

  it('lets a marker pick the variation by type, not by turn', () => {
    const plan = planSequence(variations, [marker(30, 'drop')], 60)
    // Head strip, then the drop — chosen because the marker says drop, not because it is next.
    expect(plan).toHaveLength(2)
    expect(variations[plan[1].variationIndex].section).toBe('drop')
  })

  it('cycles for a marker type the arc does not cover', () => {
    // `fill` has no variation; ignoring it would waste a marker the user placed on purpose.
    const plan = planSequence(variations, [marker(0, 'fill'), marker(30, 'drop')], 60)
    expect(plan).toHaveLength(2)
    expect(variations[plan[1].variationIndex].section).toBe('drop')
  })

  it('does not prepend a head strip when a marker already starts the song', () => {
    const plan = planSequence(variations, [marker(0, 'drop'), marker(30, 'breakdown')], 60)
    expect(plan).toHaveLength(2)
    expect(plan[0].startTime).toBe(0)
    expect(variations[plan[0].variationIndex].section).toBe('drop')
  })

  it('ignores markers too close to the end to make a visible strip', () => {
    const plan = planSequence(variations, [marker(30, 'drop'), marker(59.8, 'outro')], 60)
    expect(plan).toHaveLength(2)
  })

  it('drops a cut narrower than the minimum rather than making an ungrabbable strip', () => {
    const plan = planSequence(
      variations,
      [marker(10, 'drop'), marker(10.2, 'breakdown'), marker(30, 'outro')],
      60,
    )
    for (const strip of plan) expect(strip.duration).toBeGreaterThanOrEqual(MIN_STRIP_SECONDS)
  })

  it('makes one strip rather than four stutters on a very short project', () => {
    const plan = planSequence(variations, [], 2)
    expect(plan).toHaveLength(1)
    expect(variations[plan[0].variationIndex].section).toBe('drop')
    expect(plan[0].duration).toBe(2)
  })

  it('plans nothing without variations or duration', () => {
    expect(planSequence([], [], 60)).toEqual([])
    expect(planSequence(variations, [], 0)).toEqual([])
  })
})
