import { useState } from 'react'
import { ChevronDown, ChevronRight, Globe, Power } from 'lucide-react'
import { ENV_SECTIONS, ENV_STACK_ID } from '@/engine/environment/sections'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
import { ParamField } from './ParamField'

/** The world settings panel (docs/10-ELEMENTS.md §E).
 *
 *  Sits above the post chain because that is the order the frame is built: the world is
 *  what objects are lit by and sit inside; post is what happens to the picture afterwards.
 *
 *  Every row is the same `ParamField` used everywhere else, so a light intensity shows
 *  its live driven value the moment something is wired to it. */
export function WorldPanel() {
  const params = useEnvironmentStore((s) => s.params)
  const disabled = useEnvironmentStore((s) => s.disabled)
  const setParam = useEnvironmentStore((s) => s.setParam)
  const setSectionEnabled = useEnvironmentStore((s) => s.setSectionEnabled)

  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ lighting: true })

  return (
    <section className="border-t border-aura-line shrink-0 flex flex-col min-h-0 max-h-[35%]">
      <header className="flex items-center gap-1 px-2 py-1.5 shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 flex-1 min-w-0 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Globe className="w-3 h-3" />
          <h2 className="text-[10px] uppercase tracking-wider">World</h2>
        </button>
      </header>

      {open && (
        <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-1">
          {ENV_SECTIONS.map((section) => {
            const isOn = disabled[section.id] !== true
            const isExpanded = expanded[section.id] === true

            return (
              <div key={section.id} className="bg-aura-base border border-aura-line rounded">
                <header className="flex items-center gap-1 px-1.5 py-1">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [section.id]: !isExpanded }))}
                    className="shrink-0 text-slate-600 hover:text-slate-300"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  <span
                    className="flex-1 min-w-0 truncate text-[11px] text-slate-200 cursor-help"
                    title={section.hint}
                  >
                    {section.label}
                  </span>

                  {section.toggleable && (
                    <button
                      onClick={() => setSectionEnabled(section.id, !isOn)}
                      className={`shrink-0 transition-colors ${
                        isOn ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-400'
                      }`}
                      title={isOn ? 'Disable' : 'Enable'}
                    >
                      <Power className="w-3 h-3" />
                    </button>
                  )}
                </header>

                {isExpanded && isOn && (
                  <div className="p-1.5 pt-0 space-y-1">
                    {section.descriptors.map((descriptor) => (
                      <ParamField
                        key={descriptor.key}
                        objectId={ENV_STACK_ID}
                        effectId={section.id}
                        descriptor={descriptor}
                        value={params[section.id]?.[descriptor.key]}
                        onChange={(value) => setParam(section.id, descriptor.key, value)}
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
