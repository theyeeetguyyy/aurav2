import { useMemo } from 'react'
import { Link2 } from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { addressKey } from '@/engine/modulation/ModulationMatrix'
import { useModulatedOffset } from '@/hooks/useModulatedValue'
import { ScrubField } from '@/components/common/ScrubField'
import type { ParamDescriptor } from '@/types/params'
import type { SceneObject } from '@/types/visual'

interface ParamFieldProps {
  object: SceneObject
  descriptor: ParamDescriptor
  value: number | string | boolean | undefined
  effectId?: string
}

/** One editable parameter, showing both its base value and what modulation is doing
 *  to it right now.
 *
 *  Without the live readout you are authoring blind: the shape visibly moves while the
 *  number sits still, because modulation bypasses React entirely (HC-1). The driven
 *  value is polled at display rate instead — see useModulatedOffset. */
export function ParamField({ object, descriptor, value, effectId }: ParamFieldProps) {
  const setParam = useSceneStore((s) => s.setParam)
  const address = { objectId: object.id, effectId, paramKey: descriptor.key }

  const key = useMemo(
    () => (descriptor.realtime ? addressKey(object.id, descriptor.key, effectId) : null),
    [object.id, descriptor.key, descriptor.realtime, effectId],
  )
  const offset = useModulatedOffset(key)
  const isDriven = Math.abs(offset) > 1e-4

  switch (descriptor.type) {
    case 'color':
      return (
        <label className="flex items-center justify-between h-7 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[11px] cursor-pointer">
          <span className="text-slate-400 font-medium truncate">{descriptor.label}</span>
          <input
            type="color"
            value={typeof value === 'string' ? value : '#000000'}
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
            checked={value === true}
            onChange={(e) => setParam(address, e.target.checked)}
            className="accent-aura-accent"
          />
        </label>
      )

    case 'enum':
      return (
        <label className="flex items-center justify-between gap-2 h-7 px-2 bg-aura-surface border border-aura-line rounded text-[11px]">
          <span className="text-slate-400 font-medium truncate">{descriptor.label}</span>
          <select
            value={String(value ?? descriptor.defaultValue)}
            onChange={(e) => setParam(address, e.target.value)}
            className="bg-transparent text-aura-accent text-[11px] outline-none cursor-pointer"
          >
            {descriptor.options?.map((option) => (
              <option key={option.value} value={option.value} className="bg-aura-elevated">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )

    default: {
      const base = typeof value === 'number' ? value : Number(descriptor.defaultValue)
      const decimals = descriptor.step >= 1 ? 0 : descriptor.step >= 0.1 ? 1 : 2

      return (
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <ScrubField
              descriptor={descriptor}
              value={base}
              onChange={(next) =>
                setParam(address, descriptor.type === 'int' ? Math.round(next) : next)
              }
            />
          </div>

          {/* Live driven value. Only rendered while something is actually moving it, so
              a static scene shows a quiet panel rather than a wall of zeroes. */}
          {isDriven && (
            <span
              className="shrink-0 w-14 text-right font-mono tabular-nums text-[10px] text-aura-state-solo"
              title={`Driven: base ${base.toFixed(decimals)} ${offset >= 0 ? '+' : '−'} ${Math.abs(offset).toFixed(decimals)}`}
            >
              {(base + offset).toFixed(decimals)}
            </span>
          )}

          <span
            className={`shrink-0 ${
              isDriven
                ? 'text-aura-state-solo'
                : descriptor.exposed && descriptor.realtime
                  ? 'text-slate-700'
                  : 'text-transparent'
            }`}
            title={
              isDriven
                ? 'Driven by a Field'
                : descriptor.exposed && descriptor.realtime
                  ? 'Can be driven — wire it in Routing'
                  : undefined
            }
          >
            <Link2 className="w-3 h-3" />
          </span>
        </div>
      )
    }
  }
}
