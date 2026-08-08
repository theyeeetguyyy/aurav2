import { patternFromPoints, type AutomationPattern } from '@/engine/automation/clips'
import { AUTOMATION_FIELD } from '@/engine/modulation/fields'
import { DEFAULT_PALETTE } from '@/engine/scene/palette'
import type { AutomationPoint, LaneInterpolation } from '@/engine/automation/lane'
import { PROJECT_VERSION, type AuraProject, type SerialisedLane } from './schema'

/** Reading and writing `.aura.json`.
 *
 *  Separated from the schema so the parsing rules live next to the failure messages they
 *  produce. A project file is the only thing in the app a user can lose work to, so every
 *  refusal here has to say what was wrong rather than throw a parse error. */

export interface LoadResult {
  project: AuraProject | null
  /** Human-readable reason when `project` is null, or a warning when it is not. */
  message: string | null
}

export function encodeProject(project: AuraProject): Uint8Array {
  // Not pretty-printed: feature timelines dominate the file, and indentation on the rest
  // buys readability nobody uses at the cost of size everyone pays.
  return new TextEncoder().encode(JSON.stringify(project))
}

export function decodeProject(bytes: ArrayBuffer): LoadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return { project: null, message: 'That file is not valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { project: null, message: 'That file is not an AURA project.' }
  }

  const candidate = parsed as Partial<AuraProject>
  if (typeof candidate.version !== 'number' || !Array.isArray(candidate.objects)) {
    return { project: null, message: 'That file is not an AURA project.' }
  }

  if (candidate.version > PROJECT_VERSION) {
    // Refusing beats silently dropping whatever a newer version added — a half-loaded
    // project that then gets saved over the original is how work actually disappears.
    return {
      project: null,
      message: `This project was saved by a newer version of AURA (v${candidate.version}). Update before opening it.`,
    }
  }

  return { project: migrate(candidate as AuraProject), message: null }
}

/** Bring an older project up to the current version.
 *
 *  Each step is additive and independent, so a v1 file passes through every step in turn.
 *  Missing collections are filled rather than treated as errors: a project saved before a
 *  feature existed is not corrupt, it simply predates it. */
function migrate(project: AuraProject): AuraProject {
  return {
    ...project,
    version: PROJECT_VERSION,
    name: project.name || 'Untitled',
    stems: project.stems ?? [],
    objects: project.objects ?? [],
    post: project.post ?? { effects: [], bypassed: false },
    environment: project.environment ?? { params: {}, disabled: {} },
    camera: project.camera ?? {
      behaviours: [],
      lookAtId: null,
      lookAtEnabled: true,
      scenePosition: [0, 0, 50],
      sceneQuaternion: [0, 0, 0, 1],
      sceneFov: 45,
    },
    generators: project.generators ?? [],
    ...migrateAutomation(project),
    timeline: migrateStates(project),
  }
}

/** v2 → v3: states own their scenes.
 *
 *  In v2 a state held *ids* — which of the project's shared objects were visible — and the objects
 *  themselves sat at the top level. In v3 a state holds the objects. So each v2 state becomes a
 *  state owning the objects it used to merely select, and its wires and effects likewise.
 *
 *  A v2 project with no states at all becomes a single state holding everything, which is exactly
 *  what it was: one continuous scene. */
function migrateStates(project: AuraProject): AuraProject['timeline'] {
  const timeline = project.timeline
  const objects = project.objects ?? []
  const post = project.post ?? { effects: [], bypassed: false }
  const connections = project.modulation?.connections ?? []

  const legacy = (timeline?.states ?? []) as unknown as LegacyState[]

  // Already v3: the first state carries objects.
  if (legacy.length > 0 && Array.isArray(legacy[0].objects)) return timeline

  if (legacy.length === 0) {
    const id = 'state-1'
    return {
      bpm: timeline?.bpm ?? null,
      strips: timeline?.strips ?? [],
      markers: timeline?.markers ?? [],
      activeStateId: id,
      states: [
        {
          id,
          name: 'State 1',
          color: '#6366f1',
          objects,
          connections,
          post: post.effects,
          postBypassed: post.bypassed,
          palette: DEFAULT_PALETTE,
        },
      ],
    }
  }

  const states = legacy.map((old) => {
    const visible = new Set(old.sceneObjectIds ?? [])
    const liveWires = new Set(old.activeConnectionIds ?? [])
    const livePost = new Set(old.activePostIds ?? [])
    return {
      id: old.id,
      name: old.name,
      color: old.color,
      // The objects it selected become the objects it owns. Anything it did not select simply is
      // not in it — which is what "hidden in this state" meant.
      objects: objects.filter((object) => visible.has(object.id)),
      connections: connections.filter((connection) => liveWires.has(connection.id)),
      post: post.effects.filter((effect) => livePost.has(effect.id)),
      postBypassed: post.bypassed,
      // v3 files predate palettes; the default is the colours they were authored in.
      palette: DEFAULT_PALETTE,
    }
  })

  return {
    bpm: timeline?.bpm ?? null,
    strips: timeline?.strips ?? [],
    markers: timeline?.markers ?? [],
    activeStateId: states[0]?.id ?? null,
    states,
  }
}

