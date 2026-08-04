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

/** The bridge between the stores and the project file.
 *
 *  Lives outside `engine/` deliberately: reading and writing every store is exactly what
 *  the engine boundary forbids, and pretending otherwise would mean the serialiser
 *  importing eight stores. `engine/project/` owns the *format* and knows nothing about
 *  where the values come from; this file owns the *wiring* and knows nothing about the
 *  encoding. */

export function collectProject(name: string): AuraProject {
  const engine = DualCameraEngine.getInstance()
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
      // The AUTHORED transform. Saving the resolved one would bake a frame of orbit and
      // shake into the file, and reopening would then apply them a second time.
      scenePosition: engine.baseScenePosition.toArray() as [number, number, number],
      sceneQuaternion: engine.baseSceneQuaternion.toArray() as [number, number, number, number],
      sceneFov: engine.baseSceneFov,
    },
    modulation: {
      connections: useModulationStore.getState().connections,
      triggers: useModulationStore.getState().triggers,
    },
    generators: useGeneratorStore.getState().generators.map((g) => ({ ...g })),
    lanes: useAutomationStore.getState().lanes.map((l) => ({ ...l, points: [...l.points] })),
  }
}

export interface ApplyResult {
  /** Stems the project expects but which have no audio yet. */
  missingStems: StemRef[]
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
  })

  const engine = DualCameraEngine.getInstance()
  engine.baseScenePosition.fromArray(project.camera.scenePosition)
  engine.baseSceneQuaternion.fromArray(project.camera.sceneQuaternion)
  engine.baseSceneFov = project.camera.sceneFov
  engine.holdScene()

  // Stems: metadata and cached analysis come back immediately, so wires and waveforms are
  // correct before any audio exists. The buffers are relinked separately (see below),
  // because a browser cannot reopen a file it was given last session.
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

  useProjectStore.setState((s) => ({ project: { ...s.project, name: project.name } }))

  rack.refreshDuration()

  // Every stem lands without audio: a browser cannot reopen a file it was handed last
  // session (`canRelinkByPath` is false). The caller prompts for them.
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
