import { useModulationStore } from '@/store/useModulationStore'
import { ScrubField } from '@/components/common/ScrubField'
import type { ParamDescriptor } from '@/types/params'

/** Per-connection signal chain editor (Principle 8, Ableton's Envelope Follower).
 *
 *      Gain → Rise/Fall → Min/Max → Weight
 *
 *  Presented in evaluation order deliberately: the chain is a signal path, and reading
 *  it top to bottom should describe what happens to the signal. Rise/Fall is the
 *  control that separates a visual that *hits* from one that chatters, so it is not
 *  buried in an advanced panel. */

function chainParam(
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  unit?: ParamDescriptor['unit'],
): ParamDescriptor {
  return {
    key,
    label,
    type: 'float',
    min,
    max,
    step,
    defaultValue,
    unit,
    group: 'Chain',
    exposed: false,
    realtime: false,
  }
}

const CHAIN_PARAMS = [
  chainParam('gain', 'Gain', 0, 8, 0.01, 1, 'x'),
  chainParam('rise', 'Rise', 0, 2000, 1, 10, 's'),
  chainParam('fall', 'Fall', 0, 4000, 1, 120, 's'),
  chainParam('min', 'Min', -100, 100, 0.01, 0),
  chainParam('max', 'Max', -100, 100, 0.01, 1),
  chainParam('weight', 'Weight', 0, 2, 0.01, 1),
] as const

export function ChainEditor({ connectionId }: { connectionId: string }) {
  const connection = useModulationStore((s) => s.connections.find((c) => c.id === connectionId))
  const updateChain = useModulationStore((s) => s.updateChain)

  if (!connection) return null

  return (
    <div className="p-2 border-t border-aura-line space-y-1">
      {CHAIN_PARAMS.map((descriptor) => (
        <ScrubField
          key={descriptor.key}
          // Rise/Fall are stored in milliseconds; the 's' unit suffix would be wrong.
          descriptor={
            descriptor.key === 'rise' || descriptor.key === 'fall'
              ? { ...descriptor, unit: undefined, label: `${descriptor.label} (ms)` }
              : descriptor
          }
          value={connection.chain[descriptor.key as keyof typeof connection.chain] as number}
          onChange={(value) => updateChain(connection.id, { [descriptor.key]: value })}
        />
      ))}

      <label className="flex items-center justify-between h-7 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[11px] cursor-pointer">
        <span className="text-slate-400 font-medium">Invert</span>
        <input
          type="checkbox"
          checked={connection.chain.invert}
          onChange={(e) => updateChain(connection.id, { invert: e.target.checked })}
          className="accent-aura-accent"
        />
      </label>

      <p className="text-[10px] text-slate-600 leading-snug pt-1">
        Min/Max are an offset range in the target's own units, added to its base value.
      </p>
    </div>
  )
}