/** The v2 shape, for reading only. */
interface LegacyState {
  id: string
  name: string
  color: string
  objects?: unknown
  sceneObjectIds?: string[]
  activeConnectionIds?: string[]
  activePostIds?: string[]
}

/** v1 → v2: lanes, patterns, and the wires that pointed at raw metrics.
 *
 *  Two conversions, done together because the second needs the lanes the first creates.
 *
 *  **A lane's own point curve becomes a pattern with one clip over it.**
 *
 *  v1 lanes held `points` in absolute project seconds and a `mode` flag. v2 lanes hold clips,
 *  and clips reference patterns in normalised time. A drawn v1 curve is exactly one placement of
 *  one pattern spanning the project, so that is what it converts to — the file reopens looking
 *  and sounding the same, and the curve is now something you can shorten, move and reuse.
 *
 *  A v1 lane in `analysis` mode held no points and converts to a lane with no clips, which means
 *  precisely the same thing in v2: follow the stem. */
function migrateAutomation(
  project: AuraProject,
): Pick<AuraProject, 'lanes' | 'patterns' | 'modulation'> {
  const patterns: Record<string, AutomationPattern> = { ...(project.patterns ?? {}) }

  // How long the project is, for converting absolute point times. The stems are the only record
  // of duration in the file, which is the same definition `projectDuration` uses at runtime.
  const span = (project.stems ?? []).reduce((max, stem) => Math.max(max, stem.trimEnd), 0)

  const lanes: SerialisedLane[] = (project.lanes ?? []).map((lane) => {
    // Already v2.
    if (Array.isArray(lane.clips)) return lane

    const legacy = lane as unknown as { points?: AutomationPoint[]; interpolation?: LaneInterpolation }
    const points = legacy.points ?? []
    const stripped = { ...lane } as SerialisedLane
    delete (stripped as unknown as { points?: unknown }).points
    delete (stripped as unknown as { mode?: unknown }).mode
    delete (stripped as unknown as { interpolation?: unknown }).interpolation

    if (points.length === 0) return { ...stripped, clips: [] }

    const patternId = `${lane.id}-pattern`
    const drawnSpan = Math.max(...points.map((point) => point.t), 0) || span || 1

    patterns[patternId] = {
      id: patternId,
      name: lane.name,
      color: lane.color,
      points: patternFromPoints(points, drawnSpan),
      interpolation: legacy.interpolation ?? 'smooth',
    }

    return {
      ...stripped,
      clips: [
        {
          id: `${lane.id}-clip`,
          patternId,
          startTime: 0,
          duration: drawnSpan,
          repeat: 1,
        },
      ],
    }
  })

  // ── Wires that pointed at a raw metric now point at a lane ──
  //
  // Before D-88 a stem exposed all thirteen of its signals directly and a wire could name one:
  // `{ kind: 'audio', sourceId: trackId, key: metric }`. Nothing can create that any more —
  // selecting a metric is what makes it a source, and a source is a lane. Rather than keep a
  // second way to reference a stem signal alive forever, the wires are rewritten and the lanes
  // they need are created. An old project therefore gains clips on the signals it was already
  // using, instead of merely continuing to work.
  const stems = project.stems ?? []

  /** The lane for one stem signal, created on demand. Two wires on the same signal share it. */
  const laneFor = (trackId: string, metric: string): SerialisedLane => {
    const existing = lanes.find(
      (lane) => lane.source?.trackId === trackId && lane.source.metric === metric,
    )
    if (existing) return existing

    const stem = stems.find((candidate) => candidate.id === trackId)
    const lane: SerialisedLane = {
      id: `${trackId}-${metric}`,
      name: `${stem?.name ?? 'Stem'} · ${metric}`,
      color: stem?.color ?? '#6366f1',
      clips: [],
      source: { trackId, metric },
    }
    lanes.push(lane)
    return lane
  }

  /** Rewrite a source that named a raw metric to name a lane instead. */
  const relink = <T extends { source?: { kind: string; key: string; sourceId?: string } }>(
    holder: T,
  ): T => {
    const field = holder.source
    if (field?.kind !== 'audio' || !field.sourceId) return holder
    return {
      ...holder,
      source: {
        kind: 'automation' as const,
        key: AUTOMATION_FIELD.key,
        sourceId: laneFor(field.sourceId, field.key).id,
      },
    }
  }

  return {
    lanes,
    patterns,
    modulation: {
      // Triggers hold a source the same way connections do, so they migrate the same way.
      // Missing them would have left every onset trigger in every existing project pointing at
      // a kind nothing offers any more.
      connections: (project.modulation?.connections ?? []).map(relink),
      triggers: (project.modulation?.triggers ?? []).map(relink),
    },
  }
}

/** Filename from a project name, safe on every filesystem. */
export function projectFileName(name: string): string {
  const safe =
    name
      .trim()
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'untitled'
  return `${safe}.aura.json`
}
