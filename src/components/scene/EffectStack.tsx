import { useState } from 'react'
import { Plus, Trash2, Power, ChevronUp, ChevronDown, Waves } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { EffectRegistry } from '@/engine/scene/EffectRegistry'
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
  const [picking, setPicking] = useState(false)

  const available = EffectRegistry.listByFamily('geometry')

  return (
    <section>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500">Deformers</h3>
        <button
          onClick={() => setPicking((v) => !v)}
          className="text-slate-500 hover:text-aura-accent transition-colors"
          title="Add a deformer"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {picking && (
        <div className="mb-1.5 p-1 bg-aura-base border border-aura-line rounded space-y-0.5">
          {available.map((brick) => (
            <button
              key={brick.id}
              onClick={() => {
                addEffectBrick(object.id, brick.id)
                setPicking(false)
              }}
              className="w-full text-left px-1.5 py-1 rounded hover:bg-aura-surface transition-colors"
            >
              <span className="block text-[11px] text-slate-200">{brick.label}</span>
              <span className="block text-[10px] text-slate-600 leading-snug">{brick.hint}</span>
            </button>
          ))}
        </div>
      )}

      {object.effects.length === 0 && !picking && (
        <p className="text-[10px] text-slate-600 leading-snug py-1">
          No deformers. These are what make a shape explode, spike and ripple — and unlike
          geometry settings, they can be driven by audio at frame rate.
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
                      object={object}
                      descriptor={descriptor}
                      value={effect.params[descriptor.key]}
                      effectId={effect.id}
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
