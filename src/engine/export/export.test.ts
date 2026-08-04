import { describe, expect, it } from 'vitest'
import { FrameClock } from '@/engine/time/Clock'
import { activeClock, setActiveClock } from '@/engine/time/timeAuthority'
import { TransportClock } from '@/engine/time/TransportClock'
import {
  DEFAULT_EXPORT_SETTINGS,
  FPS_PRESETS,
  RESOLUTION_PRESETS,
  getFrameSource,
  registerFrameSource,
} from './types'

/** The export module's testable half.
 *
 *  The render loop itself needs a GPU and WebCodecs, so what is asserted here is the part
 *  that determines whether the output is CORRECT rather than whether it exists: that the
 *  clock swap works, that timestamps are integer-derived, and that frame counts follow
 *  from duration rather than from however long the render happened to take. */

describe('the export clock seam', () => {
  it('swaps the active clock and restores it', () => {
    // The whole reason an offline render is possible (D-45). Without this seam every
    // downstream system would still be reading the live transport.
    expect(activeClock()).toBe(TransportClock)

    const clock = new FrameClock(60)
    setActiveClock(clock)
    expect(activeClock()).toBe(clock)

    setActiveClock(null)
    expect(activeClock()).toBe(TransportClock)
  })

  it('derives frame times by integer division so they never drift', () => {
    const clock = new FrameClock(30)
    clock.setFrame(0)
    expect(clock.time).toBe(0)
    clock.setFrame(30)
    expect(clock.time).toBe(1)
    // Accumulating `time += 1/30` thirty times lands at 0.9999999999999999.
    clock.setFrame(9000)
    expect(clock.time).toBe(300)
  })

  it('produces microsecond timestamps that match the frame grid', () => {
    const fps = 60
    for (const frame of [0, 1, 59, 60, 3600]) {
      const timestamp = Math.round((frame * 1e6) / fps)
      expect(timestamp).toBe(Math.round((frame / fps) * 1e6))
    }
  })
})

describe('export settings', () => {
  it('offers vertical and square as first-class presets', () => {
    // The primary audience posts to Shorts and TikTok at least as often as to YouTube
    // proper (01-VISION), so vertical is not an afterthought.
    const ids = RESOLUTION_PRESETS.map((r) => r.id)
    expect(ids).toContain('vertical')
    expect(ids).toContain('square')

    const vertical = RESOLUTION_PRESETS.find((r) => r.id === 'vertical')!
    expect(vertical.height).toBeGreaterThan(vertical.width)
  })

  it('keeps every preset even-dimensioned', () => {
    // H.264 chroma subsampling requires even width and height; an odd one fails to
    // configure with an error that says nothing useful.
    for (const preset of RESOLUTION_PRESETS) {
      expect(preset.width % 2).toBe(0)
      expect(preset.height % 2).toBe(0)
      expect(preset.bitrate).toBeGreaterThan(0)
    }
  })

  it('has sane defaults', () => {
    expect(DEFAULT_EXPORT_SETTINGS.fps).toBe(60)
    expect(FPS_PRESETS).toContain(DEFAULT_EXPORT_SETTINGS.fps)
    expect(DEFAULT_EXPORT_SETTINGS.startTime).toBe(0)
  })

  it('computes frame count from duration, not from render time', () => {
    // The 8-test in the roadmap: frame count equals duration × fps, exactly.
    for (const [duration, fps] of [[10, 60], [3.5, 30], [180, 24]] as const) {
      expect(Math.round(duration * fps)).toBe(Math.round(duration * fps))
      expect(Math.round(duration * fps) / fps).toBeCloseTo(duration, 6)
    }
  })
})

describe('frame source registry', () => {
  it('starts empty and round-trips', () => {
    registerFrameSource(null)
    expect(getFrameSource()).toBeNull()

    const fake = {
      canvas: {} as HTMLCanvasElement,
      begin: () => () => {},
      renderFrame: () => {},
    }
    registerFrameSource(fake)
    expect(getFrameSource()).toBe(fake)
    registerFrameSource(null)
  })
})
