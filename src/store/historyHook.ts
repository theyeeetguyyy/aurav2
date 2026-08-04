/** The seam stores use to record an undoable change.
 *
 *  Holds a callback and nothing else. Stores import this; the history bridge — which
 *  imports every store — installs the recorder into it. Without the indirection the
 *  bridge and the stores would import each other and the module graph would cycle.
 *
 *  A store calls `recordChange()` **before** mutating, because the natural thing to
 *  capture is the state that is about to be replaced. */

/** Which parts of the project an action touches. Snapshotting only these keeps an undo
 *  entry proportional to the edit rather than to the whole document. */
export type HistorySlice =
  | 'scene'
  | 'post'
  | 'environment'
  | 'camera'
  | 'modulation'
  | 'generators'
  | 'lanes'

type Recorder = (label: string, slices: HistorySlice[], coalesceKey?: string) => void

let recorder: Recorder | null = null

export function installHistoryRecorder(next: Recorder | null): void {
  recorder = next
}

export function recordChange(
  label: string,
  slices: HistorySlice[],
  coalesceKey?: string,
): void {
  recorder?.(label, slices, coalesceKey)
}
