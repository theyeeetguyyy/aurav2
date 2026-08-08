import { describe, expect, it } from 'vitest'
import { decodeProject, encodeProject } from './projectFile'
import { PROJECT_VERSION } from './schema'

/** Loading is the only thing in this app a user can lose work to, so the migration gets its own
 *  tests. Each case is a file shape that existed at some point and must still open. */

/** A v1 project as it was actually written: lanes with absolute-time points and a mode, and a
 *  wire pointing straight at a raw metric. */
function v1(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    savedAt: '2026-01-01T00:00:00.000Z',
    name: 'Old',
    stems: [
      {
        id: 'stem-1',
        name: 'Drums',
        fileName: 'drums.wav',
        color: '#f97316',
        volume: 1,
        solo: false,
        mute: false,
        trimStart: 0,
        trimEnd: 10,
      },
    ],
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

/** `decodeProject` reads bytes, the same way it does from disk. */
function bytes(project: unknown): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify(project))
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength,
  ) as ArrayBuffer
}

function open(project: unknown) {
  const { project: decoded, message } = decodeProject(bytes(project))
  expect(message).toBeNull()
  return decoded!
}

describe('v1 lanes → v2 clips and patterns', () => {
  it('turns a drawn curve into one pattern and one clip over it', () => {
    const decoded = open(
      v1({
        lanes: [
          {
            id: 'lane-1',
            name: 'Sweep',
            color: '#10b981',
            interpolation: 'linear',
            mode: 'edited',
            points: [
              { t: 0, v: 0 },
              { t: 8, v: 1 },
            ],
          },
        ],
      }),
    )

    const lane = decoded.lanes[0]
    expect(lane.clips).toHaveLength(1)
    expect(lane.clips[0].startTime).toBe(0)
    expect(lane.clips[0].duration).toBeCloseTo(8)
    expect(lane.clips[0].repeat).toBe(1)

    // The shape survives, normalised onto 0-1.
    const pattern = decoded.patterns![lane.clips[0].patternId]
    expect(pattern.interpolation).toBe('linear')
    expect(pattern.points[0]).toEqual({ t: 0, v: 0 })
    expect(pattern.points[pattern.points.length - 1]).toEqual({ t: 1, v: 1 })
  })

  it('leaves an analysis-mode lane with no clips, which means the same thing in v2', () => {
    const decoded = open(
      v1({
        lanes: [
          {
            id: 'lane-1',
            name: 'Drums',
            color: '#f97316',
            interpolation: 'smooth',
            mode: 'analysis',
            points: [],
            source: { trackId: 'stem-1', metric: 'envelope' },
          },
        ],
      }),
    )

    expect(decoded.lanes[0].clips).toEqual([])
    expect(decoded.lanes[0].source).toEqual({ trackId: 'stem-1', metric: 'envelope' })
  })

  it('drops the fields v2 does not have, so nothing carries a stale flag forward', () => {
    const decoded = open(
      v1({
        lanes: [
          {
            id: 'lane-1',
            name: 'Sweep',
            color: '#10b981',
            interpolation: 'step',
            mode: 'edited',
            points: [{ t: 0, v: 1 }],
          },
        ],
      }),
    )

    const lane = decoded.lanes[0] as unknown as Record<string, unknown>
    expect(lane.points).toBeUndefined()
    expect(lane.mode).toBeUndefined()
    expect(lane.interpolation).toBeUndefined()
  })
})

describe('v1 audio wires → lane wires', () => {
  const wired = () =>
    v1({
      modulation: {
        connections: [
          {
            id: 'c1',
            enabled: true,
            source: { kind: 'audio', key: 'band-sub', sourceId: 'stem-1' },
            target: { objectId: 'obj-1', paramKey: 'scale.uniform' },
            chain: {},
          },
        ],
        triggers: [],
      },
    })

  it('rewrites the wire to point at a lane', () => {
    const decoded = open(wired())
    const connection = decoded.modulation.connections[0]
    expect(connection.source.kind).toBe('automation')
    expect(connection.source.sourceId).toBeTruthy()
  })

  it('creates the lane the rewritten wire needs, for the right stem and metric', () => {
    const decoded = open(wired())
    const laneId = decoded.modulation.connections[0].source.sourceId
    const lane = decoded.lanes.find((l) => l.id === laneId)

    expect(lane).toBeDefined()
    expect(lane!.source).toEqual({ trackId: 'stem-1', metric: 'band-sub' })
    // It arrives empty, so it follows the analysis — exactly what the raw metric did.
    expect(lane!.clips).toEqual([])
    expect(lane!.name).toContain('Drums')
  })

  it('reuses one lane for two wires on the same signal', () => {
    const source = { kind: 'audio', key: 'band-sub', sourceId: 'stem-1' }
    const target = { objectId: 'obj-1', paramKey: 'scale.uniform' }
    const decoded = open(
      v1({
        modulation: {
          connections: [
            { id: 'c1', enabled: true, source, target, chain: {} },
            { id: 'c2', enabled: true, source, target, chain: {} },
          ],
          triggers: [],
        },
      }),
    )
    const [a, b] = decoded.modulation.connections
    expect(a.source.sourceId).toBe(b.source.sourceId)
    expect(decoded.lanes).toHaveLength(1)
  })

  it('migrates triggers too, not only connections', () => {
    // Triggers hold a source the same way connections do. Missing them would have left every
    // onset trigger in every existing project pointing at a kind nothing offers any more.
    const decoded = open(
      v1({
        modulation: {
          connections: [],
          triggers: [
            {
              id: 't1',
              enabled: true,
              source: { kind: 'audio', key: 'onset', sourceId: 'stem-1' },
              target: { objectId: 'obj-1', paramKey: 'emissiveIntensity' },
            },
          ],
        },
      }),
    )

    const trigger = decoded.modulation.triggers[0]
    expect(trigger.source.kind).toBe('automation')
    const lane = decoded.lanes.find((l) => l.id === trigger.source.sourceId)
    expect(lane!.source).toEqual({ trackId: 'stem-1', metric: 'onset' })
  })

  it('leaves wires of other kinds alone', () => {
    const decoded = open(
      v1({
        modulation: {
          connections: [
            {
              id: 'c1',
              enabled: true,
              source: { kind: 'rhythm', key: 'beat-phase' },
              target: { objectId: 'obj-1', paramKey: 'scale.uniform' },
              chain: {},
            },
          ],
          triggers: [],
        },
      }),
    )
    expect(decoded.modulation.connections[0].source.kind).toBe('rhythm')
    expect(decoded.lanes).toHaveLength(0)
  })
})

describe('round trip', () => {
  it('a v2 file written now decodes unchanged', () => {
    const decoded = open(v1())
    const again = open(JSON.parse(new TextDecoder().decode(encodeProject(decoded))))
    expect(again.version).toBe(PROJECT_VERSION)
    expect(again.lanes).toEqual(decoded.lanes)
    expect(again.patterns).toEqual(decoded.patterns)
  })

  it('refuses a file from a newer version rather than half-reading it', () => {
    const { project, message } = decodeProject(bytes(v1({ version: PROJECT_VERSION + 1 })))
    expect(project).toBeNull()
    expect(message).toContain('newer version')
  })
})
