import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { DualCameraEngine } from '@/engine/camera/DualCameraEngine'
import { CommandHistory } from '@/engine/commands/CommandHistory'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { platform } from '@/engine/platform/PlatformAdapter'
import {
  PROJECT_VERSION,
  deserialiseFeatures,
  serialiseFeatures,
  type AuraProject,
  type StemRef,
} from '@/engine/project/schema'
import { decodeProject, encodeProject, projectFileName } from '@/engine/project/projectFile'
import { useAudioStore } from '@/store/useAudioStore'
import { useAutomationStore } from '@/store/useAutomationStore'
import { useCameraStore } from '@/store/useCameraStore'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
import { useGeneratorStore } from '@/store/useGeneratorStore'
import { useModulationStore } from '@/store/useModulationStore'
import { usePostStore } from '@/store/usePostStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useSceneStore } from '@/store/useSceneStore'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import * as THREE from 'three'
import { resetTimeline } from '@/engine/timeline/liveTimeline'
import {
  CAMERA_TRANSFORM_DEFAULTS,
  cameraTransformFromQuaternion,
} from '@/engine/camera/cameraTransform'

/** The bridge between the stores and the project file.
 *
 *  Lives outside `engine/` deliberately: reading and writing every store is exactly what
 *  the engine boundary forbids, and pretending otherwise would mean the serialiser
 *  importing eight stores. `engine/project/` owns the *format* and knows nothing about
 *  where the values come from; this file owns the *wiring* and knows nothing about the
 *  encoding. */

export function collectProject(name: string): AuraProject {
  const camera = useCameraStore.getState()

  const stems: StemRef[] = useAudioStore.getState().tracks.map((track) => {
    const features = AudioFeatures.get(track.id)
    return {
      id: track.id,
      name: track.name,
      fileName: track.fileName,
      color: track.color,
      volume: track.volume,
      solo: track.solo,
      mute: track.mute,
      trimStart: track.trimBounds.start,
      trimEnd: track.trimBounds.end,
      // Cached so reopening does not re-analyse. Absent rather than empty when analysis
      // never finished, so a reload knows to run it rather than trusting a blank.
      features: features ? serialiseFeatures(features) : undefined,
      handleKey: track.handleKey,
    }
  })

  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    name,
    stems,
    objects: useSceneStore.getState().objects,
    post: {
      effects: usePostStore.getState().effects,
      bypassed: usePostStore.getState().bypassed,
    },
    environment: {
      params: useEnvironmentStore.getState().params,
      disabled: useEnvironmentStore.getState().disabled,
    },
    camera: {
      behaviours: camera.behaviours,
      lookAtId: camera.lookAtId,
      lookAtEnabled: camera.lookAtEnabled,
      // The AUTHORED transform, from the store rather than the engine. The engine holds it
      // too, but only as the value resolved for the last frame — which includes modulation,
      // so saving that would bake one frame of a wired camera move into the file and
      // reopening would apply it a second time.
      transform: { ...camera.transform },
    },
    modulation: {
      connections: useModulationStore.getState().connections,
      triggers: useModulationStore.getState().triggers,
    },
    generators: useGeneratorStore.getState().generators.map((g) => ({ ...g })),
    lanes: useAutomationStore.getState().lanes.map((l) => ({ ...l, points: [...l.points] })),
    timeline: (() => {
      const { project } = useProjectStore.getState()
      return {
        bpm: project.bpm,
        states: Object.values(project.statesLibrary),
        strips: [...project.timelineStrips],
        markers: [...project.markers],
      }
    })(),
  }
}

export interface ApplyResult {
  /** Stems the project expects but which have no audio yet. */
  missingStems: StemRef[]
}

/** The camera transform from a project file, whichever way that file stored it.
 *
 *  Files written before the transform became a parameter carried a position vector and a
 *  quaternion. Converting rather than discarding them means an older project reopens framed
 *  the way it was saved. */
function readCameraTransform(camera: AuraProject['camera']): Record<string, number> {
  if (camera.transform) return { ...CAMERA_TRANSFORM_DEFAULTS, ...camera.transform }

  const position = camera.scenePosition
  const quaternion = camera.sceneQuaternion
  return {
    ...CAMERA_TRANSFORM_DEFAULTS,
    ...(position
      ? { 'position.x': position[0], 'position.y': position[1], 'position.z': position[2] }
      : {}),
    ...(quaternion
      ? cameraTransformFromQuaternion(new THREE.Quaternion().fromArray(quaternion))
      : {}),
    ...(camera.sceneFov !== undefined ? { fov: camera.sceneFov } : {}),
  }
}

