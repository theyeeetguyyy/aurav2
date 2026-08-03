import { useSceneStore, useSelectedObject } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { MaterialRegistry } from '@/engine/scene/materials/MaterialRegistry'
import { LightRegistry } from '@/engine/scene/lights/LightRegistry'
import { describeObject, groupsOf, readParam } from '@/engine/params/ParamRegistry'
import { ParamField } from './ParamField'
import { EffectStack } from './EffectStack'
import type { SceneObject } from '@/types/visual'

/** Inspector — entirely descriptor-driven (docs/03-ARCHITECTURE.md HC-5).
 *
 *  This component knows nothing about radius, roughness, or any specific parameter.
 *  It renders whatever ParamRegistry describes for the selected object, so a newly
 *  registered brick gets a correct, correctly-ranged editor for free. */
export function Inspector() {
  const object = useSelectedObject()
  const setParam = useSceneStore((s) => s.setParam)

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
                  <ParamField
                    key={descriptor.key}
                    objectId={object.id}
                    descriptor={descriptor}
                    value={readParam(object, { objectId: object.id, paramKey: descriptor.key })}
                    onChange={(value) =>
                      setParam({ objectId: object.id, paramKey: descriptor.key }, value)
                    }
                  />
                ))}
            </div>
          </section>
        ))}

        {object.type !== 'light' && <EffectStack object={object} />}
      </div>
    </div>
  )
}

function ObjectHeader({ object }: { object: SceneObject }) {
  const setBrick = useSceneStore((s) => s.setBrick)
  const setMaterialBrick = useSceneStore((s) => s.setMaterialBrick)
  const brick = BrickRegistry.get(object.brickId)
  const material = MaterialRegistry.get(object.materialId)
  const morphTargets = BrickRegistry.morphTargets(object.brickId)

  if (object.type === 'light') {
    const light = LightRegistry.get(object.brickId)
    return (
      <header className="px-3 py-2 border-b border-aura-line shrink-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-200 truncate">{object.name}</span>
          <span className="text-[10px] text-slate-500 font-mono shrink-0">light</span>
        </div>
        <p className="text-[10px] text-slate-600 leading-snug">{light?.hint}</p>
        <p className="text-[10px] text-slate-600 leading-snug">
          Wire an onset to Intensity in Routing and this becomes a strobe.
        </p>
      </header>
    )
  }

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

      {/* Shading model. Separate from geometry because they are separate questions —
          the same sphere is a different object as chrome, as neon, or as a rim glow. */}
      <select
        value={object.materialId}
        onChange={(e) => setMaterialBrick(object.id, e.target.value)}
        className="w-full h-6 px-1.5 bg-aura-surface border border-aura-line rounded text-[11px] text-slate-300 outline-none focus:border-aura-focus"
        title={material?.hint ?? 'Shading model'}
      >
        {MaterialRegistry.list().map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </header>
  )
}
