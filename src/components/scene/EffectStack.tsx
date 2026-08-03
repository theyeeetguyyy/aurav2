import { useState } from 'react'
import { Plus, Trash2, Power, ChevronUp, ChevronDown, Waves } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { EffectRegistry, type EffectBrick } from '@/engine/scene/EffectRegistry'
import { isCloner, isEffector } from '@/engine/scene/cloners/types'
import { ParamField } from './ParamField'
import type { SceneObject } from '@/types/visual'

/** Stackable effects on an object — deformers today, cloners and post-process later.
 *
 *  Order is evaluation order: each deformer displaces the result of the one above it,
 *  always starting from the undisplaced mesh each frame. Twist-then-explode looks
 *  different from explode-then-twist, and that is the point. */
export function EffectStack({ object }: { object: SceneObject }) {
  const addEffectBrick = useSceneStore((s) => s.addEffectBrick)
  const removeEffect = useSceneStore((s) => s.removeEffect)
  const updateEffect = useSceneStore((s) => s.updateEffect)
  const reorderEffect = useSceneStore((s) => s.reorderEffect)
  const setParam = useSceneStore((s) => s.setParam)
  const [picking, setPicking] = useState(false)

  const deformers = EffectRegistry.listByFamily('geometry')
  const instancing = EffectRegistry.listByFamily('instancing')
  const cloners = instancing.filter((b) => isCloner(b))
  const effectors = instancing.filter((b) => isEffector(b))
  const hasCloner = object.effects.some(
    (e) => e.enabled && isCloner(EffectRegistry.get(e.effectId) ?? {}),
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500">Effects</h3>
        <button
          onClick={() => setPicking((v) => !v)}
          className="text-slate-500 hover:text-aura-accent transition-colors"
          title="Add an effect"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {picking && (
        <div className="mb-1.5 p-1 bg-aura-base border border-aura-line rounded space-y-1.5">
          <BrickGroup
            title="Deformers"
            bricks={deformers}
            onPick={(id) => {
              addEffectBrick(object.id, id)
              setPicking(false)
            }}
          />
          <BrickGroup
            title="Cloners"
            // One layout per object: a second would simply overwrite the first's clone
            // placement, so it is disabled rather than allowed to silently do nothing.
            note={hasCloner ? 'One cloner per object' : undefined}
            disabled={hasCloner}
            bricks={cloners}
            onPick={(id) => {
              addEffectBrick(object.id, id)
              setPicking(false)
            }}
          />
          <BrickGroup
            title="Effectors"
            note={hasCloner ? undefined : 'Add a cloner first'}
            disabled={!hasCloner}
            bricks={effectors}
            onPick={(id) => {
              addEffectBrick(object.id, id)
              setPicking(false)
            }}
          />
        </div>
      )}

      {object.effects.length === 0 && !picking && (
        <p className="text-[10px] text-slate-600 leading-snug py-1">
          Nothing stacked. Deformers make a shape explode, spike and ripple; a cloner
          repeats it and effectors vary each copy. All of it is drivable at frame rate.
        </p>
      )}

      <div className="space-y-1">
        {object.effects.map((effect, index) => {
          const brick = EffectRegistry.get(effect.effectId)
          if (!brick) return null

          return (
            <div key={effect.id} className="bg-aura-base border border-aura-line rounded">
              <header className="flex items-center gap-1 px-1.5 py-1 group">
                <Waves
                  className={`w-3 h-3 shrink-0 ${effect.enabled ? 'text-aura-accent' : 'text-slate-600'}`}
                />
                <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">
                  {effect.name}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => reorderEffect(object.id, effect.id, -1)}
                    disabled={index === 0}
                    className="text-slate-500 hover:text-slate-200 disabled:text-slate-800"
                    title="Move earlier"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => reorderEffect(object.id, effect.id, 1)}
                    disabled={index === object.effects.length - 1}
                    className="text-slate-500 hover:text-slate-200 disabled:text-slate-800"
                    title="Move later"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => updateEffect(object.id, effect.id, { enabled: !effect.enabled })}
                  className={`shrink-0 transition-colors ${
                    effect.enabled ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title={effect.enabled ? 'Disable' : 'Enable'}
                >
                  <Power className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeEffect(object.id, effect.id)}
                  className="shrink-0 text-slate-600 hover:text-aura-hot transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </header>

              {effect.enabled && (
                <div className="p-1.5 pt-0 space-y-1">
                  {brick.descriptors.map((descriptor) => (
                    <ParamField
                      key={descriptor.key}
                      objectId={object.id}
                      descriptor={descriptor}
                      value={effect.params[descriptor.key]}
                      effectId={effect.id}
                      onChange={(value) =>
                        setParam(
                          { objectId: object.id, effectId: effect.id, paramKey: descriptor.key },
                          value,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}


/** One group in the effect picker. Grouping matters here more than it looks: a cloner
 *  and an effector are stacked the same way but mean different things, and an effector
 *  with no cloner above it has nothing to affect. */
function BrickGroup({
  title,
  bricks,
  onPick,
  disabled,
  note,
}: {
  title: string
  bricks: EffectBrick[]
  onPick: (id: string) => void
  disabled?: boolean
  note?: string
}) {
  if (bricks.length === 0) return null

  return (
    <div>
      <h4 className="px-1 flex items-baseline gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-slate-600">{title}</span>
        {note && <span className="text-[9px] text-slate-700">{note}</span>}
      </h4>
      {bricks.map((brick) => (
        <button
          key={brick.id}
          disabled={disabled}
          onClick={() => onPick(brick.id)}
          className={`w-full text-left px-1.5 py-1 rounded transition-colors ${
            disabled ? 'opacity-40 cursor-default' : 'hover:bg-aura-surface'
          }`}
        >
          <span className="block text-[11px] text-slate-200">{brick.label}</span>
          <span className="block text-[10px] text-slate-600 leading-snug">{brick.hint}</span>
        </button>
      ))}
    </div>
  )
}
