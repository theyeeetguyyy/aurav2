/** Offline mixdown of the trimmed, faded stems.
 *
 *  `OfflineAudioContext` renders faster than real time and deterministically, which is the
 *  same property the visual side gets from `FrameClock` — the audio in the file is exactly
 *  the audio you heard, not a recording of it.
 *
 *  Honours trim, volume and mute/solo, because those are what the user mixed. It does NOT
 *  honour the analysis tap: that is pre-fader by design (HC-11), so pulling a stem down
 *  quiets it in the render while its visuals keep reacting — which is the point. */

export interface MixdownStem {
  buffer: AudioBuffer
  /** Seconds into the project where this stem's audible region starts and ends. */
  trimStart: number
  trimEnd: number
  volume: number
  muted: boolean
}

export async function mixStems(
  stems: MixdownStem[],
  duration: number,
  sampleRate = 48_000,
): Promise<AudioBuffer | null> {
  const audible = stems.filter((s) => !s.muted && s.volume > 0 && s.trimEnd > s.trimStart)
  if (audible.length === 0 || duration <= 0) return null

  const frames = Math.ceil(duration * sampleRate)
  const context = new OfflineAudioContext(2, frames, sampleRate)

  for (const stem of audible) {
    const source = context.createBufferSource()
    source.buffer = stem.buffer

    const gain = context.createGain()
    gain.gain.value = stem.volume
    source.connect(gain)
    gain.connect(context.destination)

    // Same scheduling the live rack uses: clamp into the trim region, and delay the start
    // if the region does not begin at zero, so a stem enters at the right moment.
    const offset = Math.max(0, stem.trimStart)
    const length = Math.max(0, Math.min(stem.trimEnd, stem.buffer.duration) - offset)
    if (length <= 0) continue
    source.start(offset, offset, length)
  }

  return context.startRendering()
}
