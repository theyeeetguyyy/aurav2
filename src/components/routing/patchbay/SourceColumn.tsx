import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, Waves, PenLine } from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { useGeneratorStore } from '@/store/useGeneratorStore'
import { GENERATOR_TYPES, type GeneratorType } from '@/types/generator'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { TransportClock } from '@/engine/time/TransportClock'
import {
  AUDIO_FIELDS,
  AUTOMATION_FIELD,
  GENERATOR_FIELD,
  RHYTHM_FIELDS,
} from '@/engine/modulation/fields'
import { useAutomationStore } from '@/store/useAutomationStore'
import type { FeatureKey } from '@/engine/audio/featureTypes'
import type { FieldRef } from '@/types/params'
import { StemSignalStrip } from './StemSignalStrip'
import { registerAnchor, sourceAnchorId } from './anchors'
import { beginDrag } from './dragState'

interface SourceColumnProps {
  onDragStart: (field: FieldRef, event: React.PointerEvent) => void
}

/** Left column of the patchbay — every Field that can drive something.
 *
 *  Each dot is a drag handle. Press and drag one onto a parameter to connect: one
 *  gesture instead of the five-step dropdown flow it replaces (11-ROUTING-UX.md). */
export function SourceColumn({ onDragStart }: SourceColumnProps) {
  const tracks = useAudioStore((s) => s.tracks)

  return (
    <div className="h-full overflow-y-auto">
      {tracks.length === 0 && (
        <p className="text-[11px] text-slate-600 p-3 leading-snug">
          No stems imported. Add them in Media &amp; Stems — generative Fields below work
          without audio.
        </p>
      )}

      {tracks.map((track) => (
        <Group key={track.id}>
          <StemHeader trackId={track.id} name={track.name} color={track.color} />
          {/* The stem's own signal — the shape everything wired from it inherits. */}
          <StemSignalStrip trackId={track.id} color={track.color} />

          {/* This stem's editable curve, first: it is the one most routings should use,
              because it is the only source you can reshape when the analysis is wrong. */}
          <StemLaneDot track={track} onDragStart={onDragStart} />

          {AUDIO_FIELDS.map((option) => (
            <SourceDot
              key={option.key}
              label={option.label}
              field={{ kind: 'audio', key: option.key, sourceId: track.id }}
              color={track.color}
              onDragStart={onDragStart}
              meterKey={option.key as FeatureKey}
              trackId={track.id}
            />
          ))}
          {RHYTHM_FIELDS.map((option) => (
            <SourceDot
              key={option.key}
              label={option.label}
              field={{ kind: 'rhythm', key: option.key, sourceId: track.id }}
              color="var(--color-aura-node-processor)"
              onDragStart={onDragStart}
            />
          ))}
        </Group>
      ))}

      <AutomationSection onDragStart={onDragStart} />
      <GeneratorSection onDragStart={onDragStart} />
    </div>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return <section className="border-b border-aura-line pb-1">{children}</section>
}

/** Stem name plus detected tempo. Tempo arrives asynchronously after import. */
function StemHeader({ trackId, name, color }: { trackId: string; name: string; color: string }) {
  const bpmRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const update = () => {
      if (!bpmRef.current) return
      const bpm = AudioFeatures.getBpm(trackId)
      bpmRef.current.textContent = bpm
        ? `${bpm} BPM`
        : AudioFeatures.has(trackId)
          ? 'no tempo'
          : 'analysing…'
    }
    update()
    return AudioFeatures.onProgress((id) => id === trackId && update())
  }, [trackId])

  return (
    <header className="flex items-center gap-1.5 px-2 py-1.5 sticky top-0 bg-aura-base z-10">
      <span className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <h3 className="flex-1 min-w-0 truncate text-[11px] font-medium text-slate-200">{name}</h3>
      <span ref={bpmRef} className="text-[9px] font-mono tabular-nums text-slate-600 shrink-0" />
    </header>
  )
}

interface SourceDotProps {
  label: string
  field: FieldRef
  color: string
  onDragStart: (field: FieldRef, event: React.PointerEvent) => void
  meterKey?: FeatureKey
  trackId?: string
}

