import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Plus,
  Power,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { BEHAVIOUR_BRICKS, CAMERA_STACK_ID, getBehaviour } from '@/engine/camera/behaviours'
import {
  CAMERA_TRANSFORM_DEFAULTS,
  CAMERA_TRANSFORM_DESCRIPTORS,
  type CameraTransformKey,
} from '@/engine/camera/cameraTransform'
import { useCameraStore } from '@/store/useCameraStore'
import { useSceneStore } from '@/store/useSceneStore'
import { ParamField } from '@/components/scene/ParamField'

/** The Scene Camera: where it is, and what moves it.
 *
 *  Two layers, in that order. The **transform** is the camera itself — position, rotation
 *  and lens as ordinary parameters, so they can be typed, wired from a stem, or drawn as a
 *  curve on the automation lanes. That last one is what "keyframing the camera" means here:
 *  a lane against `position.z` is a dolly on a time axis, using the curve editor that
 *  already exists rather than a second one that would have to agree with it.
 *
 *  The **behaviour stack** then offsets that result — orbit, sway, handheld shake. Each is a
 *  pure function of clock time, so they sum and their order is cosmetic. They add to where
 *  you put the camera; they no longer are the only way to move it.
 *
 *  Motion in the Scene Camera also matters more than it looks: feedback trails and zoom blur
 *  are effects on *movement*, so they read as flat in the only view that renders unless
 *  something here is moving. */
