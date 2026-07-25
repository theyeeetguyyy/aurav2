export type ActionID =
  | 'play-pause'
  | 'toggle-library'
  | 'toggle-params'
  | 'toggle-graph'
  | 'toggle-fullscreen'
  | 'toggle-record'
  | 'add-marker'
  | 'toggle-immersive'
  | 'toggle-solo'
  | 'toggle-mute'

export interface ShortcutBinding {
  actionId: ActionID
  label: string
  category: 'Playback' | 'Navigation' | 'Timeline' | 'Track'
  defaultKey: string
  currentKey: string
}

export type ShortcutHandler = () => void

export class ShortcutManager {
  private static instance: ShortcutManager

  private bindings: Map<ActionID, ShortcutBinding> = new Map()
  private handlers: Map<ActionID, ShortcutHandler[]> = new Map()

  // Bound handler for clean add/remove
  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    // Ignore input inside text inputs, textareas, or contenteditable
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }

    const code = e.code

    for (const [actionId, binding] of this.bindings.entries()) {
      if (binding.currentKey === code) {
        e.preventDefault()
        const actionHandlers = this.handlers.get(actionId) ?? []
        for (const handler of actionHandlers) {
          handler()
        }
        break
      }
    }
  }

  private constructor() {
    this.registerDefaultBindings()
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown)
    }
  }

  public static getInstance(): ShortcutManager {
    if (!ShortcutManager.instance) {
      ShortcutManager.instance = new ShortcutManager()
    }
    return ShortcutManager.instance
  }

  /** Clean up event listeners (call on app teardown) */
  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown)
    }
  }

  private registerDefaultBindings(): void {
    const defaults: ShortcutBinding[] = [
      { actionId: 'play-pause', label: 'Play / Pause', category: 'Playback', defaultKey: 'Space', currentKey: 'Space' },
      { actionId: 'toggle-library', label: 'Toggle Shape Library', category: 'Navigation', defaultKey: 'Tab', currentKey: 'Tab' },
      { actionId: 'toggle-params', label: 'Toggle Inspector Params', category: 'Navigation', defaultKey: 'KeyP', currentKey: 'KeyP' },
      { actionId: 'toggle-graph', label: 'Toggle Routing Graph', category: 'Navigation', defaultKey: 'KeyN', currentKey: 'KeyN' },
      { actionId: 'toggle-fullscreen', label: 'Toggle Fullscreen', category: 'Navigation', defaultKey: 'KeyG', currentKey: 'KeyG' },
      { actionId: 'toggle-record', label: 'Toggle Record', category: 'Playback', defaultKey: 'KeyR', currentKey: 'KeyR' },
      { actionId: 'add-marker', label: 'Add Section Marker', category: 'Timeline', defaultKey: 'KeyM', currentKey: 'KeyM' },
      { actionId: 'toggle-immersive', label: 'Toggle Immersive View', category: 'Navigation', defaultKey: 'KeyH', currentKey: 'KeyH' },
    ]

    for (const b of defaults) {
      this.bindings.set(b.actionId, b)
    }
  }

  public subscribe(actionId: ActionID, handler: ShortcutHandler): () => void {
    if (!this.handlers.has(actionId)) {
      this.handlers.set(actionId, [])
    }
    this.handlers.get(actionId)!.push(handler)

    return () => {
      const list = this.handlers.get(actionId) ?? []
      this.handlers.set(
        actionId,
        list.filter((h) => h !== handler)
      )
    }
  }

  public getBindings(): ShortcutBinding[] {
    return Array.from(this.bindings.values())
  }

  public rebind(actionId: ActionID, newKey: string): boolean {
    const binding = this.bindings.get(actionId)
    if (!binding) return false

    // Check conflict
    for (const [id, b] of this.bindings.entries()) {
      if (id !== actionId && b.currentKey === newKey) {
        return false // Conflict
      }
    }

    binding.currentKey = newKey
    return true
  }
}