function SourceDot({ label, field, color, onDragStart, meterKey, trackId }: SourceDotProps) {
  const id = sourceAnchorId(field)
  const dotRef = useRef<HTMLSpanElement>(null)
  const meterRef = useRef<HTMLDivElement>(null)

  const attach = useCallback(
    (element: HTMLSpanElement | null) => {
      dotRef.current = element
      registerAnchor(id, element)
    },
    [id],
  )

  // Live level behind the label. Imperative — a meter per metric per stem re-rendering
  // through React would be dozens of components at frame rate (HC-1).
  useEffect(() => {
    if (!meterKey || !trackId) return
    const bar = meterRef.current
    if (!bar) return

    const apply = (time: number) => {
      bar.style.transform = `scaleX(${AudioFeatures.sample(trackId, meterKey, time)})`
    }
    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [meterKey, trackId])

  return (
    <div
      className="group relative flex items-center gap-1.5 pl-3 pr-2 py-0.5 hover:bg-aura-surface cursor-grab active:cursor-grabbing select-none"
      onPointerDown={(e) => {
        e.preventDefault()
        beginDrag(field, id, 0, 0)
        onDragStart(field, e)
      }}
      title="Drag onto a parameter to connect" 
    >
      {meterKey && (
        <div
          ref={meterRef}
          className="absolute inset-y-0 left-0 origin-left opacity-15 pointer-events-none"
          style={{ backgroundColor: color, transform: 'scaleX(0)' }}
        />
      )}
      <span className="relative flex-1 min-w-0 truncate text-[10px] text-slate-400 group-hover:text-slate-200">
        {label}
      </span>
      {/* The anchor the wire actually leaves from. */}
      <span
        ref={attach}
        className="relative w-2 h-2 rounded-full shrink-0 ring-2 ring-transparent group-hover:ring-white/20 transition-all"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

/** The stem's own automation curve, shown inside its group. */
function StemLaneDot({
  track,
  onDragStart,
}: {
  track: { id: string; color: string }
  onDragStart: SourceColumnProps['onDragStart']
}) {
  const lane = useAutomationStore((s) => s.lanes.find((l) => l.source?.trackId === track.id))
  if (!lane) return null

  return (
    <SourceDot
      label={`Automation${lane.mode === 'edited' ? ' · edited' : ''}`}
      field={{ kind: 'automation', key: AUTOMATION_FIELD.key, sourceId: lane.id }}
      color={track.color}
      onDragStart={onDragStart}
    />
  )
}

/** Detached lanes only. A stem's own curve appears inside that stem's group instead,
 *  because that is where it belongs — it is that stem's signal, not a separate one. */
function AutomationSection({ onDragStart }: SourceColumnProps) {
  // Select the raw array and narrow it OUTSIDE the selector. A selector that returns
  // `.filter(...)` allocates a new array on every call, so Zustand's equality check can
  // never pass — React re-renders, the selector runs again, and the component loops
  // until "Maximum update depth exceeded". The console names it: "the result of
  // getSnapshot should be cached".
  const allLanes = useAutomationStore((s) => s.lanes)
  const lanes = useMemo(() => allLanes.filter((l) => !l.source), [allLanes])
  if (lanes.length === 0) return null

  return (
    <Group>
      <header className="flex items-center gap-1.5 px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <PenLine className="w-3 h-3 text-aura-node-parameter shrink-0" />
        <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">Drawn</h3>
      </header>

      {lanes.map((lane) => (
        <SourceDot
          key={lane.id}
          label={lane.name}
          field={{ kind: 'automation', key: AUTOMATION_FIELD.key, sourceId: lane.id }}
          color={lane.color}
          onDragStart={onDragStart}
        />
      ))}
    </Group>
  )
}

/** Generators — synthetic stems. Deformers have no built-in motion (D-36), so anything
 *  that should move on its own is driven from one of these. */
function GeneratorSection({ onDragStart }: SourceColumnProps) {
  const generators = useGeneratorStore((s) => s.generators)
  const addGenerator = useGeneratorStore((s) => s.addGenerator)
  const removeGenerator = useGeneratorStore((s) => s.removeGenerator)
  const updateGenerator = useGeneratorStore((s) => s.updateGenerator)

  return (
    <Group>
      <header className="flex items-center gap-1.5 px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <Waves className="w-3 h-3 text-aura-node-parameter shrink-0" />
        <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">Generators</h3>
        <button
          onClick={() => addGenerator()}
          className="text-slate-500 hover:text-aura-accent transition-colors"
          title="Add a generator — an LFO or noise source you can wire like a stem"
        >
          <Plus className="w-3 h-3" />
        </button>
      </header>

      {generators.length === 0 && (
        <p className="px-3 pb-1 text-[10px] text-slate-600 leading-snug">
          Add one to drive motion that isn't in your stems.
        </p>
      )}

      {generators.map((generator) => (
        <div key={generator.id} className="group/gen">
          <div className="flex items-center gap-1 px-2 py-0.5">
            <select
              value={generator.type}
              onChange={(e) =>
                updateGenerator(generator.id, { type: e.target.value as GeneratorType })
              }
              className="flex-1 min-w-0 bg-transparent text-[10px] text-slate-300 outline-none cursor-pointer"
            >
              {GENERATOR_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-aura-elevated">
                  {t.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0.01}
              max={20}
              step={0.05}
              value={generator.rate}
              onChange={(e) =>
                updateGenerator(generator.id, { rate: Number(e.target.value) || 0.01 })
              }
              className="w-14 shrink-0 bg-aura-surface border border-aura-line rounded px-1 text-[10px] font-mono tabular-nums text-aura-accent outline-none focus:border-aura-focus"
              title="Rate in Hz"
            />
            <span className="text-[9px] text-slate-600">Hz</span>

            <button
              onClick={() => removeGenerator(generator.id)}
              className="ml-auto opacity-0 group-hover/gen:opacity-100 text-slate-600 hover:text-aura-hot transition-all"
              title="Remove generator"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          <SourceDot
            label={generator.name}
            field={{ kind: 'generative', key: GENERATOR_FIELD.key, sourceId: generator.id }}
            color={generator.color}
            onDragStart={onDragStart}
          />
        </div>
      ))}
    </Group>
  )
}