export function applyProject(project: AuraProject): ApplyResult {
  // Order matters. Modulation is cleared first so nothing evaluates against half-replaced
  // scene state, and restored last once every address it points at exists again.
  useModulationStore.getState().clear()
  ModulationMatrix.reset()
  // Undoing into a document that no longer exists is worse than having no undo.
  CommandHistory.clear()

  // Tear the previous session's audio down before anything replaces the track list.
  // Without this the old stems keep their node chains and carry on playing underneath
  // the project that just replaced them.
  const rack = MultiTrackRack.getInstance()
  for (const track of useAudioStore.getState().tracks) {
    RealtimeAnalyser.unregister(track.id)
    AudioFeatures.release(track.id)
  }
  rack.unregisterAll()

  useSceneStore.setState({ objects: project.objects, selectedId: null })
  usePostStore.setState({
    effects: project.post.effects,
    bypassed: project.post.bypassed,
    selectedId: null,
  })
  useEnvironmentStore.setState({
    params: project.environment.params,
    disabled: project.environment.disabled,
  })
  useGeneratorStore.setState({ generators: project.generators as never })
  useAutomationStore.setState({ lanes: project.lanes, selectedId: project.lanes[0]?.id ?? null })

  useCameraStore.setState({
    behaviours: project.camera.behaviours,
    lookAtId: project.camera.lookAtId,
    lookAtEnabled: project.camera.lookAtEnabled,
    transform: readCameraTransform(project.camera),
  })

  // `CameraRigDriver` resolves the transform onto the engine on the next frame. This covers
  // the gap until it does, so a freshly opened project is not framed by the previous one.
  DualCameraEngine.getInstance().holdScene()

  // Stems: metadata and cached analysis come back immediately, so wires and waveforms are
  // correct before any audio exists. The buffers arrive a moment later via
  // `restoreStemAudio`, which reopens each stem's remembered handle (D-56).
  for (const stem of project.stems) {
    if (stem.features) AudioFeatures.adopt(stem.id, deserialiseFeatures(stem.features))
  }

  useAudioStore.setState({
    tracks: project.stems.map((stem) => ({
      id: stem.id,
      name: stem.name,
      fileName: stem.fileName,
      color: stem.color,
      buffer: null,
      volume: stem.volume,
      solo: stem.solo,
      mute: stem.mute,
      trimBounds: { start: stem.trimStart, end: stem.trimEnd },
      analysis: null,
      handleKey: stem.handleKey,
    })),
  })

  useModulationStore.setState({
    connections: project.modulation.connections,
    triggers: project.modulation.triggers,
  })

  // Written straight rather than through the store's actions: those record undo steps, and
  // opening a document must not leave a history that undoes back into the previous one.
  const timeline = project.timeline
  useProjectStore.setState({
    project: {
      name: project.name,
      bpm: timeline?.bpm ?? null,
      statesLibrary: Object.fromEntries((timeline?.states ?? []).map((st) => [st.id, st])),
      timelineStrips: timeline?.strips ?? [],
      markers: timeline?.markers ?? [],
    },
  })
  // A cut resolved from the outgoing project must not gate the incoming one's objects; the
  // driver republishes on the next frame, and this covers the gap until it does.
  resetTimeline()

  rack.refreshDuration()

  // Every stem lands without audio here; `restoreStemAudio` fills them in immediately
  // afterwards from their persisted handles. Whatever it cannot recover is what the
  // Restore button is for.
  return { missingStems: project.stems }
}

/** Reopen every stem that remembers its own file.
 *
 *  This is what makes a saved project actually reopen: the handle stored on import
 *  survives in IndexedDB, so the audio comes back without the user finding the files
 *  again. Only the permission needs re-granting, and `interactive` decides whether we may
 *  ask — a load happens without a user gesture, so it silently recovers whatever is still
 *  granted, and the button asks for the rest in one click.
 *
 *  Returns the ids that came back. Anything left over falls to manual relink. */
export async function restoreStemAudio(interactive: boolean): Promise<string[]> {
  const tracks = useAudioStore.getState().tracks.filter((t) => !t.buffer && t.handleKey)
  if (tracks.length === 0) return []

  const rack = MultiTrackRack.getInstance()
  const restored: { id: string; buffer: AudioBuffer }[] = []

  for (const track of tracks) {
    try {
      const file = await platform().reopenAudioFile(track.handleKey!, interactive)
      if (!file) continue
      restored.push({ id: track.id, buffer: await rack.decodeFile(file) })
    } catch (error) {
      console.warn(`[project] Could not reopen ${track.fileName}`, error)
    }
  }

  if (restored.length === 0) return []

  for (const { id, buffer } of restored) rack.registerTrack(id, buffer)
  useAudioStore.setState({
    tracks: useAudioStore.getState().tracks.map((t) => {
      const match = restored.find((r) => r.id === t.id)
      return match ? { ...t, buffer: match.buffer } : t
    }),
  })
  rack.refreshDuration()

  return restored.map((r) => r.id)
}

/** Attach a decoded buffer to a stem the project already knows about.
 *
 *  Matched by filename, because the id in the file is meaningless to the OS and the user
 *  is re-picking the same stems they exported. Returns the ids that matched. */
export function relinkStems(files: { file: File; buffer: AudioBuffer }[]): string[] {
  const tracks = useAudioStore.getState().tracks
  const rack = MultiTrackRack.getInstance()
  const matched: string[] = []

  for (const { file, buffer } of files) {
    const track =
      tracks.find((t) => t.fileName === file.name) ??
      tracks.find((t) => t.buffer === null && t.name === file.name.replace(/\.[^.]+$/, ''))
    if (!track) continue

    rack.registerTrack(track.id, buffer)
    matched.push(track.id)
  }

  if (matched.length > 0) {
    useAudioStore.setState({
      tracks: useAudioStore.getState().tracks.map((t) =>
        matched.includes(t.id)
          ? { ...t, buffer: files.find((f) => f.file.name === t.fileName)?.buffer ?? t.buffer }
          : t,
      ),
    })
    rack.refreshDuration()
  }

  return matched
}

export async function saveProjectToDisk(name: string): Promise<boolean> {
  return platform().saveProject(projectFileName(name), encodeProject(collectProject(name)))
}

export async function openProjectFromDisk(): Promise<{
  ok: boolean
  message: string | null
  restored?: number
}> {
  const picked = await platform().openProject()
  if (!picked) return { ok: false, message: null }

  const { project, message } = decodeProject(picked.bytes)
  if (!project) return { ok: false, message }

  applyProject(project)

  // Silent pass: stems whose permission survived come back with no interaction at all.
  // The rest are reported so the caller can offer one click for the whole set.
  const restored = await restoreStemAudio(false)
  return { ok: true, message: null, restored: restored.length }
}
