import type { ID } from './audio'
import type { SignalChain } from './modulation'

/** States, strips and markers (docs/03-ARCHITECTURE.md HC-7/HC-8, §4.5).
 *
 *  Modelled on Blender's NLA, which solved this exact problem: an **Action** is the
 *  reusable data and a **Strip** on the timeline is a *reference* to it. Editing the
 *  Action updates every placement.
 *
 *  A State therefore holds **selections, not copies** — which objects are visible and
 *  which wires are live. That follows from HC-8: the modulation graph is project-global,
 *  and a State activates a subset of it. If routing lived inside states, every cut would
 *  hard-reset every envelope in the project, which is musically wrong in the common case:
 *  you want "drums → scale" to survive the cut and only the *scene* to change. */

/** A named, reusable visual configuration. Referenced by strips, never copied (HC-7). */
export interface VisualState {
  id: ID
  name: string
  color: string
  /** SceneObjects visible in this state. Objects themselves live in `useSceneStore`. */
  sceneObjectIds: ID[]
  /** Modulation connections live in this state (HC-8). */
  activeConnectionIds: ID[]
  /** Post-process effects enabled in this state. */
  activePostIds: ID[]
  /** Per-state chain tweaks on otherwise-global connections — "the same wire, harder in
   *  the drop". Partial, so a state only records what it actually changes. */
  connectionOverrides: Record<ID, Partial<SignalChain>>
}

/** A placement of a State on the timeline. Multiple strips may reference one state. */
export interface Strip {
  id: ID
  stateId: ID
  /** Seconds on the project timeline. */
  startTime: number
  duration: number
  /** Lane index. Higher lanes take precedence, like layers in an image editor. */
  lane: number
}

export interface SectionMarker {
  id: ID
  time: number
  type: SectionType
  label: string
}

/** The vocabulary from the original brief, kept verbatim — `fakeout` and `fill` are
 *  trap-beat structure and are exactly the audience's own words.
 *
 *  Ordered roughly as a track unfolds, because this array is what the picker renders and a
 *  list in song order is faster to scan than one in alphabetical order. */
export const SECTION_TYPES = [
  'intro',
  'build-up',
  'fakeout',
  'drop',
  'fill',
  'breakdown',
  'verse',
  'chorus',
  'bridge',
  'outro',
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

/** What pressing the marker shortcut drops. The moment worth marking is almost always the
 *  drop, and any marker's type can be changed after the fact. */
export const DEFAULT_SECTION_TYPE: SectionType = 'drop'

export interface Project {
  name: string
  bpm: number | null
  /** The library. Keyed by id because strips look states up constantly. */
  statesLibrary: Record<ID, VisualState>
  timelineStrips: Strip[]
  markers: SectionMarker[]
}

/** Lanes available on the visual track. Three is enough to overlap a build, a drop and a
 *  persistent background without becoming a spreadsheet. */
export const TIMELINE_LANES = 3
