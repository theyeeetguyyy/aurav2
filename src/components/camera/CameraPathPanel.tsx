import { useMemo } from 'react'
import { ChevronDown, ChevronUp, MapPin, Repeat, Trash2 } from 'lucide-react'
import { buildPath, pathLength, MIN_PATH_WAYPOINTS } from '@/engine/camera/cameraPath'
import { useCameraStore } from '@/store/useCameraStore'
import { useAutomationStore } from '@/store/useAutomationStore'
import { useModulationStore } from '@/store/useModulationStore'
import { CAMERA_STACK_ID } from '@/engine/camera/behaviours'
import { AUTOMATION_FIELD } from '@/engine/modulation/fields'
import { rampPattern } from '@/engine/automation/lane'
import { projectDuration, useAudioStore } from '@/store/useAudioStore'

/** The camera path: a list of places, in order.
 *
 *  No times here, on purpose. A waypoint says *where*; the Follow Path behaviour's `progress`
 *  parameter says *where along it*, and progress is automatable like anything else — so the shape
 *  and the schedule are edited independently. Baking times into waypoints is what makes camera
 *  paths miserable elsewhere: retiming a move means editing every point.
 *
 *  Waypoints are captured from the preview camera rather than typed. Flying somewhere and pressing
 *  a button is how anyone actually decides where a camera should be, and it needs no numbers. */
export function CameraPathPanel() {
  const waypoints = useCameraStore((s) => s.waypoints)
  const pathClosed = useCameraStore((s) => s.pathClosed)
  const addWaypointHere = useCameraStore((s) => s.addWaypointHere)
  const removeWaypoint = useCameraStore((s) => s.removeWaypoint)
  const reorderWaypoint = useCameraStore((s) => s.reorderWaypoint)
  const setPathClosed = useCameraStore((s) => s.setPathClosed)
  const behaviours = useCameraStore((s) => s.behaviours)
  const addBehaviour = useCameraStore((s) => s.addBehaviour)
  const addLane = useAutomationStore((s) => s.addLane)
  const addClip = useAutomationStore((s) => s.addClip)
  const setPatternPoints = useAutomationStore((s) => s.setPatternPoints)
  const connect = useModulationStore((s) => s.connect)
  const duration = projectDuration(useAudioStore((s) => s.tracks))

  const length = useMemo(() => {
    const curve = buildPath(waypoints, pathClosed)
    return curve ? pathLength(curve) : 0
  }, [waypoints, pathClosed])

  const following = behaviours.some((b) => b.effectId === 'cam-follow-path')
  const ready = waypoints.length >= MIN_PATH_WAYPOINTS

  /** Add the behaviour AND give its progress a ramp across the song.
   *
   *  Adding the behaviour alone leaves `progress` at 0 with nothing driving it, so the camera sits
   *  at the first waypoint and the path appears not to work. A move from start to end over the
   *  whole song is the obvious reading of "follow this path", and everything about it — the length,
   *  the shape, the easing — is then an ordinary clip to edit. */
  const followPath = () => {
    addBehaviour('cam-follow-path')

    const laneId = addLane('Camera · Path progress')
    connect(
      { kind: 'automation', key: AUTOMATION_FIELD.key, sourceId: laneId },
      { objectId: CAMERA_STACK_ID, effectId: undefined, paramKey: 'progress' },
      { min: 0, max: 1 },
    )

    const clipId = addClip(laneId, 0, Math.max(1, duration))
    const patternId = clipId
      ? useAutomationStore.getState().lanes.find((l) => l.id === laneId)?.clips.find((c) => c.id === clipId)
          ?.patternId
      : null
    if (patternId) setPatternPoints(patternId, rampPattern(0, 1))
  }

  return (
    <section className="border-t border-aura-line flex flex-col min-h-0">
      <header className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
        <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">Path</h3>
        {length > 0 && (
          <span className="text-[9px] font-mono tabular-nums text-slate-600">
            {length.toFixed(1)} m
          </span>
        )}
        <button
          onClick={() => setPathClosed(!pathClosed)}
          title={pathClosed ? 'Path loops — click to open it' : 'Path is open — click to loop it'}
          className={`transition-colors ${
            pathClosed ? 'text-aura-accent' : 'text-slate-600 hover:text-slate-300'
          }`}
        >
          <Repeat className="w-3 h-3" />
        </button>
      </header>

      <div className="px-1.5 pb-1.5 space-y-1">
        <button
          onClick={addWaypointHere}
          title="Add a waypoint where the Preview Camera is now"
          className="w-full h-6 flex items-center justify-center gap-1.5 rounded border border-aura-line text-[10px] text-slate-300 hover:border-slate-500 transition-colors"
        >
          <MapPin className="w-3 h-3 text-aura-accent" />
          Add waypoint here
        </button>


        {waypoints.map((waypoint, index) => (
          <div key={waypoint.id} className="group flex items-center gap-1 px-0.5">
            <span className="w-4 shrink-0 text-[9px] font-mono text-slate-600">{index + 1}</span>
            <span className="flex-1 text-[10px] font-mono tabular-nums text-slate-400 truncate">
              {waypoint.position.map((n) => n.toFixed(1)).join(', ')}
            </span>
            <button
              onClick={() => reorderWaypoint(waypoint.id, -1)}
              disabled={index === 0}
              className="text-slate-600 hover:text-slate-200 disabled:text-slate-800"
              title="Earlier along the path"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => reorderWaypoint(waypoint.id, 1)}
              disabled={index === waypoints.length - 1}
              className="text-slate-600 hover:text-slate-200 disabled:text-slate-800"
              title="Later along the path"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => removeWaypoint(waypoint.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-aura-hot transition-all"
              title="Remove this waypoint"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* A path with nothing reading it does nothing, and that is not obvious from looking at
            it — so say so, and offer the one click that fixes it. */}
        {ready && !following && (
          <button
            onClick={followPath}
            className="w-full h-6 flex items-center justify-center rounded border border-aura-accent text-[10px] text-aura-accent hover:bg-aura-surface transition-colors"
          >
            Follow this path
          </button>
        )}
      </div>
    </section>
  )
}
