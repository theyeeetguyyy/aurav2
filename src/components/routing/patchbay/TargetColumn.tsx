import { useCallback, useSyncExternalStore } from 'react'
import { useSceneStore } from '@/store/useSceneStore'
import { useModulationStore } from '@/store/useModulationStore'
import { allModulationTargets } from '@/engine/params/ParamRegistry'
import { formatAddress, type ParamAddress } from '@/types/params'
import { registerAnchor, targetAnchorId } from './anchors'
import { getDrag, subscribeDrag } from './dragState'
import type { SceneObject } from '@/types/visual'

/** Right column — every parameter that can be driven, grouped by object.
 *
 *  Includes deformer parameters, which is where the interesting routings live: those are
 *  the only geometry-changing values drivable at frame rate (D-31/D-33). */
export function TargetColumn() {
  const objects = useSceneStore((s) => s.objects)

  if (objects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-[11px] text-slate-600 text-center leading-snug">
          No objects yet.
          <br />
          Add a shape in Scene &amp; Shapes.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {objects.map((object) => (
        <ObjectTargets key={object.id} object={object} />
      ))}
    </div>
  )
}

function ObjectTargets({ object }: { object: SceneObject }) {
  const targets = allModulationTargets(object)

  return (
    <section className="border-b border-aura-line pb-1">
      <header className="px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <h3 className="text-[11px] font-medium text-slate-200 truncate">{object.name}</h3>
      </header>

      {targets.map((entry) => (
        <TargetRow
          key={`${entry.effectId ?? ''}/${entry.descriptor.key}`}
          address={{
            objectId: object.id,
            effectId: entry.effectId,
            paramKey: entry.descriptor.key,
          }}
          label={entry.descriptor.label}
          ownerLabel={entry.ownerLabel}
        />
      ))}
    </section>
  )
}

/** Coarse "is a drag happening" flag. The cursor position is NOT in React — only this
 *  boolean is, so rows can show they are droppable. */
function useDragActive(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeDrag(() => onChange()),
    () => getDrag() !== null,
    () => false,
  )
}

interface TargetRowProps {
  address: ParamAddress
  label: string
  ownerLabel?: string
}

function TargetRow({ address, label, ownerLabel }: TargetRowProps) {
  const id = targetAnchorId(address)
  const key = formatAddress(address)
  const dragging = useDragActive()

  const connections = useModulationStore((s) => s.connections)
  const triggers = useModulationStore((s) => s.triggers)
  const count =
    connections.filter((c) => formatAddress(c.target) === key).length +
    triggers.filter((t) => formatAddress(t.target) === key).length

  const attach = useCallback(
    (element: HTMLSpanElement | null) => registerAnchor(id, element),
    [id],
  )

  return (
    <div
      // Drop detection reads this attribute via elementFromPoint, so the whole row is a
      // target rather than just the dot — a 2px hit area would be miserable to aim at.
      data-target-id={key}
      className={[
        'group flex items-center gap-1.5 pl-2 pr-3 py-0.5 transition-colors',
        dragging
          ? 'bg-aura-surface/40 hover:bg-aura-accent/20 ring-1 ring-inset ring-aura-accent/30'
          : 'hover:bg-aura-surface',
      ].join(' ')}
    >
      <span
        ref={attach}
        className={[
          'w-2 h-2 rounded-full shrink-0 transition-colors',
          count > 0 ? 'bg-aura-accent' : 'bg-slate-700 group-hover:bg-slate-500',
        ].join(' ')}
      />
      <span
        className={`flex-1 min-w-0 truncate text-[10px] ${
          count > 0 ? 'text-slate-200' : 'text-slate-400'
        }`}
      >
        {ownerLabel && <span className="text-aura-accent">{ownerLabel} · </span>}
        {label}
      </span>
      {count > 0 && (
        <span className="text-[9px] font-mono tabular-nums text-slate-600 shrink-0">{count}</span>
      )}
    </div>
  )
}
