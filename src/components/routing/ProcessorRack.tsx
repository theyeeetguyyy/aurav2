import { Plus, Power, Trash2 } from 'lucide-react'
import { PROCESSOR_BRICKS, getProcessorBrick } from '@/engine/modulation/processors'
import { useModulationStore } from '@/store/useModulationStore'
import type { ModulationConnection } from '@/types/modulation'

/** Shared processing stages, and which of them a wire passes through.
 *
 *  This is the middle column the routing page was missing. A wire's own `SignalChain` is its
 *  private trim; a processor is an object several wires can reference, so one "quantise to 8
 *  steps" driving six parameters is one thing to edit rather than six copies that drift apart.
 *
 *  Everything here does something the chain cannot — stepping, holding, delaying. Nothing
 *  duplicates gain, curve or rise/fall, because a second way to smooth a signal is a second thing
 *  to get wrong.
 *
 *  Shown inside the wire inspector rather than as a free canvas: the question a processor answers
 *  is always "what happens to *this* signal", and answering it next to the wire needs no layout,
 *  no positions to save, and no way to draw a tangle. */
export function ProcessorRack({ connection }: { connection: ModulationConnection }) {
  const processors = useModulationStore((s) => s.processors)
  const addProcessor = useModulationStore((s) => s.addProcessor)
  const removeProcessor = useModulationStore((s) => s.removeProcessor)
  const setProcessorParam = useModulationStore((s) => s.setProcessorParam)
  const setProcessorEnabled = useModulationStore((s) => s.setProcessorEnabled)
  const toggleWireProcessor = useModulationStore((s) => s.toggleWireProcessor)
  const connections = useModulationStore((s) => s.connections)

  const active = connection.processorIds ?? []
  const all = Object.values(processors)

  /** How many wires use a processor. The number is the point of the feature, so it is on screen. */
  const usedBy = (id: string) =>
    connections.filter((candidate) => candidate.processorIds?.includes(id)).length

  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-1">
        <h4 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">Processing</h4>
        {PROCESSOR_BRICKS.map((brick) => (
          <button
            key={brick.kind}
            onClick={() => {
              const id = addProcessor(brick.kind)
              // Added from a wire, so attach it to that wire — otherwise the button appears to
              // do nothing until you find and tick it.
              toggleWireProcessor(connection.id, id)
            }}
            title={`${brick.label} — ${brick.hint}`}
            className="flex items-center gap-0.5 h-5 px-1.5 rounded border border-aura-line text-[9px] leading-none text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            {brick.label}
          </button>
        ))}
      </div>


      {all.map((processor) => {
        const brick = getProcessorBrick(processor.kind)
        if (!brick) return null

        const on = active.includes(processor.id)
        const shared = usedBy(processor.id)

        return (
          <div
            key={processor.id}
            className={`rounded border transition-colors ${
              on ? 'border-aura-accent bg-aura-surface' : 'border-aura-line'
            }`}
          >
            <div className="flex items-center gap-1 px-1.5 py-1">
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggleWireProcessor(connection.id, processor.id)}
                aria-label={`Use ${processor.name} on this wire`}
                title="Pass this wire through it"
                className="accent-aura-accent shrink-0"
              />
              <span className="flex-1 min-w-0 truncate text-[10px] text-slate-200">
                {processor.name}
              </span>
              <span
                className="text-[9px] font-mono tabular-nums text-slate-600"
                title={`Used by ${shared} wire${shared === 1 ? '' : 's'}`}
              >
                ×{shared}
              </span>
              <button
                onClick={() => setProcessorEnabled(processor.id, !processor.enabled)}
                title={processor.enabled ? 'Bypass everywhere' : 'Enable everywhere'}
                className={`shrink-0 transition-colors ${
                  processor.enabled
                    ? 'text-aura-accent'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                <Power className="w-3 h-3" />
              </button>
              <button
                onClick={() => removeProcessor(processor.id)}
                title="Delete it, and remove it from every wire using it"
                className="shrink-0 text-slate-600 hover:text-aura-hot transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {on && (
              <div className="border-t border-aura-line px-1.5 py-1 space-y-1">
                {brick.descriptors.map((descriptor) => (
                  <label key={descriptor.key} className="flex items-center gap-1.5">
                    <span className="w-16 shrink-0 text-[10px] text-slate-500">
                      {descriptor.label}
                    </span>
                    <input
                      type="range"
                      min={descriptor.min}
                      max={descriptor.max}
                      step={descriptor.step}
                      value={processor.params[descriptor.key] ?? Number(descriptor.defaultValue)}
                      onChange={(e) =>
                        setProcessorParam(processor.id, descriptor.key, Number(e.target.value))
                      }
                      className="flex-1 h-1 accent-aura-accent"
                    />
                    <span className="w-10 shrink-0 text-right text-[10px] font-mono tabular-nums text-slate-400">
                      {(processor.params[descriptor.key] ?? 0).toFixed(
                        descriptor.step >= 1 ? 0 : 2,
                      )}
                    </span>
                  </label>
                ))}

                {shared > 1 && (
                  <p className="text-[9px] text-aura-state-solo leading-snug">
                    Shared with {shared - 1} other wire{shared === 2 ? '' : 's'} — editing this
                    changes them too.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
