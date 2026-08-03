import { Activity, Power, Trash2 } from 'lucide-react'
import { useAudioStore, isTrackVisuallyActive } from '@/store/useAudioStore'
import { useModulationStore } from '@/store/useModulationStore'
import { useGeneratorStore, getGenerator } from '@/store/useGeneratorStore'
import { useTargetInfo } from './targetInfo'
import { fieldLabel } from '@/engine/modulation/fields'
import { connectionRange, reachableRange } from '@/engine/modulation/preview'
import { TransportClock } from '@/engine/time/TransportClock'
import { CURVE_PRESETS, isLinear } from '@/engine/modulation/curve'
import { CurveEditor } from './CurveEditor'
import { ModulationGraph } from './ModulationGraph'
import { ChainEditor } from './ChainEditor'
import { unitSuffix } from '@/utils/units'

/** Everything about one connection, in the order you think about it:
 *
 *    what it does  →  the shape of the reaction  →  the numbers
 *
 *  The graph comes first deliberately. "From 1.00 to 2.50" and a drawn curve answer
 *  "what will this actually do" far faster than six sliders do. */
export function ConnectionInspector({ id, onClear }: { id: string; onClear: () => void }) {
  const connection = useModulationStore((s) => s.connections.find((c) => c.id === id))
  const disconnect = useModulationStore((s) => s.disconnect)
  const update = useModulationStore((s) => s.updateConnection)
  const updateChain = useModulationStore((s) => s.updateChain)

  const tracks = useAudioStore((s) => s.tracks)
  const generators = useGeneratorStore((s) => s.generators)
  // Resolves a SceneObject parameter and a post-chain parameter identically — the target
  // side of a wire does not care which kind of thing owns the knob.
  const {
    descriptor,
    base: baseValue,
    ownerLabel,
    groupLabel,
  } = useTargetInfo(connection?.target ?? null)

  if (!connection) return null

  const sourceName =
    tracks.find((t) => t.id === connection.source.sourceId)?.name ??
    generators.find((g) => g.id === connection.source.sourceId)?.name

  const unit = unitSuffix(descriptor)
  // What the parameter actually does, measured against the real timeline (D7).
  const { low, high } =
    reachableRange(connection, baseValue, TransportClock.duration, {
      isTrackActive: isTrackVisuallyActive,
      getGenerator,
    }) ?? connectionRange(connection, baseValue)
  const decimals = descriptor && descriptor.step >= 1 ? 0 : 2

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-3 py-2 border-b border-aura-line shrink-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Activity className="w-3 h-3 text-aura-node-signal" />
          <span className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">
            Modulation
          </span>
          <button
            onClick={() => update(id, { enabled: !connection.enabled })}
            className={`transition-colors ${connection.enabled ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-400'}`}
            title={connection.enabled ? 'Disable' : 'Enable'}
          >
            <Power className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              disconnect(id)
              onClear()
            }}
            className="text-slate-600 hover:text-aura-hot transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <p className="text-[11px] text-slate-200 leading-snug truncate">
          {sourceName ? `${sourceName} · ` : ''}
          {fieldLabel(connection.source)}
        </p>
        <p className="text-[10px] text-slate-500 leading-snug truncate">
          ↓ {[groupLabel, ownerLabel, descriptor?.label].filter(Boolean).join(' · ')}
        </p>

        {/* The answer to "from what value to what value". */}
        <p className="mt-1.5 font-mono tabular-nums text-[11px]">
          <span className="text-slate-500">{low.toFixed(decimals)}{unit}</span>
          <span className="text-slate-600 mx-1.5">→</span>
          <span className="text-aura-accent">{high.toFixed(decimals)}{unit}</span>
          <span className="text-slate-600 ml-1.5 text-[10px]">
            (base {baseValue.toFixed(decimals)}{unit})
          </span>
        </p>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <section className="p-2 border-b border-aura-line">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
            Output over time
          </h3>
          <ModulationGraph connection={connection} baseValue={baseValue} unit={unit} />
          <p className="text-[10px] text-slate-600 leading-snug mt-1">
            Blue is the parameter's real value. Faint orange is the raw signal before
            shaping — the gap between them is what Curve and Rise/Fall are doing.
          </p>
        </section>

        <section className="p-2 border-b border-aura-line">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500">Response curve</h3>
            <span className="text-[9px] text-slate-600">
              {isLinear(connection.chain.curve) ? 'linear' : 'custom'}
            </span>
          </div>

          <CurveEditor
            points={connection.chain.curve}
            onChange={(curve) => updateChain(id, { curve })}
          />

          <div className="flex flex-wrap gap-1 mt-1.5">
            {CURVE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => updateChain(id, { curve: preset.points.map((p) => ({ ...p })) })}
                title={preset.hint}
                className="px-1.5 py-0.5 rounded bg-aura-surface border border-aura-line text-[10px] text-slate-400 hover:text-slate-100 hover:border-aura-accent transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-600 leading-snug mt-1.5">
            Left is quiet, right is loud. Drag a point to move it, drag between points to
            bend, double-click to add, Alt-click to remove.
          </p>
        </section>

        <ChainEditor connectionId={id} />
      </div>
    </div>
  )
}
