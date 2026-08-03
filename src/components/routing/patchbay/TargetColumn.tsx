import { useCallback, useSyncExternalStore } from 'react'
import { useSceneStore } from '@/store/useSceneStore'
import { useModulationStore } from '@/store/useModulationStore'
import { usePostStore } from '@/store/usePostStore'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
import { allModulationTargets, readParam, resolveDescriptor } from '@/engine/params/ParamRegistry'
import { PostRegistry } from '@/engine/post/PostRegistry'
import { ENV_SECTIONS, ENV_STACK_ID } from '@/engine/environment/sections'
import { CAMERA_STACK_ID, getBehaviour } from '@/engine/camera/behaviours'
import { useCameraStore } from '@/store/useCameraStore'
import { connectionRange, reachableRange } from '@/engine/modulation/preview'
import { TransportClock } from '@/engine/time/TransportClock'
import { isTrackVisuallyActive } from '@/store/useAudioStore'
import { getGenerator } from '@/store/useGeneratorStore'
import { getLane } from '@/store/useAutomationStore'
import { unitSuffix } from '@/utils/units'
import { formatAddress, type ParamAddress, type ParamDescriptor } from '@/types/params'
import { registerAnchor, targetAnchorId } from './anchors'
import { getDrag, subscribeDrag } from './dragState'
import { POST_STACK_ID, type SceneObject } from '@/types/visual'

/** Right column — every parameter that can be driven, grouped by object.
 *
 *  Includes deformer parameters, which is where the interesting routings live: those are
 *  the only geometry-changing values drivable at frame rate (D-31/D-33). The post chain
 *  appears as one more group; because it addresses itself with a reserved object id, it
 *  needed no special case here beyond knowing where to read its descriptors from. */
export function TargetColumn() {
  const objects = useSceneStore((s) => s.objects)
  const postEffects = usePostStore((s) => s.effects)

  if (objects.length === 0 && postEffects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-[11px] text-slate-600 text-center leading-snug">
          No objects yet.
          <br />
          Add a shape in Scene &amp; Shapes.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {objects.map((object) => (
        <ObjectTargets key={object.id} object={object} />
      ))}
      {postEffects.length > 0 && <PostTargets />}
      <CameraTargets />
      <WorldTargets />
    </div>
  )
}

/** Camera behaviour knobs. Shake amplitude on the kick is the single routing that makes
 *  the whole post chain read, because feedback and zoom blur are effects on motion. */
function CameraTargets() {
  const behaviours = useCameraStore((s) => s.behaviours)
  if (behaviours.length === 0) return null

  return (
    <section className="border-b border-aura-line pb-1">
      <header className="px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <h3 className="text-[11px] font-medium text-slate-200 truncate">Camera</h3>
      </header>

      {behaviours.map((behaviour) => {
        const brick = getBehaviour(behaviour.effectId)
        if (!brick) return null

        return brick.descriptors
          .filter((descriptor) => descriptor.exposed && descriptor.realtime)
          .map((descriptor) => {
            const raw = behaviour.params[descriptor.key]
            return (
              <TargetRow
                key={`${behaviour.id}/${descriptor.key}`}
                address={{
                  objectId: CAMERA_STACK_ID,
                  effectId: behaviour.id,
                  paramKey: descriptor.key,
                }}
                descriptor={descriptor}
                base={typeof raw === 'number' ? raw : Number(descriptor.defaultValue)}
                label={descriptor.label}
                ownerLabel={behaviour.name}
              />
            )
          })
      })}
    </section>
  )
}

/** Background intensity, fog density and light angles. Always present — the world exists
 *  whether or not anything has been added to the scene. */
function WorldTargets() {
  const params = useEnvironmentStore((s) => s.params)
  const disabled = useEnvironmentStore((s) => s.disabled)

  return (
    <section className="border-b border-aura-line pb-1">
      <header className="px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <h3 className="text-[11px] font-medium text-slate-200 truncate">World</h3>
      </header>

      {ENV_SECTIONS.filter((section) => disabled[section.id] !== true).map((section) =>
        section.descriptors
          .filter((descriptor) => descriptor.exposed && descriptor.realtime)
          .map((descriptor) => {
            const raw = params[section.id]?.[descriptor.key]
            return (
              <TargetRow
                key={`${section.id}/${descriptor.key}`}
                address={{
                  objectId: ENV_STACK_ID,
                  effectId: section.id,
                  paramKey: descriptor.key,
                }}
                descriptor={descriptor}
                base={typeof raw === 'number' ? raw : Number(descriptor.defaultValue)}
                label={descriptor.label}
                ownerLabel={section.label}
              />
            )
          }),
      )}
    </section>
  )
}

function ObjectTargets({ object }: { object: SceneObject }) {
  const targets = allModulationTargets(object)

  return (
    <section className="border-b border-aura-line pb-1">
      <header className="px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <h3 className="text-[11px] font-medium text-slate-200 truncate">{object.name}</h3>
      </header>

      {targets.map((entry) => {
        const address: ParamAddress = {
          objectId: object.id,
          effectId: entry.effectId,
          paramKey: entry.descriptor.key,
        }
        const raw = readParam(object, address)
        return (
          <TargetRow
            key={`${entry.effectId ?? ''}/${entry.descriptor.key}`}
            address={address}
            descriptor={resolveDescriptor(object, address)}
            base={typeof raw === 'number' ? raw : 0}
            label={entry.descriptor.label}
            ownerLabel={entry.ownerLabel}
          />
        )
      })}
    </section>
  )
}

