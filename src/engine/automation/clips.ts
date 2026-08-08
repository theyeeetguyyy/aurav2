import type { AutomationPoint, LaneInterpolation } from './lane'
import { samplePoints } from './lane'

/** Automation clips — a drawn shape you place, resize and reuse (docs/07-DECISIONS D-83).
 *
 *  The model this replaces had one curve per lane spanning the whole project. That makes the
 *  common request impossible to express: *"I draw a shape that takes a second, and I want it
 *  to happen every second for ten seconds."* You had to draw it ten times, and changing your
 *  mind meant redrawing it ten times.
 *
 *  Two objects instead of one, which is the same split that already works for visual states
 *  (HC-7) and the same split Blender's NLA uses for Actions and Strips:
 *
 *  - a **Pattern** is the shape, stored in normalised time (0–1) so it has no length of its own
 *  - a **Clip** is a placement of a pattern: where it starts, how long it runs, how many times
 *    it cycles inside that
 *
 *  Because a clip references its pattern rather than copying it, placing the same pattern five
 *  times and then editing it once updates all five — which is what "copy paste in front of them
 *  again and again so that I don't have to remake them" actually asks for. Blender calls this a
 *  linked duplicate and makes it a separate command; here it is the only kind, because a
 *  visual-authoring tool has no use for the other one.
 *
 *  `repeat` is the piece that answers the ten-seconds question directly. FL Studio would have
 *  you clone the clip ten times; Blender puts a repeat count on the strip. The repeat count is
 *  better here: one clip, one number, and dragging the clip's end re-times every cycle at once.
 *
 *  Everything below is a pure function of time (HC-3), so scrubbing backwards reproduces
 *  exactly and an offline render can ask for frames out of order. */

export interface AutomationPattern {
  id: string
  name: string
  color: string
  /** Points in **normalised** time: `t` runs 0–1 across the pattern, not in seconds. That is
   *  what lets one pattern serve a half-second clip and a thirty-second one. */
  points: AutomationPoint[]
  interpolation: LaneInterpolation
}

export interface AutomationClip {
  id: string
  patternId: string
  /** Seconds on the project timeline. */
  startTime: number
  /** Seconds. Dragged from either edge, never typed. */
  duration: number
  /** How many times the pattern cycles inside `duration`. 1 is a single pass. */
  repeat: number
}

/** Shortest clip worth having. Below this a clip is smaller than its own drag handles, so it
 *  cannot be grabbed to fix — an unrecoverable state reachable by one careless drag. */
export const MIN_CLIP_SECONDS = 0.05

/** Most cycles a single clip may hold.
 *
 *  Not a performance limit — sampling is O(log n) whatever this is. It is a legibility limit:
 *  past a few dozen cycles the drawn clip is a solid block and the control has stopped
 *  describing anything you can see. */
export const MAX_CLIP_REPEAT = 64

/** Which clip owns time `t`, or null.
 *
 *  Last match wins, so a clip dropped on top of another takes over for its span — the same
 *  rule the visual timeline uses for lanes, and the one every NLE uses for overlap. */
export function clipAt(
  clips: readonly AutomationClip[],
  t: number,
): AutomationClip | null {
  let found: AutomationClip | null = null
  for (const clip of clips) {
    // Half-open, so two clips that butt up never both claim the boundary frame.
    if (t >= clip.startTime && t < clip.startTime + clip.duration) found = clip
  }
  return found
}

/** Where inside its pattern a clip is at time `t`, as 0–1.
 *
 *  Exported because the clip UI draws the pattern the same way the sampler reads it — if the
 *  two disagreed, the curve on screen would not be the curve that runs. */
export function clipPhase(clip: AutomationClip, t: number): number {
  const span = Math.max(MIN_CLIP_SECONDS, clip.duration)
  const local = (t - clip.startTime) / span
  const cycles = Math.max(1, Math.floor(clip.repeat))

  const scaled = local * cycles
  // The final instant of the last cycle reads as 1 rather than wrapping to 0, so a clip that
  // ends high does not flicker to its start value on its own last frame.
  if (scaled >= cycles) return 1
  return scaled - Math.floor(scaled)
}

