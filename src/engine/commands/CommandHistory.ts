/** Undo/redo (docs/03-ARCHITECTURE.md, docs/04-ENGINE-SPECS.md §4.7).
 *
 *  Locked as the **command pattern**, explicitly not `zundo`: snapshotting whole stores
 *  would capture `AudioBuffer`s and GPU handles, which is a memory disaster.
 *
 *  What is stored here is a `{label, undo, redo}` triple of *closures*. The history has
 *  no idea what a scene object is, what a store is, or what changed — it only knows how
 *  to call two functions in the right order. Everything that knows about state lives in
 *  the bridge above it, which is what keeps this file testable without a single store.
 *
 *  **Coalescing is the feature that makes it usable.** Dragging a slider emits a change
 *  per pixel; without collapsing them, one drag would cost two hundred presses of Ctrl+Z
 *  to undo. Entries sharing a `coalesceKey` inside a short window merge into the one that
 *  is already on the stack. */

export interface Command {
  label: string
  undo(): void
  redo(): void
  /** Entries sharing a key inside COALESCE_WINDOW_MS merge. Absent means never merge. */
  coalesceKey?: string
}

/** Long enough to span a slider drag's stop-start jitter, short enough that two
 *  deliberate edits a second apart stay separate. */
const COALESCE_WINDOW_MS = 600

/** Bounded so a long session cannot grow without limit. Fifty is far past what anyone
 *  reaches for and still trivially small. */
const CAPACITY = 50

interface Entry extends Command {
  at: number
}

type Listener = () => void

class CommandHistoryImpl {
  private undoStack: Entry[] = []
  private redoStack: Entry[] = []
  private readonly listeners = new Set<Listener>()
  /** Guards against an undo's own state writes recording themselves as new commands. */
  private applying = false

  /** Record an already-performed change.
   *
   *  Callers mutate first and record after, because the natural way to capture "before"
   *  is to read state at the top of the action and close over it. */
  push(command: Command): void {
    if (this.applying) return

    const now = Date.now()
    const last = this.undoStack[this.undoStack.length - 1]

    if (
      command.coalesceKey &&
      last?.coalesceKey === command.coalesceKey &&
      now - last.at < COALESCE_WINDOW_MS
    ) {
      // Keep the OLDEST undo — that is the state before the drag began — and take the
      // NEWEST redo, which is where the drag ended.
      last.redo = command.redo
      last.at = now
      this.redoStack = []
      this.emit()
      return
    }

    this.undoStack.push({ ...command, at: now })
    if (this.undoStack.length > CAPACITY) this.undoStack.shift()
    // Any new action invalidates the redo branch — the standard model, and the only one
    // that does not require presenting the user with a tree.
    this.redoStack = []
    this.emit()
  }

  undo(): boolean {
    const entry = this.undoStack.pop()
    if (!entry) return false

    this.applying = true
    try {
      entry.undo()
    } finally {
      this.applying = false
    }

    this.redoStack.push(entry)
    this.emit()
    return true
  }

  redo(): boolean {
    const entry = this.redoStack.pop()
    if (!entry) return false

    this.applying = true
    try {
      entry.redo()
    } finally {
      this.applying = false
    }

    this.undoStack.push(entry)
    this.emit()
    return true
  }

  /** True while an undo or redo is being applied. State writers check this so restoring
   *  a snapshot does not record itself as a fresh command. */
  get isApplying(): boolean {
    return this.applying
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Label of the next undo, for the button's tooltip. */
  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null
  }

  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null
  }

  /** Drop everything. Loading a project must not leave the previous one's history
   *  behind — undoing into a document that no longer exists is worse than no undo. */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.emit()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export const CommandHistory = new CommandHistoryImpl()
