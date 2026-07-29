/// <reference lib="webworker" />

/** Offline MIR analysis (docs/03-ARCHITECTURE.md HC-3).
 *
 *  Runs ONCE per stem on import, off the main thread, producing dense feature
 *  timelines sampled at a fixed rate. This is what makes preview and export identical:
 *  both sample the same arrays by time, so rendering frame 5000 out of order and
 *  faster than real time gives exactly the value the user previewed.
 *
 *  Analysing the whole file up front also fixes the problem a live analyser cannot:
 *  normalisation. Seeing every frame lets each band be scaled against its own
 *  distribution, so a band spanning one FFT bin (sub) and a band spanning 150
 *  (brilliance) both use the full 0–1 range. Live, that is guesswork — and getting it
 *  wrong reads to a user as "nothing reacts to my hats". */

import {
  BAND_EDGES_HZ,
  BAND_KEYS,
  FEATURE_KEYS,
  FEATURE_RATE,
  FFT_SIZE,
  type AnalysisRequest,
  type AnalysisResponse,
  type FeatureKey,
  type TrackFeatures,
} from './featureTypes'

// ─────────────────────────────────────────────────────────────────────────────
// FFT — iterative radix-2 Cooley-Tukey, in place
// ─────────────────────────────────────────────────────────────────────────────

/** Precomputed bit-reversal permutation and twiddle factors for one FFT size. */
function makeFFT(size: number) {
  const levels = Math.log2(size)
  if (!Number.isInteger(levels)) throw new Error('FFT size must be a power of two')

  const reverse = new Uint32Array(size)
  for (let i = 0; i < size; i++) {
    let r = 0
    for (let bit = 0; bit < levels; bit++) r |= ((i >> bit) & 1) << (levels - 1 - bit)
    reverse[i] = r
  }

  const cos = new Float64Array(size / 2)
  const sin = new Float64Array(size / 2)
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / size)
    sin[i] = Math.sin((2 * Math.PI * i) / size)
  }

  return (re: Float64Array, im: Float64Array): void => {
    for (let i = 0; i < size; i++) {
      const j = reverse[i]
      if (j > i) {
        let t = re[i]
        re[i] = re[j]
        re[j] = t
        t = im[i]
        im[i] = im[j]
        im[j] = t
      }
    }

    for (let span = 2; span <= size; span *= 2) {
      const half = span / 2
      const step = size / span
      for (let start = 0; start < size; start += span) {
        for (let k = 0, tw = 0; k < half; k++, tw += step) {
          const a = start + k
          const b = a + half
          const wr = cos[tw]
          const wi = -sin[tw]
          const xr = re[b] * wr - im[b] * wi
          const xi = re[b] * wi + im[b] * wr
          re[b] = re[a] - xr
          im[b] = im[a] - xi
          re[a] += xr
          im[a] += xi
        }
      }
    }
  }
}

const fft = makeFFT(FFT_SIZE)
const HALF = FFT_SIZE / 2

/** Hann window — sidelobe suppression matters more than mainlobe width here,
 *  because band energies are sums over neighbouring bins. */
const WINDOW = (() => {
  const w = new Float64Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)))
  return w
})()

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

/** Scale a timeline to 0–1 against a high percentile of its own distribution.
 *
 *  Percentile rather than max: a single clipped transient would otherwise squash the
 *  entire rest of the track into the bottom of the range. Values above the percentile
 *  clamp at 1, which is the musically correct behaviour — a hit that is louder than
 *  the loudest 2% should read as "full", not as "slightly more than the rest". */