/** The post chain's knobs. Bloom intensity on the kick and kaleidoscope segments on a
 *  generator are among the highest-impact routings available, so they belong in the same
 *  list as everything else rather than behind their own panel. */
function PostTargets() {
  const effects = usePostStore((s) => s.effects)

  return (
    <section className="border-b border-aura-line pb-1">
      <header className="px-2 py-1.5 sticky top-0 bg-aura-base z-10">
        <h3 className="text-[11px] font-medium text-slate-200 truncate">Post</h3>
      </header>

      {effects.map((effect) => {
        const brick = PostRegistry.get(effect.effectId)
        if (!brick) return null

        return brick.descriptors
          .filter((descriptor) => descriptor.exposed && descriptor.realtime)
          .map((descriptor) => {
            const raw = effect.params[descriptor.key]
            return (
              <TargetRow
                key={`${effect.id}/${descriptor.key}`}
                address={{
                  objectId: POST_STACK_ID,
                  effectId: effect.id,
                  paramKey: descriptor.key,
                }}
                descriptor={descriptor}
                base={typeof raw === 'number' ? raw : Number(descriptor.defaultValue)}
                label={descriptor.label}
                ownerLabel={effect.name}
              />
            )
          })
      })}
    </section>
  )
}

/** Coarse "is a drag happening" flag. The cursor position is NOT in React — only this
 *  boolean is, so rows can show they are droppable. */
function useDragActive(): boolean {
  return useSyncExternalStore(
    (onChange) => subscribeDrag(() => onChange()),
    () => getDrag() !== null,
    () => false,
  )
}

interface TargetRowProps {
  address: ParamAddress
  /** Resolved by the caller — a row needs metadata, not the thing that owns it. */
  descriptor: ParamDescriptor | null
  base: number
  label: string
  ownerLabel?: string
}

function TargetRow({ address, descriptor, base, label, ownerLabel }: TargetRowProps) {
  const id = targetAnchorId(address)
  const key = formatAddress(address)
  const dragging = useDragActive()

  const connections = useModulationStore((s) => s.connections)
  const triggers = useModulationStore((s) => s.triggers)
  const wired = connections.filter((c) => formatAddress(c.target) === key)
  const count = wired.length + triggers.filter((t) => formatAddress(t.target) === key).length

  // The whole point of the routing page is answering "what will this actually do".
  // Show the real span in the parameter's own units, not an abstract 0–1.
  const unit = unitSuffix(descriptor)
  const decimals = descriptor && descriptor.step >= 1 ? 0 : 2

  let low = base
  let high = base
  for (const connection of wired) {
    // The range the signal ACTUALLY reaches, not the range the settings allow. A stem's
    // envelope rarely spans the full 0–1, so the two answers differ a lot — and only one
    // of them describes what the viewer will see. Falls back to the declared span while
    // analysis is still running.
    const actual =
      reachableRange(connection, base, TransportClock.duration, {
        isTrackActive: isTrackVisuallyActive,
        getGenerator,
        getLane,
      }) ?? connectionRange(connection, base)

    // Multiple wires sum onto one parameter (weighted N:1), so the reachable span is
    // the sum of their extremes rather than the widest single one.
    low += actual.low - base
    high += actual.high - base
  }

  const attach = useCallback(
    (element: HTMLSpanElement | null) => registerAnchor(id, element),
    [id],
  )

  return (
    <div
      // Drop detection reads this attribute via elementFromPoint, so the whole row is a
      // target rather than just the dot — a 2px hit area would be miserable to aim at.
      data-target-id={key}
      className={[
        'group flex items-center gap-1.5 pl-2 pr-3 py-0.5 transition-colors',
        dragging
          ? 'bg-aura-surface/40 hover:bg-aura-accent/20 ring-1 ring-inset ring-aura-accent/30'
          : 'hover:bg-aura-surface',
      ].join(' ')}
    >
      <span
        ref={attach}
        className={[
          'w-2 h-2 rounded-full shrink-0 transition-colors',
          count > 0 ? 'bg-aura-accent' : 'bg-slate-700 group-hover:bg-slate-500',
        ].join(' ')}
      />
      <span
        className={`flex-1 min-w-0 truncate text-[10px] ${
          count > 0 ? 'text-slate-200' : 'text-slate-400'
        }`}
      >
        {ownerLabel && <span className="text-aura-accent">{ownerLabel} · </span>}
        {label}
      </span>

      {wired.length > 0 ? (
        <span
          className="text-[9px] font-mono tabular-nums text-slate-500 shrink-0"
          title={`${label} moves between these values`}
        >
          {low.toFixed(decimals)}
          <span className="text-slate-700 mx-0.5">→</span>
          <span className="text-aura-accent">{high.toFixed(decimals)}</span>
          {unit}
        </span>
      ) : (
        count > 0 && (
          <span className="text-[9px] font-mono tabular-nums text-slate-600 shrink-0">{count}</span>
        )
      )}
    </div>
  )
}
