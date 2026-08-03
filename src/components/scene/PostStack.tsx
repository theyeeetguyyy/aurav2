import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Power,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { usePostStore } from '@/store/usePostStore'
import { PostRegistry } from '@/engine/post/PostRegistry'
import { POST_STACK_ID } from '@/types/visual'
import { ParamField } from './ParamField'

/** The project-wide post chain, presented where the docs put it: at the bottom of the
 *  scene stack, after every object (docs/10-ELEMENTS.md §H).
 *
 *  Order is evaluation order and it matters more here than anywhere else — grade before
 *  bloom grades the raw render, grade after bloom grades the glow. Both are useful and
 *  neither is a default, so the order is authored.
 *
 *  Parameters render inline through the same `ParamField` the inspector uses, so a post
 *  knob shows its live driven value and its "can be wired" marker exactly like a
 *  deformer knob does. */
export function PostStack() {
  const effects = usePostStore((s) => s.effects)
  const bypassed = usePostStore((s) => s.bypassed)
  const addBrick = usePostStore((s) => s.addBrick)
  const remove = usePostStore((s) => s.remove)
  const reorder = usePostStore((s) => s.reorder)
  const setEnabled = usePostStore((s) => s.setEnabled)
  const setParam = usePostStore((s) => s.setParam)
  const setBypassed = usePostStore((s) => s.setBypassed)

  const [open, setOpen] = useState(true)
  const [picking, setPicking] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const activeCount = effects.filter((e) => e.enabled).length

  return (
    <section className="border-t border-aura-line shrink-0 flex flex-col min-h-0">
      <header className="flex items-center gap-1 px-2 py-1.5 shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 flex-1 min-w-0 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Sparkles className={`w-3 h-3 ${activeCount > 0 && !bypassed ? 'text-aura-accent' : ''}`} />
          <h2 className="text-[10px] uppercase tracking-wider">
            Post · {activeCount} active
          </h2>
        </button>

        {/* Master bypass. A/B against the untreated render is the only way to judge a
            grade honestly, and it has to be one click away. */}
        <button
          onClick={() => setBypassed(!bypassed)}
          className={`shrink-0 transition-colors ${
            bypassed ? 'text-aura-hot' : 'text-slate-600 hover:text-slate-300'
          }`}
          title={bypassed ? 'Post chain bypassed — click to re-enable' : 'Bypass the whole chain'}
        >
          {bypassed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>

        <button
          onClick={() => {
            setOpen(true)
            setPicking((v) => !v)
          }}
          className="shrink-0 text-slate-500 hover:text-aura-accent transition-colors"
          title="Add an effect"
        >
          <Plus className="w-3 h-3" />
        </button>
      </header>

      {open && (
        <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-1">
          {picking && (
            <div className="p-1 bg-aura-base border border-aura-line rounded space-y-1.5">
              {PostRegistry.listByGroup().map(({ group, bricks }) => (
                <div key={group}>
                  <h4 className="px-1 text-[9px] uppercase tracking-wider text-slate-600">
                    {group}
                  </h4>
                  {bricks.map((brick) => (
                    <button
                      key={brick.id}
                      onClick={() => {
                        addBrick(brick.id)
                        setPicking(false)
                      }}
                      className="w-full text-left px-1.5 py-1 rounded hover:bg-aura-surface transition-colors"
                    >
                      <span className="block text-[11px] text-slate-200">{brick.label}</span>
                      <span className="block text-[10px] text-slate-600 leading-snug">
                        {brick.hint}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {effects.length === 0 && !picking && (
            <p className="text-[10px] text-slate-600 leading-snug py-1 px-1">
              Nothing applied. The render goes straight to screen. Bloom alone changes the
              perceived quality more than any other single thing here.
            </p>
          )}

          {effects.map((effect, index) => {
            const brick = PostRegistry.get(effect.effectId)
            if (!brick) return null
            const isCollapsed = collapsed[effect.id] === true

            return (
              <div key={effect.id} className="bg-aura-base border border-aura-line rounded">
                <header className="flex items-center gap-1 px-1.5 py-1 group">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [effect.id]: !isCollapsed }))}
                    className="shrink-0 text-slate-600 hover:text-slate-300"
                    title={isCollapsed ? 'Show parameters' : 'Hide parameters'}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">
                    {effect.name}
                  </span>
                  <span className="shrink-0 text-[9px] font-mono text-slate-700">{brick.group}</span>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => reorder(effect.id, -1)}
                      disabled={index === 0}
                      className="text-slate-500 hover:text-slate-200 disabled:text-slate-800"
                      title="Move earlier"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => reorder(effect.id, 1)}
                      disabled={index === effects.length - 1}
                      className="text-slate-500 hover:text-slate-200 disabled:text-slate-800"
                      title="Move later"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => setEnabled(effect.id, !effect.enabled)}
                    className={`shrink-0 transition-colors ${
                      effect.enabled ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={effect.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => remove(effect.id)}
                    className="shrink-0 text-slate-600 hover:text-aura-hot transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </header>

                {effect.enabled && !isCollapsed && (
                  <div className="p-1.5 pt-0 space-y-1">
                    {brick.descriptors.map((descriptor) => (
                      <ParamField
                        key={descriptor.key}
                        objectId={POST_STACK_ID}
                        effectId={effect.id}
                        descriptor={descriptor}
                        value={effect.params[descriptor.key]}
                        onChange={(value) => setParam(effect.id, descriptor.key, value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
