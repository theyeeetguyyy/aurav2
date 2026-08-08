import type { Strip, VisualState } from '@/types/project'

/** Which state is on screen at time `t` (docs/04-ENGINE-SPECS.md §4.5).
 *
 *  A pure function of time, like everything else in the render path (HC-3): the exporter asks for
 *  frame 5000 before frame 12, and scrubbing backwards has to reproduce exactly. So resolution
 *  reads the strip list and the clock, and keeps no state of its own.
 *
 *  **An empty timeline means "whatever you are editing".** A project with no strips is one
 *  continuous scene, which is what every project is before it gets sequenced — and it is a
 *  perfectly good way to make a video. Sequencing is opt-in, not a prerequisite.
 *
 *  *This used to return sets of visible object ids, live wire ids and live effect ids, because a
 *  state was a selection over one shared pool.* Now a state owns its scene, so there is exactly
 *  one thing to resolve: which state. Everything that consumed those sets — `isVisible`,
 *  `isConnectionActive`, `isPostActive`, and the whole question of which authority wins when the
 *  timeline and the editor disagree — went with them. */

export interface ResolvedTimeline {
  /** The state to render, or null when nothing is sequenced here. */
  stateId: string | null
  /** Strips live at this moment, lowest lane first. Empty on an unsequenced project. */
  activeStripIds: string[]
  /** When the most recent cut happened, in seconds, or null when nothing is sequenced.
   *
   *  Published so an effect can key off the *edit* rather than off the music — a flash on a cut is
   *  `t - cutTime`, which stays a pure function of time (HC-3) and therefore survives an
   *  out-of-order offline render. */
  cutTime: number | null
}

/** No timeline, a gap, or nothing resolvable — render whatever is loaded. */
export const EVERYTHING: ResolvedTimeline = {
  stateId: null,
  activeStripIds: [],
  cutTime: null,
}

export function resolveTimeline(
  strips: readonly Strip[],
  states: Record<string, VisualState>,
  time: number,
): ResolvedTimeline {
  if (strips.length === 0) return EVERYTHING

  // Lowest lane first, so a higher lane's state wins — the layer model, and the same convention
  // Blender's NLA and every image editor use.
  const live = strips
    .filter((strip) => time >= strip.startTime && time < strip.startTime + strip.duration)
    .sort((a, b) => a.lane - b.lane)

  // A gap in the timeline is a deliberate hold rather than a blackout: cutting to nothing mid-song
  // is almost never what someone meant by leaving a space.
  if (live.length === 0) return EVERYTHING

  const activeStripIds: string[] = []
  let stateId: string | null = null
  // The LATEST boundary, not the earliest: with a background strip under a drop, the moment the
  // picture changed is when the drop came in.
  let cutTime = 0

  for (const strip of live) {
    if (!states[strip.stateId]) continue
    activeStripIds.push(strip.id)
    // Highest lane last, so it ends up owning the frame.
    stateId = strip.stateId
    cutTime = Math.max(cutTime, strip.startTime)
  }

  // Every live strip referenced a state that has since been deleted. Falling through beats
  // rendering an empty frame the user cannot explain.
  if (stateId === null) return EVERYTHING

  return { stateId, activeStripIds, cutTime }
}

/** Where a new strip should land so it is visible rather than buried.
 *
 *  Placing at the playhead is what someone means by *Place*, but two placements at the same
 *  playhead would sit exactly on top of each other — the second one hidden, on a lane that the
 *  higher-lane-wins rule says is losing anyway. So: prefer the requested lane, then any free lane,
 *  and only if every lane is busy fall back to appending after everything.
 *
 *  A caller that names a lane explicitly — dropping onto lane 2 — gets that lane untouched.
 *  Deciding for them would make the drop target a lie. */
export function findFreeSlot(
  strips: readonly Strip[],
  startTime: number,
  duration: number,
  lanes: number,
): { startTime: number; lane: number } {
  const end = startTime + duration
  const overlaps = (lane: number) =>
    strips.some(
      (strip) =>
        strip.lane === lane &&
        startTime < strip.startTime + strip.duration &&
        end > strip.startTime,
    )

  for (let lane = 0; lane < lanes; lane++) {
    if (!overlaps(lane)) return { startTime, lane }
  }

  return {
    startTime: strips.reduce((max, strip) => Math.max(max, strip.startTime + strip.duration), 0),
    lane: 0,
  }
}

/** Pixels of pointer travel within which a drag is considered "on" a beat.
 *
 *  Screen space, not time, so the feel is the same at every zoom. A fixed time window cannot be:
 *  0.12s is 48px of dead pull when zoomed right in, and half a pixel when zoomed out to the whole
 *  song — grabby exactly where precision is wanted, absent exactly where snapping is the only way
 *  to hit anything. */
export const SNAP_WINDOW_PIXELS = 8

/** Where a strip would land after snapping.
 *
 *  Snapping to the detected beat grid is what turns "line this cut up with the drop" from a fiddly
 *  drag into a click. Falls back to the raw time when no grid exists, rather than snapping to an
 *  invented one.
 *
 *  `tolerance` is in seconds and is the caller's to compute — the resolver has no idea what the
 *  zoom is. Zero or less disables snapping, which is why there is no separate flag. */
export function snapToGrid(time: number, grid: readonly number[], tolerance: number): number {
  const clamped = Math.max(0, time)
  if (tolerance <= 0 || grid.length === 0) return clamped

  let nearest = grid[0]
  let best = Math.abs(clamped - nearest)
  for (const beat of grid) {
    const distance = Math.abs(clamped - beat)
    if (distance < best) {
      best = distance
      nearest = beat
    }
  }

  return best <= tolerance ? Math.max(0, nearest) : clamped
}