export function CameraRigPanel() {
  const behaviours = useCameraStore((s) => s.behaviours)
  const lookAtId = useCameraStore((s) => s.lookAtId)
  const lookAtEnabled = useCameraStore((s) => s.lookAtEnabled)
  const addBehaviour = useCameraStore((s) => s.addBehaviour)
  const removeBehaviour = useCameraStore((s) => s.removeBehaviour)
  const reorderBehaviour = useCameraStore((s) => s.reorderBehaviour)
  const setEnabled = useCameraStore((s) => s.setBehaviourEnabled)
  const setParam = useCameraStore((s) => s.setBehaviourParam)
  const setLookAt = useCameraStore((s) => s.setLookAt)
  const setLookAtEnabled = useCameraStore((s) => s.setLookAtEnabled)
  const transform = useCameraStore((s) => s.transform)
  const setTransformParam = useCameraStore((s) => s.setTransformParam)
  const alignToPreview = useCameraStore((s) => s.alignToPreview)
  const resetTransform = useCameraStore((s) => s.resetTransform)

  const objects = useSceneStore((s) => s.objects)
  const [picking, setPicking] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-3 py-2 border-b border-aura-line shrink-0 space-y-1.5">
        <div className="flex items-center gap-1">
          <h2 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">
            Scene Camera
          </h2>
          <button
            onClick={resetTransform}
            className="text-slate-600 hover:text-slate-300 transition-colors"
            title="Reset the transform to its default framing"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Flying to a framing is faster than typing one, so this stays the primary gesture
            — it now writes the parameters rather than a hidden vector, which is why the
            fields below update when you press it. */}
        <button
          onClick={alignToPreview}
          className="w-full h-7 px-2 flex items-center gap-1.5 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded text-[11px] text-slate-300 transition-colors"
          title="Move the Scene Camera to exactly where the Preview Camera is looking"
        >
          <Crosshair className="w-3 h-3 text-aura-accent" />
          Align to this view
        </button>

        <label className="flex items-center justify-between gap-2 h-7 px-2 bg-aura-surface border border-aura-line rounded text-[11px]">
          <span className="text-slate-400 font-medium truncate">Look at</span>
          <select
            value={lookAtId ?? ''}
            onChange={(e) => setLookAt(e.target.value || null)}
            className="bg-transparent text-aura-accent text-[11px] outline-none cursor-pointer max-w-[60%] truncate"
          >
            <option value="" className="bg-aura-elevated">
              World origin
            </option>
            {objects.map((object) => (
              <option key={object.id} value={object.id} className="bg-aura-elevated">
                {object.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between h-7 px-2 bg-aura-surface border border-aura-line rounded text-[11px] cursor-pointer">
          <span className="text-slate-400 font-medium truncate">Aim at target</span>
          <input
            type="checkbox"
            checked={lookAtEnabled}
            onChange={(e) => setLookAtEnabled(e.target.checked)}
            className="accent-aura-accent"
          />
        </label>
        <p className="text-[10px] text-slate-600 leading-snug">
          Off holds the authored rotation — a locked-off shot. On tracks the target, even
          while it moves.
        </p>
      </header>

      {/* ─── Transform ─── */}
      <div className="px-1.5 py-1.5 border-b border-aura-line shrink-0 space-y-1">
        <h3 className="px-0.5 text-[10px] uppercase tracking-wider text-slate-500">Transform</h3>
        {CAMERA_TRANSFORM_DESCRIPTORS.map((descriptor) => (
          <ParamField
            key={descriptor.key}
            objectId={CAMERA_STACK_ID}
            descriptor={descriptor}
            value={
              transform[descriptor.key] ??
              CAMERA_TRANSFORM_DEFAULTS[descriptor.key as CameraTransformKey]
            }
            onChange={(value) =>
              typeof value === 'number' &&
              setTransformParam(descriptor.key as CameraTransformKey, value)
            }
          />
        ))}
        <p className="px-0.5 text-[10px] text-slate-600 leading-snug">
          Wire any of these from a stem on Routing, or draw one as a curve on Media &amp; Stems
          — that is a keyframed camera move.
        </p>
      </div>

      <div className="flex items-center justify-between px-2 py-1.5 shrink-0">
        <h3 className="text-[10px] uppercase tracking-wider text-slate-500">
          Behaviours · {behaviours.filter((b) => b.enabled).length} active
        </h3>
        <button
          onClick={() => setPicking((v) => !v)}
          className="text-slate-500 hover:text-aura-accent transition-colors"
          title="Add a behaviour"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-1">
        {picking && (
          <div className="p-1 bg-aura-base border border-aura-line rounded">
            {BEHAVIOUR_BRICKS.map((brick) => (
              <button
                key={brick.id}
                onClick={() => {
                  addBehaviour(brick.id)
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

        {behaviours.length === 0 && !picking && (
          <p className="text-[10px] text-slate-600 leading-snug py-1 px-1">
            Nothing on top of the transform. Behaviours are shapes of motion you do not want
            to draw by hand — a handheld shake, a slow orbit. They offset the transform above,
            so adding one never loses your framing.
          </p>
        )}

        {behaviours.map((behaviour, index) => {
          const brick = getBehaviour(behaviour.effectId)
          if (!brick) return null
          const isCollapsed = collapsed[behaviour.id] === true

          return (
            <div key={behaviour.id} className="bg-aura-base border border-aura-line rounded">
              <header className="flex items-center gap-1 px-1.5 py-1 group">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [behaviour.id]: !isCollapsed }))}
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
                  {behaviour.name}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => reorderBehaviour(behaviour.id, -1)}
                    disabled={index === 0}
                    className="text-slate-500 hover:text-slate-200 disabled:text-slate-800"
                    title="Move earlier"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => reorderBehaviour(behaviour.id, 1)}
                    disabled={index === behaviours.length - 1}
                    className="text-slate-500 hover:text-slate-200 disabled:text-slate-800"
                    title="Move later"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() => setEnabled(behaviour.id, !behaviour.enabled)}
                  className={`shrink-0 transition-colors ${
                    behaviour.enabled ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title={behaviour.enabled ? 'Disable' : 'Enable'}
                >
                  <Power className="w-3 h-3" />
                </button>
                <button
                  onClick={() => removeBehaviour(behaviour.id)}
                  className="shrink-0 text-slate-600 hover:text-aura-hot transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </header>

              {behaviour.enabled && !isCollapsed && (
                <div className="p-1.5 pt-0 space-y-1">
                  {brick.descriptors.map((descriptor) => (
                    <ParamField
                      key={descriptor.key}
                      objectId={CAMERA_STACK_ID}
                      effectId={behaviour.id}
                      descriptor={descriptor}
                      value={behaviour.params[descriptor.key]}
                      onChange={(value) => setParam(behaviour.id, descriptor.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
