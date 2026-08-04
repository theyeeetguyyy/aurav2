import { PROJECT_VERSION, type AuraProject } from './schema'

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
    modulation: project.modulation ?? { connections: [], triggers: [] },
    generators: project.generators ?? [],
    lanes: (project.lanes ?? []).map((lane) => ({
      ...lane,
      // Lanes predating stem automation were all hand-drawn, so they are `edited`.
      mode: lane.mode ?? 'edited',
    })),
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
