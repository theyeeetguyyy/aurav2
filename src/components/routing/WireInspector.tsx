import { Trash2, Power, Zap } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { useModulationStore } from '@/store/useModulationStore'
import { useTargetInfo } from './targetInfo'
import { fieldLabel } from '@/engine/modulation/fields'
import { ScrubField } from '@/components/common/ScrubField'
import { ConnectionInspector } from './ConnectionInspector'
import type { ParamDescriptor } from '@/types/params'

/** Right dock of the Routing page — the selected wire's settings.
 *
 *  Selection lives here rather than inline in a list, so the patchbay stays a clean
 *  map of the patch and editing never reflows it. */
export function WireInspector({
  wireId,
  onClear,
}: {
  wireId: string | null
  onClear: () => void
}) {
  const connection = useModulationStore((s) => s.connections.find((c) => c.id === wireId))
  const trigger = useModulationStore((s) => s.triggers.find((t) => t.id === wireId))

  if (!connection && !trigger) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-[11px] text-slate-600 text-center leading-snug">
          Click a wire to edit its signal chain.
        </p>
      </div>
    )
  }

  return connection ? (
    <ConnectionInspector id={connection.id} onClear={onClear} />
  ) : (
    <TriggerInspector id={trigger!.id} onClear={onClear} />
  )
}

function useEndpointLabels(source: { sourceId?: string; kind: string; key: string }, target: {
  objectId: string
  effectId?: string
  paramKey: string
}) {
  const tracks = useAudioStore((s) => s.tracks)
  const { descriptor, ownerLabel, groupLabel } = useTargetInfo(target)

  return {
    from: [tracks.find((t) => t.id === source.sourceId)?.name, fieldLabel(source as never)]
      .filter(Boolean)
      .join(' · '),
    to: [groupLabel, ownerLabel, descriptor?.label ?? target.paramKey].filter(Boolean).join(' · '),
  }
}

function Header({
  from,
  to,
  icon,
  enabled,
  onToggle,
  onDelete,
}: {
  from: string
  to: string
  icon: React.ReactNode
  enabled: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <header className="px-3 py-2 border-b border-aura-line shrink-0">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">Wire</span>
        <button
          onClick={onToggle}
          className={`transition-colors ${enabled ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-400'}`}
          title={enabled ? 'Disable' : 'Enable'}
        >
          <Power className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="text-slate-600 hover:text-aura-hot transition-colors"
          title="Delete wire"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[11px] text-slate-200 leading-snug">{from}</p>
      <p className="text-[10px] text-slate-500 leading-snug">↓ {to}</p>
    </header>
  )
}

const triggerParam = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  defaultValue: number,
  unit?: ParamDescriptor['unit'],
): ParamDescriptor => ({
  key,
  label,
  type: 'float',
  min,
  max,
  step,
  defaultValue,
  unit,
  group: 'Trigger',
  exposed: false,
  realtime: false,
})

function TriggerInspector({ id, onClear }: { id: string; onClear: () => void }) {
  const trigger = useModulationStore((s) => s.triggers.find((t) => t.id === id))!
  const remove = useModulationStore((s) => s.removeTrigger)
  const update = useModulationStore((s) => s.updateTrigger)
  const labels = useEndpointLabels(trigger.source, trigger.target)

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header
        {...labels}
        icon={<Zap className="w-3 h-3 text-aura-node-event" />}
        enabled={trigger.enabled}
        onToggle={() => update(id, { enabled: !trigger.enabled })}
        onDelete={() => {
          remove(id)
          onClear()
        }}
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        <ScrubField
          descriptor={triggerParam('amount', 'Amount', -50, 50, 0.05, 1)}
          value={trigger.amount}
          onChange={(amount) => update(id, { amount })}
        />
        <ScrubField
          descriptor={triggerParam('decay', 'Decay', 0.01, 4, 0.01, 0.18, 's')}
          value={trigger.decay}
          onChange={(decay) => update(id, { decay })}
        />
        <p className="text-[10px] text-slate-600 leading-snug pt-1">
          Fires once per detected hit and decays. Derived from the age of the last onset, so
          scrubbing backwards reproduces it exactly.
        </p>
      </div>
    </div>
  )
}
