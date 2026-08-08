import type { ID } from './audio'
import type { ModulationConnection } from './modulation'
import type { EffectInstance, SceneObject } from './visual'
import type { Palette } from '@/engine/scene/palette'

/** States, strips and markers (docs/03-ARCHITECTURE.md §4.5).
 *
 *  **A State owns its scene.** Its objects, its routing, its post chain. Switching to a state
 *  loads that scene; switching away saves it. Strips on the timeline reference states, so one
 *  state placed three times is still one thing to edit — that part of the Blender NLA model
 *  holds.
 *
 *  *This replaces an earlier design where a state was a **selection** over one shared object
 *  pool — a set of visible-object ids rather than the objects themselves.* It was wrong in
 *  practice for a reason no amount of correctness could fix: every state's objects appeared in
 *  the layer stack at once, so a five-state project showed you thirty shapes and switching
 *  states only toggled which were hidden. Nobody can author against that. A state is a scene,
 *  and the layer stack shows the scene you are in. */

/** A scene, named. Referenced by strips, never copied — one state placed three times is one
 *  thing to edit. */
export interface VisualState {
  id: ID
  name: string
  color: string

  /** This state's scene. Owned, not referenced: switching states swaps these in and out. */
  objects: SceneObject[]
  /** This state's routing. A wire belongs to the state it was drawn in. */
  connections: ModulationConnection[]
  /** This state's post chain, in order. */
  post: EffectInstance[]
  /** This state's colours. Owned, so switching states changes the palette — and so a shared state
   *  carries the colours it was designed in. */
  palette: Palette
  /** Whether the whole post chain is bypassed in this state. */
  postBypassed: boolean
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
