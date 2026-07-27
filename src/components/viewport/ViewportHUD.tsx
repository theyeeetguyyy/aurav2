import { useCameraStore } from '@/store/useCameraStore'
import type { CameraControlMode, CameraMode } from '@/types/camera'

/** Viewport overlay: corner reticles plus the camera mode switcher.
 *
 *  Flat and opaque — no backdrop blur. Per docs/05-DESIGN-SYSTEM.md §1, glassmorphism
 *  is banned: it burns GPU budget the viewport needs and hurts legibility of dense
 *  numeric data. */
export function ViewportHUD() {
  const activeCamera = useCameraStore((s) => s.activeCamera)
  const controlMode = useCameraStore((s) => s.controlMode)
  const setActiveCamera = useCameraStore((s) => s.setActiveCamera)
  const setControlMode = useCameraStore((s) => s.setControlMode)

  return (
    <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between select-none z-10">
      <div className="flex items-start justify-between">
        <Reticle glyph="┌" />
        <Reticle glyph="┐" />
      </div>

      <div className="flex items-end justify-between gap-2">
        <Reticle glyph="└" />

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Which camera renders the viewport. Scene Camera is the render camera. */}
          <SegmentedControl<CameraMode>
            value={activeCamera}
            onChange={setActiveCamera}
            options={[
              {
                value: 'scene',
                label: 'SCENE CAM',
                title: 'Locked render camera — this is what exports',
              },
              {
                value: 'preview',
                label: 'PREVIEW',
                title: 'Free authoring camera — never affects the render',
              },
            ]}
          />

          {/* Control scheme for the preview camera. Mutually exclusive by design. */}
          {activeCamera === 'preview' && (
            <SegmentedControl<CameraControlMode>
              value={controlMode}
              onChange={setControlMode}
              options={[
                {
                  value: 'orbit',
                  label: 'ORBIT',
                  title: 'Orbit the origin — best for composing a static shot',
                },
                {
                  value: 'fly',
                  label: 'FLY',
                  title: 'WASD + Q/E, Shift to boost, drag to look around',
                },
              ]}
            />
          )}
        </div>

        <Reticle glyph="┘" />
      </div>
    </div>
  )
}

function Reticle({ glyph }: { glyph: string }) {
  return <div className="text-slate-600 font-mono text-xs leading-none">{glyph}</div>
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; title: string }[]
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex items-center gap-1 p-1 bg-aura-base border border-aura-line rounded text-[10px] font-mono">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          title={option.title}
          className={`px-2 py-0.5 rounded transition-colors duration-150 ${
            value === option.value
              ? 'bg-aura-accent text-white font-medium'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