function normaliseInPlace(values: Float32Array, percentile = 0.98): void {
  if (values.length === 0) return

  const sorted = Float32Array.from(values).sort()
  const reference = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))]
  if (reference <= 1e-9) return

  for (let i = 0; i < values.length; i++) {
    values[i] = Math.min(1, values[i] / reference)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Onset detection
// ─────────────────────────────────────────────────────────────────────────────

/** Peak-pick a spectral-flux curve using an adaptive local-median threshold.
 *
 *  A fixed threshold fails on real material: a track's quiet intro and its drop have
 *  wildly different flux magnitudes, so anything that catches the intro drowns in the
 *  drop. The local median tracks the moving noise floor instead. */
function detectOnsets(flux: Float32Array, frameRate: number): number[] {
  const windowFrames = Math.round(frameRate * 0.15)
  const minGapFrames = Math.round(frameRate * 0.04) // 40 ms refractory period
  const onsets: number[] = []

  const scratch: number[] = []
  let lastOnset = -Infinity

  for (let i = 0; i < flux.length; i++) {
    const lo = Math.max(0, i - windowFrames)
    const hi = Math.min(flux.length - 1, i + windowFrames)

    scratch.length = 0
    for (let j = lo; j <= hi; j++) scratch.push(flux[j])
    scratch.sort((a, b) => a - b)
    const median = scratch[scratch.length >> 1]

    const threshold = median * 1.6 + 0.02
    const isLocalPeak =
      flux[i] > threshold &&
      (i === 0 || flux[i] >= flux[i - 1]) &&
      (i === flux.length - 1 || flux[i] >= flux[i + 1])

    if (isLocalPeak && i - lastOnset >= minGapFrames) {
      onsets.push(i / frameRate)
      lastOnset = i
    }
  }

  return onsets
}

/** Estimate tempo from inter-onset intervals.
 *
 *  Histogram of gaps, folded into the 60–180 BPM range by octave doubling/halving —
 *  a kick pattern and its double-time hats produce the same underlying tempo, and
 *  without folding the histogram splits between the two. */
function estimateBpm(onsets: number[]): number | null {
  if (onsets.length < 8) return null

  const histogram = new Map<number, number>()
  for (let i = 1; i < onsets.length; i++) {
    for (let lag = 1; lag <= 4 && i - lag >= 0; lag++) {
      const gap = onsets[i] - onsets[i - lag]
      if (gap < 0.2 || gap > 2) continue

      let bpm = 60 / gap
      while (bpm < 60) bpm *= 2
      while (bpm > 180) bpm /= 2

      const bucket = Math.round(bpm)
      histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1)
    }
  }

  let best = 0
  let bestCount = 0
  for (const [bpm, count] of histogram) {
    if (count > bestCount) {
      bestCount = count
      best = bpm
    }
  }

  // Too few agreeing intervals means the material is not clearly metrical
  // (pads, risers, one-shots). Reporting a confident-looking wrong number is worse
  // than reporting none — the whole beat grid would be built on it.
  return bestCount >= 6 ? best : null
}

function buildBeatGrid(bpm: number | null, onsets: number[], duration: number): number[] {
  if (!bpm || onsets.length === 0) return []

  const period = 60 / bpm
  // Anchor the grid on the first onset so bar one lands on a real hit, not on t=0.
  const phase = onsets[0] % period
  const grid: number[] = []
  for (let t = phase; t < duration; t += period) grid.push(t)
  return grid
}

// ─────────────────────────────────────────────────────────────────────────────
// Main analysis
// ─────────────────────────────────────────────────────────────────────────────

