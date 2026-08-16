/** Silence — how long a stem has been NOT playing.
 *
 *  Every visualiser on the market reacts to loudness. Nothing reacts to **absence** — and in this
 *  genre the bar before the drop, where everything stops, is the most important visual moment in the
 *  track. It is currently inexpressible: there is no metric among the other thirteen that says
 *  "this stem has dropped out".
 *
 *  **Why inverting the envelope does not work.** `1 - envelope` is high between every two kicks, so
 *  it fires eight times a bar and reads as chatter. What makes silence a musical event is
 *  **duration**: the signal has to ignore the gap between hits and respond only to a stop that
 *  lasts. So it counts consecutive quiet frames, ignores the first `IGNORE` seconds of them, and
 *  ramps to full over `RAMP`.
 *
 *  **It can only be computed offline, and that is not incidental.** A live tap cannot tell "silent"
 *  from "has not started yet" — at the first frame of a song, every stem is quiet. Here the whole
 *  file exists before the first frame renders, so the run before a stem's first sound is held at
 *  zero explicitly, and an intro does not open with every silence wire at maximum.
 *
 *  Its own module rather than a block inside the worker because the worker assigns `self.onmessage`
 *  at module scope and therefore cannot be imported by a test. A rule this specific — ignore short
 *  gaps, ramp over long ones, never fire before the first sound — is worth asserting. */

/** Envelope level below which a stem counts as quiet. Above the noise floor of a normalised
 *  envelope, below anything that would read as a note. */
export const SILENCE_FLOOR = 0.06

/** Quiet shorter than this is the gap between hits, not a stop. About a 16th at 100 BPM. */
export const SILENCE_IGNORE = 0.14

/** How long a stop takes to reach full value once it has passed `SILENCE_IGNORE`. */
export const SILENCE_RAMP = 0.6

/** Write the silence timeline for one stem, in place.
 *
 *  `envelope` and `out` are the same length and sampled at `rate`. Pure, and independent of where
 *  the envelope came from. */
export function writeSilence(
  envelope: Float32Array,
  out: Float32Array,
  rate: number,
): void {
  out.fill(0)

  let firstSound = -1
  for (let frame = 0; frame < envelope.length; frame++) {
    if (envelope[frame] > SILENCE_FLOOR) {
      firstSound = frame
      break
    }
  }

  // A stem that never rises above the floor has no silence to report — it has no signal at all,
  // and reporting "silent throughout" would make a muted stem the loudest source in the project.
  if (firstSound < 0) return

  const ignoreFrames = SILENCE_IGNORE * rate
  const rampFrames = Math.max(1, SILENCE_RAMP * rate)
  let quietFor = 0

  for (let frame = firstSound; frame < envelope.length; frame++) {
    quietFor = envelope[frame] > SILENCE_FLOOR ? 0 : quietFor + 1
    const held = (quietFor - ignoreFrames) / rampFrames
    out[frame] = held <= 0 ? 0 : held >= 1 ? 1 : held
  }
}
