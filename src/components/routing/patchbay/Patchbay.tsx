import { useCallback, useEffect, useRef, useState } from 'react'
import { useModulationStore } from '@/store/useModulationStore'
import { useUIStore } from '@/store/useUIStore'
import { Splitter } from '@/components/common/Splitter'
import { refreshAnchors } from './anchors'
import { describeTarget } from '../targetInfo'
import {
  parseAddress,
  type FieldRef,
  type ParamAddress,
  type ParamDescriptor,
} from '@/types/params'
import { SourceColumn } from './SourceColumn'
import { TargetColumn } from './TargetColumn'
import { WireLayer } from './WireLayer'
import { endDrag, moveDrag } from './dragState'

interface PatchbayProps {
  selectedWireId: string | null
  onSelectWire: (id: string | null) => void
  /** Pinned to the bottom of the source column. Hosts the scene monitor, so the result
   *  of a routing is visible in the same glance as the wire that causes it. */
  bottomLeft?: React.ReactNode
}

/** Patchbay — the routing surface (docs/11-ROUTING-UX.md).
 *
 *  Two fixed columns with a live wire layer between. Replaces a five-click dropdown
 *  flow with one drag, and — more importantly — makes the patch legible: you can see
 *  what drives what, and watch signal move along the wires.
 *
 *  Deliberately not a free node canvas. Wires are what TouchDesigner gets right; a blank
 *  canvas is what it gets wrong for this audience (D-34). */
export function Patchbay({ selectedWireId, onSelectWire, bottomLeft }: PatchbayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const connect = useModulationStore((s) => s.connect)
  const [hint, setHint] = useState<string | null>(null)

  const sourceWidth = useUIStore((s) => s.patchSourceWidth)
  const targetWidth = useUIStore((s) => s.patchTargetWidth)
  const setSourceWidth = useUIStore((s) => s.setPatchSourceWidth)
  const setTargetWidth = useUIStore((s) => s.setPatchTargetWidth)

  // Resizing a column moves every wire endpoint, but changes neither the container's
  // size nor the set of anchors — so no observer fires on its own. Nudge the wire layer.
  useEffect(() => {
    refreshAnchors()
  }, [sourceWidth, targetWidth])

  /** Create a connection with defaults that actually do something visible. */
  const createConnection = useCallback(
    (field: FieldRef, address: ParamAddress) => {
      const { descriptor } = describeTarget(address)

      // Every drop makes an ordinary connection, onset included (D-125).
      //
      // Onset used to be special-cased into a discrete trigger, on the reasoning that a percussive
      // source implies a fire-once response. Two things were wrong with that. A trigger has no
      // signal chain — no gain, curve, rise/fall, range or processors — so the one source most
      // people wire first was the only one that could not be shaped. And its impulse was a flat
      // `1` in the parameter's own units while every connection seeds its range from the target
      // descriptor, so an onset onto a ±20 parameter moved it by 5 % and onto a ±500 one did
      // nothing visible at all. It read as "onset does not work", and that reading was correct.
      //
      // Nothing is lost by dropping the special case: the analysed `onset` timeline is *already* an
      // exponentially decaying impulse per detected hit, so a continuous wire fires on the hit the
      // same way — and now the decay is Rise/Fall, the shape is a curve, and the depth is a range.
      connect(field, address, seedRange(descriptor))
      setHint(`${field.key} → ${descriptor?.label ?? address.paramKey}`)
    },
    [connect],
  )


  const handleDragStart = useCallback(
    (field: FieldRef, event: React.PointerEvent) => {
      const container = containerRef.current
      if (!container) return

      const toLocal = (clientX: number, clientY: number) => {
        const box = container.getBoundingClientRect()
        return { x: clientX - box.left, y: clientY - box.top }
      }

      const start = toLocal(event.clientX, event.clientY)
      moveDrag(start.x, start.y, null)

      const onMove = (e: PointerEvent) => {
        const local = toLocal(e.clientX, e.clientY)
        const row = (e.target as HTMLElement | null)?.closest?.('[data-target-id]')
        moveDrag(local.x, local.y, row?.getAttribute('data-target-id') ?? null)
      }

      const onUp = (e: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)

        // elementFromPoint rather than e.target: the cursor wire and the SVG overlay sit
        // above the rows, so the event target is not the row the user is aiming at.
        const under = document.elementFromPoint(e.clientX, e.clientY)
        const row = under?.closest('[data-target-id]')
        const serialised = row?.getAttribute('data-target-id')

        endDrag()
        if (!serialised) return

        const address = parseAddress(serialised)
        if (address) createConnection(field, address)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [createConnection],
  )

  useEffect(() => {
    if (!hint) return
    const id = window.setTimeout(() => setHint(null), 2200)
    return () => window.clearTimeout(id)
  }, [hint])

  return (
    <div className="relative h-full flex flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 grid"
        // Columns are user-resizable; the wire gutter takes whatever is left.
        style={{ gridTemplateColumns: `${sourceWidth}px 1px minmax(2rem, 1fr) 1px ${targetWidth}px` }}
      >
        <div className="min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <SourceColumn onDragStart={handleDragStart} />
          </div>
          {bottomLeft}
        </div>

        <Splitter
          onDrag={(clientX) =>
            setSourceWidth(clientX - (containerRef.current?.getBoundingClientRect().left ?? 0))
          }
          title="Drag to resize the source column"
        />

        {/* Wire gutter. Empty on purpose — it is where the lines live. */}
        <div className="min-h-0" />

        <Splitter
          onDrag={(clientX) =>
            setTargetWidth((containerRef.current?.getBoundingClientRect().right ?? 0) - clientX)
          }
          title="Drag to resize the parameter column"
        />

        <div className="min-h-0">
          <TargetColumn />
        </div>

        <WireLayer
          containerRef={containerRef}
          selectedId={selectedWireId}
          onSelect={onSelectWire}
        />
      </div>

      <footer className="shrink-0 h-6 px-3 flex items-center justify-between border-t border-aura-line">
        <span className="text-[10px] text-slate-600">
          Drag a source dot onto a parameter · click a wire to edit it
        </span>
        {hint && <span className="text-[10px] text-aura-accent font-mono">{hint}</span>}
      </footer>
    </div>
  )
}

/** Seed the modulation range from the target's own descriptor.
 *
 *  The old flat `0 → 1` default was invisible on a parameter whose range is −500…500,
 *  so a fresh connection appeared to do nothing. Scaling to the parameter's own default
 *  value — or a slice of its range when the default is zero — means a new wire is
 *  immediately visible without being absurd. */
function seedRange(
  descriptor: ParamDescriptor | null,
): { min: number; max: number } | undefined {
  if (!descriptor || (descriptor.type !== 'float' && descriptor.type !== 'int')) return undefined

  const base = Number(descriptor.defaultValue)
  const span = descriptor.max - descriptor.min
  const magnitude = base !== 0 ? Math.abs(base) : span * 0.05

  return { min: 0, max: Math.min(magnitude, descriptor.max) }
}
