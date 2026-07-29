/** Where the single persistent 3D viewport should currently be drawn.
 *
 *  Pages do not mount a Canvas (docs/03-ARCHITECTURE.md HC-9). They mount a `ViewportSlot`
 *  — an empty div that registers itself here — and the one long-lived Canvas positions
 *  itself over whichever slot is active.
 *
 *  This is also how the Routing page gets a live scene monitor: it declares a small,
 *  non-interactive slot and the same renderer moves there. A "second viewport" costs
 *  nothing, because there is never a second renderer.
 *
 *  A plain module rather than a store: this changes on page switch and panel resize, not
 *  at frame rate, and nothing should re-render because of it except the viewport itself. */

export interface ViewportSlotOptions {
  /** Hide the HUD — too dense to read at monitor size. */
  compact?: boolean
  /** Whether camera controls and object picking respond. False for a monitor. */
  interactive?: boolean
}

const DEFAULT_OPTIONS: Required<ViewportSlotOptions> = {
  compact: false,
  interactive: true,
}

let element: HTMLElement | null = null
let options: Required<ViewportSlotOptions> = DEFAULT_OPTIONS
const listeners = new Set<() => void>()

export function setViewportSlot(
  nextElement: HTMLElement | null,
  nextOptions?: ViewportSlotOptions,
): void {
  const resolved: Required<ViewportSlotOptions> = { ...DEFAULT_OPTIONS, ...nextOptions }
  if (
    element === nextElement &&
    options.compact === resolved.compact &&
    options.interactive === resolved.interactive
  ) {
    return
  }

  element = nextElement
  options = resolved
  for (const listener of listeners) listener()
}

export function getViewportSlot(): HTMLElement | null {
  return element
}

export function getViewportSlotOptions(): Required<ViewportSlotOptions> {
  return options
}

export function subscribeViewportSlot(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
