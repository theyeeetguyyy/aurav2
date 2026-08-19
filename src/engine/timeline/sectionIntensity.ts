import type { SectionType } from '@/types/project'

/** The section-aware intensity engine — Phase 6C, and the brief's oldest unanswered question.
 *
 *  *"musicians show story, tensions, calls and responses, ups and downs thru music… they should
 *  also be able to simulate them in the visuals."* That sat as philosophy through every document
 *  because nothing in the system could express it. [D-29](../../../docs/07-DECISIONS.md) named the
 *  reason precisely: **frame-local metrics structurally cannot say "tension building over eight
 *  bars."** RMS knows how loud this instant is. It cannot know it is the third bar of a build.
 *
 *  Markers already carry that knowledge and did nothing with it — a `drop` marker was a label, and
 *  the section vocabulary (`build-up`, `fakeout`, `fill`…) came verbatim from the audience's own
 *  words. This turns the layout into three continuous signals any parameter can be wired to:
 *
 *  | | |
 *  |---|---|
 *  | **Intensity** | Where this moment sits in the arc, by section type and position within it |
 *  | **Progress** | 0 → 1 through the current section, whatever its type |
 *  | **Approach** | Rises into the *next* boundary. Anticipation, from structure rather than audio |
 *
 *  **Approach is the one no live tool can have**, for the same reason a negative wire offset is
 *  (D-122): it requires knowing when the next section begins, which is a fact about a file that has
 *  not finished playing. It is what lets a scene brace for a drop that has not happened yet.
 *
 *  Pure, and a function of `(markers, time)` only — no accumulation, no memory of previous frames
 *  (HC-3). Two exports of the same project produce the same arc. */

export interface Section {
  time: number
  type: SectionType
}

export interface SectionState {
  /** The section covering this moment, or null before the first marker. */
  type: SectionType | null
  /** Where the arc sits, 0–1. */
  intensity: number
  /** Position through the current section, 0–1. Zero when the section has no end yet. */
  progress: number
  /** How near the next boundary is, 0–1, over `APPROACH_WINDOW` seconds. */
  approach: number
}

/** How long before a boundary `approach` starts to rise. About two bars at 120 BPM — long enough
 *  to be a gesture rather than a jump cut, short enough that it is clearly about *this* boundary. */
export const APPROACH_WINDOW = 4

const IDLE: SectionState = { type: null, intensity: 0, progress: 0, approach: 0 }

/** The arc of one section type, as a function of how far through it you are.
 *
 *  These curves are the musical claim this whole module makes, so they are written out rather than
 *  derived from a rule. Each says what that section *does* to a listener:
 *
 *  - **build-up** is the only one that has to rise the whole way, and it accelerates rather than
 *    ramping linearly — tension is not felt evenly, it gathers.
 *  - **fakeout** rises exactly like a build and then falls off a cliff at the end. That is what the
 *    word means, and it is the one section type whose shape cannot be guessed from its name alone.
 *  - **drop** starts at full and decays slightly. Sustained maximum reads as flat; a drop is a
 *    release that gradually settles.
 *  - **verse**, **chorus**, **bridge** are held levels rather than shapes — they say where you are,
 *    not what is happening. */
function arc(type: SectionType, progress: number): number {
  const t = progress

  switch (type) {
    case 'intro':
      return 0.1 + 0.15 * t
    case 'build-up':
      // Quadratic: the last quarter of a build gains as much as its first half.
      return 0.25 + 0.75 * t * t
    case 'fakeout':
      // Rises like a build, then collapses over the final fifth.
      return t < 0.8 ? 0.25 + 0.7 * (t / 0.8) ** 2 : 0.95 * (1 - (t - 0.8) / 0.2) ** 2
    case 'drop':
      return 1 - 0.15 * t
    case 'fill':
      // Short and rising — a fill is a run-up, not a state.
      return 0.6 + 0.4 * t
    case 'breakdown':
      return 0.5 - 0.35 * t
    case 'verse':
      return 0.35
    case 'chorus':
      return 0.8
    case 'bridge':
      return 0.45 - 0.1 * t
    case 'outro':
      return 0.3 * (1 - t)
  }
}

/** Resolve the arc at a moment.
 *
 *  `markers` need not be sorted — the timeline lets them be dragged past each other, and sorting a
 *  handful of entries per frame is cheaper than keeping a parallel ordered copy correct.
 *
 *  `duration` closes the final section. Without it the last marker would have no end, so its
 *  progress would sit at zero forever and an `outro` would never fall. */
export function sectionAt(
  markers: readonly Section[],
  time: number,
  duration: number,
): SectionState {
  if (markers.length === 0) return IDLE

  const ordered = [...markers].sort((a, b) => a.time - b.time)

  let index = -1
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].time <= time) index = i
    else break
  }

  // Before the first marker there is no section. Reporting the first one's arc early would make a
  // build appear to start before the user said it did.
  if (index < 0) {
    const until = ordered[0].time - time
    return { ...IDLE, approach: approachOf(until) }
  }

  const current = ordered[index]
  const next = ordered[index + 1]
  const end = next ? next.time : Math.max(duration, current.time)

  const span = end - current.time
  const progress = span > 0 ? Math.min(1, Math.max(0, (time - current.time) / span)) : 0

  return {
    type: current.type,
    intensity: Math.min(1, Math.max(0, arc(current.type, progress))),
    progress,
    // Nothing to approach past the final boundary — holding it at 1 through an outro would read as
    // a permanent unresolved build.
    approach: next ? approachOf(next.time - time) : 0,
  }
}

function approachOf(secondsUntil: number): number {
  if (secondsUntil <= 0) return 1
  if (secondsUntil >= APPROACH_WINDOW) return 0
  // Squared, so the rise is felt in the last moment rather than spread evenly across the window.
  const linear = 1 - secondsUntil / APPROACH_WINDOW
  return linear * linear
}
