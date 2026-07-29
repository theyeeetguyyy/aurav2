import type { FieldRef } from '@/types/params'

/** In-flight drag from a source dot to a target row.
 *
 *  Kept outside React: the cursor wire redraws at pointer rate, and re-rendering the
 *  whole patchbay on every mousemove is exactly the kind of thing HC-1 exists to
 *  prevent. The wire layer reads this imperatively; only the coarse "is a drag active"
 *  flag reaches React, so targets can highlight. */

export interface DragState {
  field: FieldRef
  sourceAnchorId: string
  /** Live cursor position, in container-local coordinates. */
  x: number
  y: number
  /** Target address currently hovered, for highlight and drop. */
  hoverTargetId: string | null
}

let state: DragState | null = null
const listeners = new Set<(active: boolean) => void>()

export function getDrag(): DragState | null {
  return state
}

export function beginDrag(field: FieldRef, sourceAnchorId: string, x: number, y: number): void {
  state = { field, sourceAnchorId, x, y, hoverTargetId: null }
  emit(true)
}

/** Update cursor position. Deliberately does NOT notify React. */
export function moveDrag(x: number, y: number, hoverTargetId: string | null): void {
  if (!state) return
  state.x = x
  state.y = y
  state.hoverTargetId = hoverTargetId
}

export function endDrag(): DragState | null {
  const finished = state
  state = null
  if (finished) emit(false)
  return finished
}

export function subscribeDrag(listener: (active: boolean) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(active: boolean): void {
  for (const listener of listeners) listener(active)
}
