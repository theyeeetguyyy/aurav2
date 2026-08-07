import { describe, expect, it } from 'vitest'
import { avcCandidates } from './Mp4Encoder'

/** The 4K preset failed at `configure()` for months because the codec string pinned level
 *  4.0, whose frame ceiling is 8192 macroblocks. These are the arithmetic guards. */
describe('avcCandidates', () => {
  const level = (codec: string) => codec.replace('avc1.6400', '')

  it('keeps 1080p on level 4.0 — the most widely decodable level that fits', () => {
    // 120 × 68 = 8160 macroblocks, just under the 8192 ceiling.
    expect(level(avcCandidates(1920, 1080, 30)[0])).toBe('28')
  })

  it('raises the level for 1440p, which does not fit 4.0', () => {
    // 160 × 90 = 14400 macroblocks.
    expect(level(avcCandidates(2560, 1440, 30)[0])).toBe('32')
  })

  it('raises it again for 4K, the case that used to fail outright', () => {
    // 240 × 135 = 32400 macroblocks — level 5.0 tops out at 22080.
    expect(level(avcCandidates(3840, 2160, 30)[0])).toBe('33')
  })

  it('accounts for frame rate, not just frame size', () => {
    // 4K at 60 needs 1.94M macroblocks/sec; level 5.1 allows 983040, so 5.2 is the floor.
    expect(level(avcCandidates(3840, 2160, 60)[0])).toBe('34')
  })

  it('rounds partial macroblocks up', () => {
    // 1080 is not a multiple of 16. Rounding down would understate the frame and pick a
    // level the encoder then rejects.
    expect(avcCandidates(1080, 1920, 30).length).toBeGreaterThan(0)
    expect(level(avcCandidates(1080, 1920, 30)[0])).toBe('28')
  })

  it('offers higher levels as fallbacks, in order', () => {
    const candidates = avcCandidates(1920, 1080, 30).map(level)
    expect(candidates[0]).toBe('28')
    expect(candidates).toContain('33')
    // Monotonically increasing, so the first supported answer is also the most compatible.
    expect([...candidates].sort()).toEqual(candidates)
  })

  it('still returns something when nothing fits, so the browser gives the error', () => {
    expect(avcCandidates(16000, 16000, 120)).toHaveLength(1)
  })
})
