import { EVERYTHING, type ResolvedTimeline } from './StateResolver'

/** The resolved timeline for the frame being drawn.
 *
 *  Module state rather than a store: this is republished every frame and the render path reads it
 *  imperatively (HC-1). Routing it through Zustand would re-render every subscriber sixty times a
 *  second, which is the exact failure HC-1 exists to prevent.
 *
 *  `TimelineDriver` is the only writer, and it is mounted ahead of every reader.
 *
 *  *`isVisible`, `isConnectionActive` and `isPostActive` used to live here.* They existed because a
 *  state was a selection over a shared object pool, so every frame had to ask whether each object
 *  was in the live set. A state owns its scene now, so the answer is "render the loaded scene" and
 *  the questions do not arise. */

let current: ResolvedTimeline = EVERYTHING

/** Identifies which strips are live. Changes only at a cut. */
let cut = ''
const listeners = new Set<() => void>()

export function resolvedTimeline(): ResolvedTimeline {
  return current
}

/** Publish a newly resolved frame, notifying cut listeners if the live strips changed. */
export function publishTimeline(resolved: ResolvedTimeline): void {
  current = resolved

  const next = resolved.activeStripIds.join(',')
  if (next === cut) return
  cut = next
  for (const listener of listeners) listener()
}

export function subscribeToCuts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentCut(): string {
  return cut
}

/** Drop back to "render what is loaded". Called when a project is replaced, so a stale cut from
 *  the previous project cannot gate the new one. */
export function resetTimeline(): void {
  current = EVERYTHING
  publishTimeline(EVERYTHING)
}
