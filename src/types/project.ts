import type { ID } from './audio'

/** A State is a reusable visual configuration snapshot:
 *  sceneObjects + effects + modulation routing + camera position + post-processing.
 *  States live in a library and are *referenced* by timeline Strips. */
export interface VisualState {
  id: ID
  name: string
  /** IDs of SceneObjects (shapes, lights, particles, backgrounds) included in this state */
  sceneObjectIds: ID[]
  /** Modulation connections active in this state */
  modulationConnectionIds: ID[]
  /** Camera position snapshot */
  cameraSnapshot: {
    position: [number, number, number]
    quaternion: [number, number, number, number]
  } | null
  /** Post-processing settings */
  postProcessing: PostProcessingSettings
}

export interface PostProcessingSettings {
  bloom: boolean
  bloomIntensity: number
  bloomThreshold: number
  toneMapping: boolean
}

/** A Strip is a reference to a State placed on the NLE timeline.
 *  Multiple strips can reference the same state. */
export interface Strip {
  id: ID
  stateId: ID
  /** Start time in seconds on the timeline */
  startTime: number
  /** Duration in seconds */
  duration: number
  /** Track lane index (for multi-track visual timeline) */
  lane: number
}

/** Section marker on the timeline */
export interface SectionMarker {
  id: ID
  time: number
  type: SectionType
  label: string
}

export type SectionType =
  | 'intro'
  | 'build-up'
  | 'drop'
  | 'breakdown'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'outro'

/** Top-level project container */
export interface Project {
  name: string
  bpm: number | null
  /** States library — the reusable visual configs */
  statesLibrary: Record<ID, VisualState>
  /** Timeline strips referencing states */
  timelineStrips: Strip[]
  /** Section markers */
  markers: SectionMarker[]
}
