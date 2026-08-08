import { useMemo } from 'react'
import { Activity, Trash2 } from 'lucide-react'
import { CAMERA_STACK_ID } from '@/engine/camera/behaviours'
import {
  CAMERA_TRANSFORM_DESCRIPTORS,
  cameraAnimationRange,
} from '@/engine/camera/cameraTransform'
import { AUTOMATION_FIELD } from '@/engine/modulation/fields'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { projectDuration, useAudioStore } from '@/store/useAudioStore'
import { useAutomationStore } from '@/store/useAutomationStore'
import { useModulationStore } from '@/store/useModulationStore'
import { ClipLane } from '@/components/automation/ClipLane'
import { formatAddress, type ParamDescriptor } from '@/types/params'

/** Keyframing the camera — as clips, on lanes, wired to the camera's own parameters.
 *
 *  There is deliberately **no separate keyframe system**. A camera move is a curve over time, and
 *  the product already has curves over time: patterns, placed as clips, on lanes. Pressing
 *  *Animate* on a parameter creates a lane, wires it to that parameter, and hands you the same
 *  clip editor the stems use.
 *
 *  Which means, for free and without a second mechanism:
 *
 *  - **keyframes** — points in a pattern
 *  - **smooth motion** — the pattern's interpolation, including `step` for a snap
 *  - **reuse** — the same pattern placed at three points in the song, edited once
 *  - **modulation by the music** — the camera parameter is an ordinary routing target (D-64), so
 *    a stem lane can drive it *as well*, and the two sum through the normal weighted N:1
 *
 *  A dedicated keyframe editor would have had to agree with all of that, and would eventually
 *  not have. */
export function CameraTrack() {
  const tracks = useAudioStore((s) => s.tracks)
  const duration = Math.max(1, projectDuration(tracks))

  const allLanes = useAutomationStore((s) => s.lanes)
  const addLane = useAutomationStore((s) => s.addLane)
  const removeLane = useAutomationStore((s) => s.removeLane)

  const connections = useModulationStore((s) => s.connections)
  const connect = useModulationStore((s) => s.connect)

  /** One grid for everything, so a camera clip snaps to the same beats a stem clip does. */
  const beatGrid = useMemo(() => {
    for (const track of tracks) {
      const grid = AudioFeatures.getBeatGrid(track.id)
      if (grid.length > 0) return grid
    }
    return [] as number[]
  }, [tracks])

  /** The lane driving a camera parameter, if one exists.
   *
   *  Found through the *connection* rather than by lane name: the wire is the fact, and a name
   *  is a label someone can edit. */
  const laneFor = (descriptor: ParamDescriptor) => {
    const address = formatAddress({ objectId: CAMERA_STACK_ID, paramKey: descriptor.key })
    const wire = connections.find(
      (connection) =>
        formatAddress(connection.target) === address &&
        connection.source.kind === 'automation' &&
        connection.source.sourceId,
    )
    if (!wire) return null
    return allLanes.find((lane) => lane.id === wire.source.sourceId) ?? null
  }

  const animate = (descriptor: ParamDescriptor) => {
    const laneId = addLane(`Camera · ${descriptor.label}`)
    connect(
      { kind: 'automation', key: AUTOMATION_FIELD.key, sourceId: laneId },
      { objectId: CAMERA_STACK_ID, paramKey: descriptor.key },
      // A move's range, not the slider's — see `cameraAnimationRange`. Centred on zero, because
      // the chain adds its output to the authored value.
      cameraAnimationRange(descriptor.key),
    )
  }

  const animated = CAMERA_TRANSFORM_DESCRIPTORS.map((descriptor) => ({
    descriptor,
    lane: laneFor(descriptor),
  }))

  return (
    <section className="border-t border-aura-line flex flex-col min-h-0">
      <header className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
        <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">
          Animate over time
        </h3>
      </header>

      <div className="px-1.5 pb-1.5 space-y-1">
        {/* Parameters with nothing on them: one button each, and nothing else taking up room. */}
        <div className="flex flex-wrap gap-1">
          {animated
            .filter(({ lane }) => !lane)
            .map(({ descriptor }) => (
              <button
                key={descriptor.key}
                onClick={() => animate(descriptor)}
                title={`Give ${descriptor.label} a curve over time — keyframes, reusable and snappable`}
                className="flex items-center gap-1 h-5 px-1.5 rounded border border-aura-line text-[10px] leading-none text-slate-400 hover:text-slate-100 hover:border-slate-500 transition-colors"
              >
                <Activity className="w-2.5 h-2.5" />
                {descriptor.label}
              </button>
            ))}
        </div>

        {animated
          .filter(({ lane }) => lane)
          .map(({ descriptor, lane }) => (
            <div key={descriptor.key} className="rounded border border-aura-line">
              <div className="flex items-center gap-1.5 px-1.5 py-1">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: lane!.color }}
                />
                <span className="flex-1 text-[10px] text-slate-200">{descriptor.label}</span>
                <span className="text-[9px] font-mono text-slate-600">
                  {lane!.clips.length === 0
                    ? 'no clips yet'
                    : `${lane!.clips.length} clip${lane!.clips.length === 1 ? '' : 's'}`}
                </span>
                <button
                  onClick={() => removeLane(lane!.id)}
                  title="Stop animating this parameter. Its wire and clips go with it"
                  className="text-slate-600 hover:text-aura-hot transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div className="border-t border-aura-line px-1.5 py-1">
                <ClipLane lane={lane!} duration={duration} beatGrid={beatGrid} />
              </div>
            </div>
          ))}

      </div>
    </section>
  )
}
