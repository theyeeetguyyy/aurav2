import { EVERYTHING, type ResolvedTimeline } from './StateResolver'

/** The resolved timeline for the frame being drawn.
 *
 *  Module state rather than a store, deliberately: this is republished every frame and the
 *  render path reads it imperatively (HC-1). Routing it through Zustand would re-render
 *  every subscriber sixty times a second, which is the exact failure HC-1 exists to prevent.
 *
 *  `TimelineDriver` is the only writer, and it is mounted ahead of every reader.
 *
 *  Most readers call `isObjectLive` inside their own `useFrame` and never re-render.
 *  Post-processing cannot: an effect is either compiled into a fullscreen pass or absent
 *  from it, so switching one off means rebuilding the chain. `subscribeToCuts` exists for
 *  that — it fires when the live set of strips changes, a handful of times per song rather
 *  than sixty times per second. */

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

/** Whether something is on right now, given what the user authored in the editor.
 *
 *  Each of these takes the authored flag rather than being consulted alongside it, because
 *  the timeline and the editor's own toggles are **the same channel** — capturing a state
 *  reads exactly those toggles. Consulted separately they fight: a state that includes an
 *  object the user has since hidden could never switch it back on, because both answers
 *  would have to be true.
 *
 *  So exactly one authority applies at a time. Unsequenced, the editor's toggle wins,
 *  which is what makes the eye icon work. Under a live strip the timeline wins outright. */
export function isVisible(objectId: string, authored: boolean): boolean {
  const live = current.visibleObjectIds
  return live === null ? authored : live.has(objectId)
}

export function isConnectionActive(connectionId: string, authored: boolean): boolean {
  const live = current.activeConnectionIds
  return live === null ? authored : live.has(connectionId)
}

export function isPostActive(effectId: string, authored: boolean): boolean {
  const live = current.activePostIds
  return live === null ? authored : live.has(effectId)
}

export function subscribeToCuts(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentCut(): string {
  return cut
}

/** Drop back to "show everything". Called when a project is replaced, so a stale cut from
 *  the previous project cannot gate the new one's objects. */
export function resetTimeline(): void {
  current = EVERYTHING
  publishTimeline(EVERYTHING)
}
