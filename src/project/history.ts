import { CommandHistory } from '@/engine/commands/CommandHistory'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'
import { installHistoryRecorder, type HistorySlice } from '@/store/historyHook'
import { useAutomationStore } from '@/store/useAutomationStore'
import { useCameraStore } from '@/store/useCameraStore'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
import { useGeneratorStore } from '@/store/useGeneratorStore'
import { useModulationStore } from '@/store/useModulationStore'
import { usePostStore } from '@/store/usePostStore'
import { useSceneStore } from '@/store/useSceneStore'

/** Wires the command history to the stores.
 *
 *  The engine's `CommandHistory` knows only how to call two closures. This file knows how
 *  to read and write state, and it lives outside `engine/` because reading seven stores
 *  is exactly what the engine boundary forbids.
 *
 *  **What is captured is a slice snapshot, not a store snapshot.** The decision that
 *  rejected `zundo` rejected it for capturing `AudioBuffer`s and GPU handles — and none
 *  of the slices below contain either. Stems, decoded audio and feature timelines are
 *  deliberately absent: an undo should not be able to unload your audio, and capturing a
 *  megabyte of analysis per keystroke is the memory problem that decision was about.
 *
 *  Only the slices an action declares are captured, so adding an object does not
 *  snapshot the automation lanes. */

type Snapshot = Partial<Record<HistorySlice, unknown>>

function capture(slices: HistorySlice[]): Snapshot {
  const snapshot: Snapshot = {}

  for (const slice of slices) {
    switch (slice) {
      case 'scene':
        snapshot.scene = useSceneStore.getState().objects
        break
      case 'post': {
        const post = usePostStore.getState()
        snapshot.post = { effects: post.effects, bypassed: post.bypassed }
        break
      }
      case 'environment': {
        const env = useEnvironmentStore.getState()
        snapshot.environment = { params: env.params, disabled: env.disabled }
        break
      }
      case 'camera': {
        const camera = useCameraStore.getState()
        snapshot.camera = {
          behaviours: camera.behaviours,
          lookAtId: camera.lookAtId,
          lookAtEnabled: camera.lookAtEnabled,
        }
        break
      }
      case 'modulation': {
        const modulation = useModulationStore.getState()
        snapshot.modulation = {
          connections: modulation.connections,
          triggers: modulation.triggers,
        }
        break
      }
      case 'generators':
        snapshot.generators = useGeneratorStore.getState().generators
        break
      case 'lanes':
        snapshot.lanes = useAutomationStore.getState().lanes
        break
    }
  }

  // Every store here is immutable-update style, so holding the array reference IS the
  // snapshot — no clone needed, and nothing can mutate it out from under us.
  return snapshot
}

function restore(snapshot: Snapshot): void {
  if (snapshot.scene) {
    useSceneStore.setState({ objects: snapshot.scene as never, selectedId: null })
  }
  if (snapshot.post) {
    const post = snapshot.post as { effects: unknown; bypassed: boolean }
    usePostStore.setState({
      effects: post.effects as never,
      bypassed: post.bypassed,
      selectedId: null,
    })
  }
  if (snapshot.environment) {
    const env = snapshot.environment as { params: unknown; disabled: unknown }
    useEnvironmentStore.setState({
      params: env.params as never,
      disabled: env.disabled as never,
    })
  }
  if (snapshot.camera) {
    useCameraStore.setState(snapshot.camera as never)
  }
  if (snapshot.modulation) {
    const modulation = snapshot.modulation as { connections: unknown; triggers: unknown }
    useModulationStore.setState({
      connections: modulation.connections as never,
      triggers: modulation.triggers as never,
    })
    // Followers carry envelope memory keyed by connection id. Restoring a different set
    // of connections without dropping them leaves a resurrected wire mid-envelope, so
    // the first frame after an undo would be wrong.
    ModulationMatrix.reset()
  }
  if (snapshot.generators) {
    useGeneratorStore.setState({ generators: snapshot.generators as never })
  }
  if (snapshot.lanes) {
    useAutomationStore.setState({ lanes: snapshot.lanes as never })
  }
}

/** Start recording. Called once at startup. */
export function initHistory(): void {
  installHistoryRecorder((label, slices, coalesceKey) => {
    // `before` is read at call time — stores record *ahead* of mutating, so this is the
    // state about to be replaced. `after` is read lazily on the first undo, which is the
    // only moment it is known and costs nothing until then.
    const before = capture(slices)
    let after: Snapshot | null = null

    CommandHistory.push({
      label,
      coalesceKey,
      undo() {
        after ??= capture(slices)
        restore(before)
      },
      redo() {
        if (after) restore(after)
      },
    })
  })
}

export function undo(): boolean {
  return CommandHistory.undo()
}

export function redo(): boolean {
  return CommandHistory.redo()
}
