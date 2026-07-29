import type { FieldRef, ParamAddress } from '@/types/params'
import { formatAddress } from '@/types/params'

/** DOM anchor registry for the wire layer.
 *
 *  Wires are drawn between real DOM elements — a source dot and a target row — so the
 *  columns stay ordinary scrollable lists and the SVG never has to own layout. Elements
 *  register themselves here on mount; the wire layer measures them on demand.
 *
 *  A plain module rather than context: this is read during measurement, not during
 *  render, and nothing should re-render because an anchor moved. */

const anchors = new Map<string, HTMLElement>()
const listeners = new Set<() => void>()

/** Stable id for a source dot. Two connections from the same metric share an anchor. */
export function sourceAnchorId(field: FieldRef): string {
  return `src:${field.kind}:${field.key}:${field.sourceId ?? ''}`
}

/** Stable id for a target row — the serialised parameter address. */
export function targetAnchorId(address: ParamAddress): string {
  return `tgt:${formatAddress(address)}`
}

export function registerAnchor(id: string, element: HTMLElement | null): void {
  if (element) anchors.set(id, element)
  else anchors.delete(id)
  notify()
}

export function getAnchor(id: string): HTMLElement | null {
  return anchors.get(id) ?? null
}

/** Anchor centre in container-local coordinates, or null if not mounted.
 *
 *  `edge` picks which side the wire leaves from, so lines emerge from the correct face
 *  of each column instead of the element's centre. */
export function measureAnchor(
  id: string,
  container: DOMRect,
  edge: 'right' | 'left',
): { x: number; y: number } | null {
  const element = anchors.get(id)
  if (!element) return null

  const box = element.getBoundingClientRect()
  // Zero-size means the row is collapsed or detached — treat it as absent so the wire
  // hides rather than snapping to the origin.
  if (box.width === 0 && box.height === 0) return null

  return {
    x: (edge === 'right' ? box.right : box.left) - container.left,
    y: box.top + box.height / 2 - container.top,
  }
}

/** Force a re-measure without any anchor changing.
 *
 *  Resizing a column moves every endpoint but changes neither the container's size nor
 *  the set of registered anchors, so no observer fires. This is the nudge. */
export function refreshAnchors(): void {
  notify()
}

/** Subscribe to anchor mount/unmount so the wire layer can re-measure. */
export function subscribeAnchors(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let scheduled = false
function notify(): void {
  // Anchors register in a burst during mount. Coalesce into one notification so the
  // wire layer measures once per frame rather than once per row.
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    for (const listener of listeners) listener()
  })
}