function analyse(samples: Float32Array, sampleRate: number): TrackFeatures {
  const duration = samples.length / sampleRate
  const frameCount = Math.max(1, Math.ceil(duration * FEATURE_RATE))
  const hop = sampleRate / FEATURE_RATE
  const nyquist = sampleRate / 2

  const timelines = {} as Record<FeatureKey, Float32Array>
  for (const key of FEATURE_KEYS) timelines[key] = new Float32Array(frameCount)

  // Band edges in bin indices, precomputed once.
  const bandBins = BAND_EDGES_HZ.map((hz) =>
    Math.min(HALF - 1, Math.max(0, Math.round((hz / nyquist) * HALF))),
  )

  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  const magnitude = new Float64Array(HALF)
  const prevMagnitude = new Float64Array(HALF)

  for (let frame = 0; frame < frameCount; frame++) {
    const center = Math.round(frame * hop)
    const start = center - FFT_SIZE / 2

    let sumSquares = 0
    let peak = 0

    for (let i = 0; i < FFT_SIZE; i++) {
      const index = start + i
      const sample = index >= 0 && index < samples.length ? samples[index] : 0
      sumSquares += sample * sample
      const abs = sample < 0 ? -sample : sample
      if (abs > peak) peak = abs
      re[i] = sample * WINDOW[i]
      im[i] = 0
    }

    timelines.rms[frame] = Math.sqrt(sumSquares / FFT_SIZE)
    timelines.peak[frame] = peak

    fft(re, im)

    let magnitudeSum = 0
    let weightedSum = 0
    let flux = 0

    for (let bin = 0; bin < HALF; bin++) {
      const mag = Math.hypot(re[bin], im[bin])
      magnitude[bin] = mag
      magnitudeSum += mag
      weightedSum += mag * bin
      // Half-wave rectified: only energy INCREASE signals an onset. Decay is not
      // an attack, and counting it doubles every event.
      const rise = mag - prevMagnitude[bin]
      if (rise > 0) flux += rise
    }

    timelines['spectral-centroid'][frame] =
      magnitudeSum > 1e-9 ? weightedSum / magnitudeSum / HALF : 0
    timelines['spectral-flux'][frame] = flux

    for (let band = 0; band < BAND_KEYS.length; band++) {
      const lo = bandBins[band]
      const hi = Math.max(lo, bandBins[band + 1])
      let power = 0
      for (let bin = lo; bin <= hi; bin++) power += magnitude[bin] * magnitude[bin]
      // Mean power, then amplitude. Mean (not sum) so a wide band is not inflated
      // by bin count alone; per-band normalisation below handles what remains.
      timelines[BAND_KEYS[band]][frame] = Math.sqrt(power / (hi - lo + 1))
    }

    prevMagnitude.set(magnitude)
  }

  // Every metric gets its own percentile scaling — this is the step a live analyser
  // structurally cannot perform, and the reason bands are usable at all.
  normaliseInPlace(timelines.rms)
  normaliseInPlace(timelines.peak)
  normaliseInPlace(timelines['spectral-flux'])
  for (const key of BAND_KEYS) normaliseInPlace(timelines[key])

  const onsetTimes = detectOnsets(timelines['spectral-flux'], FEATURE_RATE)

  // Continuous onset envelope: an exponentially decaying impulse per detected hit.
  // Discrete triggers read onsetTimes; anything wanting a smooth "how recently did
  // this stem hit" value reads this.
  const decayPerFrame = Math.exp(-1 / (FEATURE_RATE * 0.12))
  for (const time of onsetTimes) {
    const frame = Math.round(time * FEATURE_RATE)
    if (frame >= 0 && frame < frameCount) timelines.onset[frame] = 1
  }
  for (let frame = 1; frame < frameCount; frame++) {
    const decayed = timelines.onset[frame - 1] * decayPerFrame
    if (decayed > timelines.onset[frame]) timelines.onset[frame] = decayed
  }

  // Envelope: asymmetric follower over RMS — fast attack, slow release, the shape
  // that makes visuals hit on the transient and settle rather than chatter.
  const attack = Math.exp(-1 / (FEATURE_RATE * 0.005))
  const release = Math.exp(-1 / (FEATURE_RATE * 0.15))
  let envelope = 0
  for (let frame = 0; frame < frameCount; frame++) {
    const target = timelines.rms[frame]
    const coefficient = target > envelope ? attack : release
    envelope = target + (envelope - target) * coefficient
    timelines.envelope[frame] = envelope
  }

  const bpm = estimateBpm(onsetTimes)

  return {
    duration,
    frameCount,
    timelines,
    onsetTimes,
    bpm,
    beatGrid: buildBeatGrid(bpm, onsetTimes, duration),
  }
}

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const { trackId, samples, sampleRate } = event.data
  const features = analyse(samples, sampleRate)

  const response: AnalysisResponse = { trackId, features }
  // Transfer every timeline buffer rather than structured-cloning them.
  const transfer = Object.values(features.timelines).map((t) => t.buffer)
  ;(self as unknown as Worker).postMessage(response, transfer)
}