/** The value a set of clips produces at `t`, or null when no clip covers it.
 *
 *  Null rather than 0 on purpose: the caller decides what a gap means. A stem lane falls back
 *  to its analysed signal, a drawn lane holds the nearest clip's edge. Returning 0 here would
 *  force both to mean "silence", which is wrong for either. */
export function sampleClips(
  clips: readonly AutomationClip[],
  patterns: Readonly<Record<string, AutomationPattern>>,
  t: number,
): number | null {
  const clip = clipAt(clips, t)
  if (!clip) return null

  const pattern = patterns[clip.patternId]
  if (!pattern) return null

  return samplePoints(pattern.points, pattern.interpolation, clipPhase(clip, t))
}

/** The value to hold in a gap: the nearest clip edge, in time.
 *
 *  Blender's NLA calls this `hold` and it is the only sane default — a curve drawn over the
 *  chorus must not mute its parameter for the rest of the song. Before any clip it holds the
 *  first one's start; after the last it holds that one's end; between two it holds whichever
 *  edge is closer, so the value someone last saw is the value that persists. */
export function holdValue(
  clips: readonly AutomationClip[],
  patterns: Readonly<Record<string, AutomationPattern>>,
  t: number,
): number | null {
  if (clips.length === 0) return null

  let best: { distance: number; value: number } | null = null

  for (const clip of clips) {
    const pattern = patterns[clip.patternId]
    if (!pattern) continue

    const end = clip.startTime + clip.duration
    const candidates: [number, number][] = [
      [Math.abs(t - clip.startTime), samplePoints(pattern.points, pattern.interpolation, 0)],
      [Math.abs(t - end), samplePoints(pattern.points, pattern.interpolation, 1)],
    ]

    for (const [distance, value] of candidates) {
      if (!best || distance < best.distance) best = { distance, value }
    }
  }

  return best ? best.value : null
}

/** Clamp a clip's fields to the ranges the rest of the module assumes. */
export function normaliseClip(clip: AutomationClip): AutomationClip {
  return {
    ...clip,
    startTime: Math.max(0, clip.startTime),
    duration: Math.max(MIN_CLIP_SECONDS, clip.duration),
    repeat: Math.min(MAX_CLIP_REPEAT, Math.max(1, Math.round(clip.repeat))),
  }
}

/** Resize from either edge.
 *
 *  Dragging the left edge moves the start AND shortens the body, which is what makes the right
 *  edge appear to stay put — the thing that separates resizing from moving. Both edges stop at
 *  `MIN_CLIP_SECONDS` rather than passing through each other and inverting the clip. */
export function resizeClip(
  clip: AutomationClip,
  edge: 'start' | 'end',
  time: number,
): AutomationClip {
  if (edge === 'start') {
    const end = clip.startTime + clip.duration
    const start = Math.max(0, Math.min(time, end - MIN_CLIP_SECONDS))
    return normaliseClip({ ...clip, startTime: start, duration: end - start })
  }

  const end = Math.max(time, clip.startTime + MIN_CLIP_SECONDS)
  return normaliseClip({ ...clip, duration: end - clip.startTime })
}

/** Where a duplicate of `clip` should land: immediately after it.
 *
 *  Duplicating in place would hide the copy under the original, and the copy is on top, so the
 *  original would be the one that stopped playing — invisible and inert at once. Butting them
 *  up also makes the common case, "again", a single keypress that needs no drag afterwards. */
export function duplicateOffset(clip: AutomationClip): number {
  return clip.startTime + clip.duration
}

/** Convert absolute-time points into a normalised pattern.
 *
 *  Used for migration and for "turn what I drew across the project into something reusable".
 *  An empty or zero-length input yields a flat pattern rather than nothing, because a pattern
 *  with no points samples as 0 and would read as a bug. */
export function patternFromPoints(
  points: readonly AutomationPoint[],
  duration: number,
): AutomationPoint[] {
  if (points.length === 0 || duration <= 0) {
    return [
      { t: 0, v: 0.5 },
      { t: 1, v: 0.5 },
    ]
  }

  const span = Math.max(...points.map((p) => p.t)) || duration
  return points.map((p) => ({ t: Math.min(1, Math.max(0, p.t / span)), v: p.v }))
}
