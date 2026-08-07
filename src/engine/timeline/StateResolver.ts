import type { SignalChain } from '@/types/modulation'
import type { Strip, VisualState } from '@/types/project'

/** What is on screen at time `t` (docs/04-ENGINE-SPECS.md §4.5).
 *
 *  A pure function of time, like everything else in the render path (HC-3): the exporter
 *  asks for frame 5000 before frame 12, and scrubbing backwards has to reproduce exactly.
 *  So resolution reads the strip list and the clock, and keeps no state of its own.
 *
 *  **An empty timeline means "everything".** A project with no strips is one continuous
 *  scene, which is what every project is before it gets sequenced — and it is a perfectly
 *  good way to make a video. Sequencing is opt-in, not a prerequisite. */

export interface ResolvedTimeline {
  /** Object ids to show. Null means "no timeline — show everything". */
  visibleObjectIds: Set<string> | null
  /** Connection ids to evaluate. Null means "all of them". */
  activeConnectionIds: Set<string> | null
  /** Post effect ids to run. Null means "all of them". */
  activePostIds: Set<string> | null
  /** Chain overrides from the winning strip's state, merged by connection id. */
  overrides: Record<string, Partial<SignalChain>>
  /** Strips live at this moment, lowest lane first. Empty on an unsequenced project. */
  activeStripIds: string[]
  /** When the most recent cut happened, in seconds. The latest start time among the live
   *  strips, or `null` on an unsequenced project.
   *
   *  Published so an effect can key off the *edit* rather than off the music — a flash on a
   *  cut is `t - cutTime`, which stays a pure function of time (HC-3) and therefore survives
   *  an out-of-order offline render. */
  cutTime: number | null
}

/** No timeline, a gap, or nothing resolvable — show the whole scene. */
export const EVERYTHING: ResolvedTimeline = {
  visibleObjectIds: null,
  activeConnectionIds: null,
  activePostIds: null,
  overrides: {},
  activeStripIds: [],
  cutTime: null,
}

export function resolveTimeline(
  strips: readonly Strip[],
  states: Record<string, VisualState>,
  time: number,
): ResolvedTimeline {
  if (strips.length === 0) return EVERYTHING

  // Lowest lane first, so a higher lane's state wins a conflict — the layer model, and
  // the same convention Blender's NLA and every image editor use.
  const live = strips
    .filter((strip) => time >= strip.startTime && time < strip.startTime + strip.duration)
    .sort((a, b) => a.lane - b.lane)

  // A gap in the timeline is a deliberate hold rather than a blackout: cutting to nothing
  // mid-song is almost never what someone meant by leaving a space.
  if (live.length === 0) return EVERYTHING

  const visibleObjectIds = new Set<string>()
  const activeConnectionIds = new Set<string>()
  const activePostIds = new Set<string>()
  const overrides: Record<string, Partial<SignalChain>> = {}
  const activeStripIds: string[] = []
  // The latest boundary, not the earliest: with a background strip running under a drop, the
  // moment the picture changed is when the drop came in.
  let cutTime = 0

  for (const strip of live) {
    const state = states[strip.stateId]
    if (!state) continue

    activeStripIds.push(strip.id)
    cutTime = Math.max(cutTime, strip.startTime)
    for (const id of state.sceneObjectIds) visibleObjectIds.add(id)
    for (const id of state.activeConnectionIds) activeConnectionIds.add(id)
    for (const id of state.activePostIds) activePostIds.add(id)

    // Later (higher-lane) states win, key by key. Merging rather than replacing means a
    // background state's weight tweak survives a drop state that only changes gain.
    for (const [connectionId, patch] of Object.entries(state.connectionOverrides)) {
      overrides[connectionId] = { ...overrides[connectionId], ...patch }
    }
  }

  // Every live strip referenced a state that has since been deleted. Falling through to
  // "everything" beats rendering an empty frame the user cannot explain.
  if (activeStripIds.length === 0) return EVERYTHING

  return {
    visibleObjectIds,
    activeConnectionIds,
    activePostIds,
    overrides,
    activeStripIds,
    cutTime,
  }
}

/** Where a new strip should land so it is visible rather than buried.
 *
 *  Placing at the playhead is what someone means by *Place*, but two placements at the same
 *  playhead would sit exactly on top of each other — the second one hidden, on a lane that
 *  the higher-lane-wins rule says is losing anyway. So: prefer the requested lane, then any
 *  free lane, and only if every lane is busy fall back to appending after everything.
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
        strip.lane === lane && startTime < strip.startTime + strip.duration && end > strip.startTime,
    )

  for (let lane = 0; lane < lanes; lane++) {
    if (!overlaps(lane)) return { startTime, lane }
  }

  return {
    startTime: strips.reduce((max, strip) => Math.max(max, strip.startTime + strip.duration), 0),
    lane: 0,
  }
}

/** Apply a state's overrides to a connection's chain. */
export function withOverride(
  chain: SignalChain,
  override: Partial<SignalChain> | undefined,
): SignalChain {
  return override ? { ...chain, ...override } : chain
}

/** Pixels of pointer travel within which a drag is considered "on" a beat.
 *
 *  Screen space, not time, so the feel is the same at every zoom. A fixed time window
 *  cannot be: 0.12s is 48px of dead pull when zoomed right in, and half a pixel when zoomed
 *  out to the whole song — grabby exactly where precision is wanted, absent exactly where
 *  snapping is the only way to hit anything. */
export const SNAP_WINDOW_PIXELS = 8

/** Where a strip would land after snapping.
 *
 *  Snapping to the detected beat grid is what turns "line this cut up with the drop" from
 *  a fiddly drag into a click (the rhythm-game-editor pattern, 02-PRINCIPLES). Falls back
 *  to the raw time when no grid exists, rather than snapping to an invented one.
 *
 *  `tolerance` is in seconds and is the caller's to compute — the resolver has no idea what
 *  the zoom is. Zero or less disables snapping, which is why there is no separate flag. */
export function snapToGrid(
  time: number,
  grid: readonly number[],
  tolerance: number,
): number {
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
