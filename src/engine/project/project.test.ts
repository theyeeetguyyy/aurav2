import { describe, expect, it } from 'vitest'
import {
  PROJECT_VERSION,
  decodeFloats,
  deserialiseFeatures,
  encodeFloats,
  serialiseFeatures,
  type AuraProject,
} from './schema'
import { decodeProject, encodeProject, projectFileName } from './projectFile'
import type { TrackFeatures } from '@/engine/audio/featureTypes'

/** A project file is the only thing in the app a user can lose work to, so the tests
 *  here are less about happy paths and more about the ways a load can quietly do the
 *  wrong thing: a truncated timeline, a version from the future, a missing collection. */

function minimalProject(overrides: Partial<AuraProject> = {}): AuraProject {
  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    name: 'Test',
    stems: [],
    objects: [],
    post: { effects: [], bypassed: false },
    environment: { params: {}, disabled: {} },
    camera: {
      behaviours: [],
      lookAtId: null,
      lookAtEnabled: true,
      scenePosition: [0, 0, 50],
      sceneQuaternion: [0, 0, 0, 1],
      sceneFov: 45,
    },
    modulation: { connections: [], triggers: [] },
    generators: [],
    lanes: [],
    ...overrides,
  }
}

describe('float encoding', () => {
  it('round-trips exactly', () => {
    // Lossy encoding would mean a reopened project's modulation differs from the one
    // that was saved, which breaks the preview-equals-export guarantee (HC-3).
    const values = new Float32Array([0, 0.5, -1, 1e-7, 123456.75, Math.fround(Math.PI)])
    expect(Array.from(decodeFloats(encodeFloats(values)))).toEqual(Array.from(values))
  })

  it('handles arrays larger than the argument limit', () => {
    // 200 Hz over four minutes is ~48k floats per metric. A naive
    // String.fromCharCode(...bytes) throws well before that.
    const values = new Float32Array(200_000)
    for (let i = 0; i < values.length; i++) values[i] = Math.sin(i) * 0.5
    const decoded = decodeFloats(encodeFloats(values))
    expect(decoded.length).toBe(values.length)
    expect(decoded[199_999]).toBeCloseTo(values[199_999], 6)
  })

  it('is far smaller than a JSON number array', () => {
    const values = new Float32Array(20_000).map((_, i) => Math.sin(i))
    expect(encodeFloats(values).length).toBeLessThan(JSON.stringify([...values]).length / 3)
  })
})

describe('feature cache', () => {
  const features: TrackFeatures = {
    duration: 12.5,
    frameCount: 4,
    timelines: { rms: new Float32Array([0, 0.5, 1, 0.25]) } as TrackFeatures['timelines'],
    onsetTimes: [0.5, 1.25],
    bpm: 140,
    beatGrid: [0, 0.43],
  }

  it('round-trips through JSON', () => {
    const restored = deserialiseFeatures(
      JSON.parse(JSON.stringify(serialiseFeatures(features))),
    )
    expect(restored.duration).toBe(features.duration)
    expect(restored.bpm).toBe(140)
    expect(restored.onsetTimes).toEqual([0.5, 1.25])
    expect(Array.from(restored.timelines.rms)).toEqual([0, 0.5, 1, 0.25])
  })

  it('does not share memory with the original', () => {
    const restored = deserialiseFeatures(serialiseFeatures(features))
    restored.onsetTimes.push(99)
    expect(features.onsetTimes).toHaveLength(2)
  })
})

describe('project file', () => {
  it('round-trips a project', () => {
    const project = minimalProject({ name: 'Round Trip' })
    const { project: restored, message } = decodeProject(encodeProject(project).buffer as ArrayBuffer)
    expect(message).toBeNull()
    expect(restored?.name).toBe('Round Trip')
    expect(restored?.version).toBe(PROJECT_VERSION)
  })

  it('refuses a file from a newer version rather than half-loading it', () => {
    // Silently dropping whatever a newer version added, then saving over the original,
    // is how work actually disappears.
    const bytes = encodeProject(minimalProject({ version: PROJECT_VERSION + 5 }))
    const { project, message } = decodeProject(bytes.buffer as ArrayBuffer)
    expect(project).toBeNull()
    expect(message).toMatch(/newer version/i)
  })

  it('rejects non-JSON and non-projects with a readable message', () => {
    const notJson = new TextEncoder().encode('<html>nope</html>')
    expect(decodeProject(notJson.buffer as ArrayBuffer).message).toMatch(/not valid JSON/i)

    const notProject = new TextEncoder().encode('{"hello":"world"}')
    expect(decodeProject(notProject.buffer as ArrayBuffer).message).toMatch(/not an AURA project/i)
  })

  it('fills collections a older project predates instead of failing', () => {
    // A project saved before lanes existed is not corrupt; it simply predates them.
    const legacy = { version: 1, savedAt: '', name: '', objects: [] }
    const bytes = new TextEncoder().encode(JSON.stringify(legacy))
    const { project } = decodeProject(bytes.buffer as ArrayBuffer)

    expect(project).not.toBeNull()
    expect(project?.lanes).toEqual([])
    expect(project?.generators).toEqual([])
    expect(project?.camera.lookAtEnabled).toBe(true)
    expect(project?.name).toBe('Untitled')
  })

  it('makes a filesystem-safe name', () => {
    expect(projectFileName('My Beat / v2 <final>')).toBe('My-Beat-v2-final.aura.json')
    expect(projectFileName('   ')).toBe('untitled.aura.json')
    expect(projectFileName('!!!')).toBe('untitled.aura.json')
  })
})
