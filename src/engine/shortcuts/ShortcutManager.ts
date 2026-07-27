/** ShortcutManager — the single action registry for keyboard input.
 *
 *  Bindings are modifier-aware **chords**, not bare key codes. The previous
 *  implementation compared `e.code` alone, so `Ctrl+S` fired the action bound to
 *  plain `S` — every modifier combination collided with its unmodified key.
 *
 *  Per docs/05-DESIGN-SYSTEM.md §5.2, every command-palette entry must resolve to an
 *  ActionID registered here, so the palette and the shortcut list can never drift. */

export type ActionID =
  | 'play-pause'
  | 'toggle-library'
  | 'toggle-params'
  | 'toggle-graph'
  | 'toggle-fullscreen'
  | 'toggle-record'
  | 'add-marker'
  | 'toggle-immersive'
  | 'toggle-loop'
  | 'undo'
  | 'redo'

export type ShortcutCategory = 'Playback' | 'Navigation' | 'Timeline' | 'Edit'

export interface ShortcutBinding {
  actionId: ActionID
  label: string
  category: ShortcutCategory
  /** Normalised chord, e.g. "Space", "KeyM", "Ctrl+KeyZ", "Ctrl+Shift+KeyZ". */
  defaultChord: string
  currentChord: string
}

export type ShortcutHandler = () => void

const STORAGE_KEY = 'aura.shortcuts.v1'

/** Modifier keys never form a chord on their own. */
const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight',
  'ShiftLeft', 'ShiftRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
])

/** Build the normalised chord string for an event. Order is fixed so it round-trips. */
export function chordFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')
  parts.push(e.code)
  return parts.join('+')
}

/** Human-readable chord for display: "Ctrl+KeyZ" → "Ctrl + Z". */
export function formatChord(chord: string): string {
  return chord
    .split('+')
    .map((part) => part.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, ''))
    .join(' + ')
}

const DEFAULT_BINDINGS: ShortcutBinding[] = [
  { actionId: 'play-pause',       label: 'Play / Pause',           category: 'Playback',   defaultChord: 'Space',        currentChord: 'Space' },
  { actionId: 'toggle-loop',      label: 'Toggle Loop',            category: 'Playback',   defaultChord: 'KeyL',         currentChord: 'KeyL' },
  { actionId: 'toggle-record',    label: 'Toggle Record',          category: 'Playback',   defaultChord: 'KeyR',         currentChord: 'KeyR' },
  { actionId: 'toggle-library',   label: 'Toggle Library',         category: 'Navigation', defaultChord: 'Tab',          currentChord: 'Tab' },
  { actionId: 'toggle-params',    label: 'Toggle Inspector',       category: 'Navigation', defaultChord: 'KeyP',         currentChord: 'KeyP' },
  { actionId: 'toggle-graph',     label: 'Toggle Routing Graph',   category: 'Navigation', defaultChord: 'KeyN',         currentChord: 'KeyN' },
  { actionId: 'toggle-fullscreen',label: 'Toggle Fullscreen',      category: 'Navigation', defaultChord: 'KeyG',         currentChord: 'KeyG' },
  { actionId: 'toggle-immersive', label: 'Toggle Immersive View',  category: 'Navigation', defaultChord: 'KeyH',         currentChord: 'KeyH' },
  { actionId: 'add-marker',       label: 'Add Section Marker',     category: 'Timeline',   defaultChord: 'KeyM',         currentChord: 'KeyM' },
  { actionId: 'undo',             label: 'Undo',                   category: 'Edit',       defaultChord: 'Ctrl+KeyZ',    currentChord: 'Ctrl+KeyZ' },
  { actionId: 'redo',             label: 'Redo',                   category: 'Edit',       defaultChord: 'Ctrl+KeyY',    currentChord: 'Ctrl+KeyY' },
]

export class ShortcutManager {
  private static instance: ShortcutManager

  private readonly bindings = new Map<ActionID, ShortcutBinding>()
  private readonly handlers = new Map<ActionID, ShortcutHandler[]>()
  private readonly changeListeners = new Set<() => void>()

  private constructor() {
    for (const b of DEFAULT_BINDINGS) this.bindings.set(b.actionId, { ...b })
    this.loadOverrides()
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown)
    }
  }

  public static getInstance(): ShortcutManager {
    if (!ShortcutManager.instance) ShortcutManager.instance = new ShortcutManager()
    return ShortcutManager.instance
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown)
    }
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null

    // Never steal input from a text field.
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return
    }

    const chord = chordFromEvent(e)
    if (!chord) return

    // Tab is the focus-traversal key. Swallowing it globally breaks keyboard
    // accessibility, so it only triggers its action when focus is NOT on a
    // focusable control — i.e. when the user is looking at the viewport, not
    // navigating the UI.
    if (chord === 'Tab' && target?.closest('button, a, [tabindex]:not([tabindex="-1"])')) {
      return
    }

    for (const [actionId, binding] of this.bindings) {
      if (binding.currentChord !== chord) continue
      const handlers = this.handlers.get(actionId)
      if (!handlers || handlers.length === 0) return // Bound but unhandled — let it through.
      e.preventDefault()
      for (const handler of handlers) handler()
      return
    }
  }

  public subscribe(actionId: ActionID, handler: ShortcutHandler): () => void {
    const list = this.handlers.get(actionId) ?? []
    list.push(handler)
    this.handlers.set(actionId, list)

    return () => {
      const current = this.handlers.get(actionId) ?? []
      this.handlers.set(
        actionId,
        current.filter((h) => h !== handler),
      )
    }
  }

  /** Subscribe to binding changes so UI re-renders after a rebind. */
  public onChange(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  public getBindings(): ShortcutBinding[] {
    return [...this.bindings.values()].map((b) => ({ ...b }))
  }

  /** Which action currently owns a chord, if any. */
  public findConflict(chord: string, excluding?: ActionID): ShortcutBinding | null {
    for (const [id, b] of this.bindings) {
      if (id !== excluding && b.currentChord === chord) return { ...b }
    }
    return null
  }

  /** Rebind an action. Returns the conflicting binding on failure, null on success. */
  public rebind(actionId: ActionID, chord: string): ShortcutBinding | null {
    const binding = this.bindings.get(actionId)
    if (!binding) return null

    const conflict = this.findConflict(chord, actionId)
    if (conflict) return conflict

    binding.currentChord = chord
    this.persist()
    this.emitChange()
    return null
  }

  public resetToDefaults(): void {
    for (const b of this.bindings.values()) b.currentChord = b.defaultChord
    this.persist()
    this.emitChange()
  }

  private emitChange(): void {
    for (const listener of this.changeListeners) listener()
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return
    const overrides: Record<string, string> = {}
    for (const [id, b] of this.bindings) {
      if (b.currentChord !== b.defaultChord) overrides[id] = b.currentChord
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
    } catch {
      // Storage unavailable (private mode, quota) — bindings stay session-only.
    }
  }

  private loadOverrides(): void {
    if (typeof localStorage === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const overrides = JSON.parse(raw) as Record<string, string>
      for (const [id, chord] of Object.entries(overrides)) {
        const binding = this.bindings.get(id as ActionID)
        if (binding && typeof chord === 'string') binding.currentChord = chord
      }
    } catch {
      // Corrupt or unreadable — fall back to defaults.
    }
  }
}
