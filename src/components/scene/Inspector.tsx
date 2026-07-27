import { Link2 } from 'lucide-react'
import { useSceneStore, useSelectedObject } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { describeObject, groupsOf, readParam } from '@/engine/params/ParamRegistry'
import { ScrubField } from '@/components/common/ScrubField'
import type { ParamDescriptor } from '@/types/params'
import type { SceneObject } from '@/types/visual'

/** Inspector — entirely descriptor-driven (docs/03-ARCHITECTURE.md HC-5).
 *
 *  This component knows nothing about radius, roughness, or any specific parameter.
 *  It renders whatever ParamRegistry describes for the selected object, so a newly
 *  registered brick gets a correct, correctly-ranged editor for free. */
export function Inspector() {
  const object = useSelectedObject()

  if (!object) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-[11px] text-slate-600 text-center">
          Select an object to edit its parameters
        </p>
      </div>
    )
  }

  const descriptors = describeObject(object)
  const groups = groupsOf(descriptors)

  return (
    <div className="flex flex-col h-full min-h-0">
      <ObjectHeader object={object} />

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {groups.map((group) => (
          <section key={group}>
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{group}</h3>
            <div className="space-y-1">
              {descriptors
                .filter((d) => d.group === group)
                .map((descriptor) => (
                  <ParamRow key={descriptor.key} object={object} descriptor={descriptor} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ObjectHeader({ object }: { object: SceneObject }) {
  const setBrick = useSceneStore((s) => s.setBrick)
  const brick = BrickRegistry.get(object.brickId)
  const morphTargets = BrickRegistry.morphTargets(object.brickId)

  return (
    <header className="px-3 py-2 border-b border-aura-line shrink-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-200 truncate">{object.name}</span>
        <span className="text-[10px] text-slate-500 font-mono shrink-0">
          {object.backend}/{object.meshKind}
        </span>
      </div>

      <select
        value={object.brickId}
        onChange={(e) => setBrick(object.id, e.target.value)}
        className="w-full h-6 px-1.5 bg-aura-surface border border-aura-line rounded text-[11px] text-slate-300 outline-none focus:border-aura-focus"
        title="Swap geometry. Shared parameter values are preserved."
      >
        <optgroup label="Morphable">
          {BrickRegistry.list()
            .filter((b) => b.meshKind === 'procedural')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
        </optgroup>
        <optgroup label="Primitives">
          {BrickRegistry.list()
            .filter((b) => b.meshKind === 'primitive')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
        </optgroup>
      </select>

      <p className="text-[10px] text-slate-600 leading-snug">
        {brick?.morphGroup
          ? `Can morph into ${morphTargets.length} other shape${morphTargets.length === 1 ? '' : 's'}`
          : 'Swap-only — transitions to other shapes are a crossfade, not a morph'}
      </p>
    </header>
  )
}

function ParamRow({ object, descriptor }: { object: SceneObject; descriptor: ParamDescriptor }) {
  const setParam = useSceneStore((s) => s.setParam)
  const raw = readParam(object, { objectId: object.id, paramKey: descriptor.key })
  const address = { objectId: object.id, paramKey: descriptor.key }

  const control = (() => {
    switch (descriptor.type) {
      case 'color':
        return (
          <label className="flex items-center justify-between h-7 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[11px] cursor-pointer">
            <span className="text-slate-400 font-medium truncate">{descriptor.label}</span>
            <input
              type="color"
              value={typeof raw === 'string' ? raw : '#000000'}
              onChange={(e) => setParam(address, e.target.value)}
              className="w-6 h-4 bg-transparent border-0 cursor-pointer p-0"
            />
          </label>
        )

      case 'bool':
        return (
          <label className="flex items-center justify-between h-7 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[11px] cursor-pointer">
            <span className="text-slate-400 font-medium truncate">{descriptor.label}</span>
            <input
              type="checkbox"
              checked={raw === true}
              onChange={(e) => setParam(address, e.target.checked)}
              className="accent-aura-accent"
            />
          </label>
        )

      default:
        return (
          <ScrubField
            descriptor={descriptor}
            value={typeof raw === 'number' ? raw : Number(descriptor.defaultValue)}
            onChange={(value) =>
              setParam(address, descriptor.type === 'int' ? Math.round(value) : value)
            }
          />
        )
    }
  })()

  return (
    <div className="flex items-center gap-1">
      <div className="flex-1 min-w-0">{control}</div>
      {/* Exposed parameters are the modulation targets (Niagara "User Parameters").
          Wiring lands in Phase 5; the affordance is shown now so the distinction
          between exposed and internal is visible while authoring. */}
      <span
        className={`shrink-0 ${descriptor.exposed ? 'text-slate-600' : 'text-transparent'}`}
        title={descriptor.exposed ? 'Can be driven by a Field (Phase 5)' : undefined}
      >
        <Link2 className="w-3 h-3" />
      </span>
    </div>
  )
}
