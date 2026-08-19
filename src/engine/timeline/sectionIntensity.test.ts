import { describe, expect, it } from 'vitest'
import { APPROACH_WINDOW, sectionAt, type Section } from './sectionIntensity'

const song: Section[] = [
  { time: 0, type: 'intro' },
  { time: 8, type: 'build-up' },
  { time: 16, type: 'drop' },
  { time: 24, type: 'breakdown' },
]
const DURATION = 32

const at = (t: number) => sectionAt(song, t, DURATION)

describe('sectionAt', () => {
  it('says nothing when nothing is marked', () => {
    // An unmarked project has no arc, and inventing one would put the software's opinion into a
    // piece the user never described.
    const state = sectionAt([], 5, DURATION)
    expect(state.type).toBeNull()
    expect(state.intensity).toBe(0)
  })

  it('reports no section before the first marker', () => {
    // Reporting the first section's arc early would make a build appear to start before the user
    // said it did.
    expect(sectionAt([{ time: 10, type: 'build-up' }], 2, DURATION).type).toBeNull()
  })

  it('knows which section it is in', () => {
    expect(at(1).type).toBe('intro')
    expect(at(9).type).toBe('build-up')
    expect(at(17).type).toBe('drop')
    expect(at(30).type).toBe('breakdown')
  })

  it('runs progress from 0 to 1 across a section', () => {
    expect(at(8).progress).toBeCloseTo(0)
    expect(at(12).progress).toBeCloseTo(0.5)
    expect(at(15.99).progress).toBeCloseTo(1, 1)
  })

  it('closes the final section against the project duration', () => {
    // Without it the last marker has no end, progress sits at zero forever, and an outro never
    // falls.
    expect(at(24).progress).toBeCloseTo(0)
    expect(at(28).progress).toBeCloseTo(0.5)
  })

  it('builds tension across a build-up — the thing a frame-local metric cannot say', () => {
    // D-29's whole point. RMS knows how loud this instant is; it cannot know this is the third bar
    // of eight. Intensity must rise monotonically from the start of the build to its end.
    const samples = [8, 10, 12, 14, 15.9].map((t) => at(t).intensity)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1])
    }
    expect(samples[0]).toBeLessThan(0.3)
    expect(samples[samples.length - 1]).toBeGreaterThan(0.9)
  })

  it('gathers rather than ramping evenly', () => {
    // Tension is not felt linearly. The second half of a build must gain more than the first.
    const start = at(8).intensity
    const middle = at(12).intensity
    const end = at(15.9).intensity
    expect(middle - start).toBeLessThan(end - middle)
  })

  it('drops from full and settles', () => {
    expect(at(16).intensity).toBeCloseTo(1, 1)
    expect(at(23.9).intensity).toBeLessThan(at(16).intensity)
    expect(at(23.9).intensity).toBeGreaterThan(0.8)
  })

  it('falls through a breakdown', () => {
    expect(at(24).intensity).toBeGreaterThan(at(31).intensity)
  })

  it('makes a fakeout collapse at its end — the one shape its name does not give away', () => {
    const fake: Section[] = [
      { time: 0, type: 'fakeout' },
      { time: 10, type: 'drop' },
    ]
    const rising = sectionAt(fake, 7, 20).intensity
    const collapsed = sectionAt(fake, 9.9, 20).intensity
    expect(rising).toBeGreaterThan(0.6)
    expect(collapsed).toBeLessThan(0.15)
  })

  it('rises into the next boundary — anticipation from structure', () => {
    // The signal no live tool can have: it needs to know when the next section begins, which is a
    // fact about a file that has not finished playing.
    expect(at(16 - APPROACH_WINDOW - 1).approach).toBe(0)
    const early = at(16 - APPROACH_WINDOW * 0.75).approach
    const late = at(16 - 0.2).approach
    expect(early).toBeGreaterThan(0)
    expect(late).toBeGreaterThan(early)
    // Not 1.0 until the boundary itself: squaring means the last fifth of a second is still 10 %
    // short, which is the point — the rise is felt at the end rather than spread across the window.
    expect(late).toBeGreaterThan(0.85)
  })

  it('has nothing to approach after the last boundary', () => {
    // Holding it at 1 through an outro would read as a permanent unresolved build.
    expect(at(31).approach).toBe(0)
  })

  it('sorts markers itself, because the timeline lets them be dragged past each other', () => {
    const jumbled: Section[] = [
      { time: 16, type: 'drop' },
      { time: 0, type: 'intro' },
      { time: 8, type: 'build-up' },
    ]
    expect(sectionAt(jumbled, 9, DURATION).type).toBe('build-up')
  })

  it('stays inside 0–1 everywhere, for every section type', () => {
    const types = ['intro', 'build-up', 'fakeout', 'drop', 'fill', 'breakdown', 'verse', 'chorus', 'bridge', 'outro'] as const
    for (const type of types) {
      for (let t = 0; t <= 10; t += 0.25) {
        const state = sectionAt([{ time: 0, type }], t, 10)
        expect(state.intensity, `${type} @${t}`).toBeGreaterThanOrEqual(0)
        expect(state.intensity, `${type} @${t}`).toBeLessThanOrEqual(1)
        expect(Number.isFinite(state.intensity), `${type} @${t}`).toBe(true)
      }
    }
  })

  it('survives two markers at the same moment', () => {
    // Reachable by dragging one onto another, and a zero-length section must not divide by zero.
    const stacked: Section[] = [
      { time: 4, type: 'build-up' },
      { time: 4, type: 'drop' },
    ]
    const state = sectionAt(stacked, 4, 10)
    expect(Number.isFinite(state.intensity)).toBe(true)
    expect(state.progress).toBeGreaterThanOrEqual(0)
  })
})
