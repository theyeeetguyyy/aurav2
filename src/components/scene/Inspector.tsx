import { useSceneStore, useSelectedObject } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import {
  canRenderAsPoints,
  materialFamilyOf,
  materialFamilyOfId,
} from '@/engine/scene/buildObject'
import { brickGroups } from '@/engine/scene/brickGroups'
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
  const setBackend = useSceneStore((s) => s.setBackend)
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
      </header>
    )
  }

  return (
    <header className="px-3 py-2 border-b border-aura-line shrink-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-200 truncate">{object.name}</span>
        <span className="text-[10px] text-slate-500 font-mono shrink-0">
          {[object.backend, object.meshKind].filter(Boolean).join('/')}
        </span>
      </div>

      {/* Every group the library offers, so an object's own brick always appears selected rather
          than blank — and from the same authority, so the two lists cannot drift apart. */}
      <select
        value={object.brickId}
        onChange={(e) => setBrick(object.id, e.target.value)}
        className="w-full h-6 px-1.5 bg-aura-surface border border-aura-line rounded text-[11px] text-slate-300 outline-none focus:border-aura-focus"
        title="Swap geometry. Shared parameter values are preserved."
      >
        {brickGroups().map((group) => (
          <optgroup key={group.title} label={group.title}>
            {group.bricks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Surface or cloud, for the same geometry. The largest change of image available from one
          click: a vertex is a point, so every mesh already contains a cloud, and lit-surface and
          accumulating-dust are not mistakable for each other. Hidden for a point brick, which has
          no faces to shade. */}
      {canRenderAsPoints(object) && (
        <div className="flex rounded overflow-hidden border border-aura-line">
          {(['mesh', 'points'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setBackend(object.id, mode)}
              aria-pressed={object.backend === mode}
              className={`flex-1 h-6 text-[10px] uppercase tracking-wider transition-colors ${
                object.backend === mode
                  ? 'bg-aura-accent/15 text-aura-accent'
                  : 'bg-aura-surface text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode === 'mesh' ? 'Surface' : 'Points'}
            </button>
          ))}
        </div>
      )}

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
        {/* Filtered by backend: a `PointsMaterial` on a mesh renders nothing, a mesh material on a
            cloud renders unshaded squares, and a mesh material on a stroke renders black. All three
            read as bugs, so none is offered. */}
        {MaterialRegistry.list()
          .filter((m) => materialFamilyOfId(m.id) === materialFamilyOf(object.backend))
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
      </select>
    </header>
  )
}
