import { useEffect, useState } from 'react'
import { ModulationMatrix } from '@/engine/modulation/ModulationMatrix'

/** Display-rate polling of live modulation values.
 *
 *  Modulation is applied imperatively straight onto Three.js objects and never enters
 *  React (HC-1) — which is why playback stays smooth, but also why the inspector would
 *  otherwise show only base values while the shape visibly moves.
 *
 *  ONE shared ticker drives every subscriber. The first version created a `setInterval`
 *  per field; an inspector with a deformer stack open has thirty-odd numeric fields, so
 *  that was thirty timers all waking independently. Now it is one timer regardless of how
 *  many fields are on screen.
 *
 *  15 Hz: fast enough to read as live, slow enough to be free. Deliberately NOT driven
 *  from useFrame — that would put a 60 Hz value back into React state, the exact thing
 *  the architecture forbids. */

const POLL_HZ = 15

type Subscriber = (offset: number) => void

const subscribers = new Map<string, Set<Subscriber>>()
const lastValues = new Map<string, number>()
let timer: number | null = null

function tick(): void {
  for (const [addressKey, listeners] of subscribers) {
    const next = ModulationMatrix.getOffset(addressKey)
    const previous = lastValues.get(addressKey) ?? 0
    // Only notify on a visible change — an idle patch costs nothing.
    if (Math.abs(next - previous) < 1e-4) continue
    lastValues.set(addressKey, next)
    for (const listener of listeners) listener(next)
  }
}

function subscribe(addressKey: string, listener: Subscriber): () => void {
  let listeners = subscribers.get(addressKey)
  if (!listeners) {
    listeners = new Set()
    subscribers.set(addressKey, listeners)
  }
  listeners.add(listener)

  if (timer === null) timer = window.setInterval(tick, 1000 / POLL_HZ)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      subscribers.delete(addressKey)
      lastValues.delete(addressKey)
    }
    if (subscribers.size === 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

/** Live modulation offset for one parameter address. 0 when nothing drives it. */
export function useModulatedOffset(addressKey: string | null): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (!addressKey) {
      setOffset(0)
      return
    }
    setOffset(ModulationMatrix.getOffset(addressKey))
    return subscribe(addressKey, setOffset)
  }, [addressKey])

  return offset
}
