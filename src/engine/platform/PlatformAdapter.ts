/** PlatformAdapter — every host-specific capability behind one interface
 *  (docs/03-ARCHITECTURE.md §1).
 *
 *  The rule this exists to enforce: **nothing outside `engine/platform/` may touch
 *  `File`, `showOpenFilePicker`, a download anchor, or a Tauri API.** Features degrade by
 *  querying a capability flag, never by sniffing the environment — `if (isTauri)` scattered
 *  through the codebase is exactly the shape that makes a second host impossible later.
 *
 *  The browser adapter ships today; a Tauri adapter can land without touching engine code,
 *  which keeps distribution a business decision rather than an architectural one. */

export interface PickedFile {
  name: string
  bytes: ArrayBuffer
}

/** A picked audio file, plus an opaque key for reopening it in a later session.
 *
 *  The key is absent when the host cannot persist handles (Safari, Firefox, private
 *  browsing). Callers must treat it as an optimisation, never as a guarantee. */
export interface PickedAudio {
  file: File
  handleKey?: string
}

export interface PlatformAdapter {
  readonly id: 'web' | 'tauri'

  /** Read a project the user chooses. Null when they cancel. */
  openProject(): Promise<PickedFile | null>
  /** Write project bytes. `suggestedName` includes the extension. */
  saveProject(suggestedName: string, bytes: Uint8Array): Promise<boolean>
  /** Write finished video bytes. */
  writeVideo(suggestedName: string, bytes: Uint8Array): Promise<boolean>
  /** Let the user pick audio files. Empty when they cancel. */
  pickAudioFiles(): Promise<PickedAudio[]>

  /** Reopen a previously picked file.
   *
   *  `interactive` decides whether permission may be requested, which needs a user
   *  gesture — so an automatic restore passes false and a button passes true. */
  reopenAudioFile(handleKey: string, interactive: boolean): Promise<File | null>

  /** Forget a remembered file. Called when a stem is deleted, so handles do not
   *  accumulate in storage for files no project references any more. */
  forgetAudioFile(handleKey: string): Promise<void>

  /** Can stems be reopened without the user re-picking them?
   *
   *  True where file handles persist (Chromium via IndexedDB) — the handle survives even
   *  if the file is renamed or moved, which a path would not. False elsewhere, and the UI
   *  falls back to manual relink rather than pretending. */
  readonly canRelinkByPath: boolean
  /** Can a long render queue survive backgrounding? False in a tab — it gets throttled. */
  readonly supportsBatchQueue: boolean
}

let current: PlatformAdapter | null = null

export function setPlatform(adapter: PlatformAdapter): void {
  current = adapter
}

export function platform(): PlatformAdapter {
  if (!current) throw new Error('[platform] No adapter installed — call setPlatform() first')
  return current
}
