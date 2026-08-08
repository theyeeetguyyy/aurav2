import * as THREE from 'three'

/** A path through space for the camera to travel along.
 *
 *  The decomposition that matters: **the path is geometry, the timing is automation.** A waypoint
 *  list defines *where* the camera can go; a single `progress` parameter says *where along it* the
 *  camera is right now. Progress is an ordinary parameter, so it can be typed, drawn as a clip,
 *  or driven by a stem — and none of that had to be built here.
 *
 *  The alternative, baking times into the waypoints, is what makes camera paths miserable in
 *  every tool that does it: retiming a move means editing every waypoint, and the shape and the
 *  schedule cannot be edited independently. Blender's Follow Path constraint splits them the same
 *  way, for the same reason.
 *
 *  Catmull-Rom because it passes *through* its control points. A Bézier would need handles nobody
 *  asked for, and a camera path's control points are places you want the camera to actually be. */

export interface CameraWaypoint {
  id: string
  position: [number, number, number]
}

/** Fewest waypoints that describe a path. Two is a straight line, which is a legitimate move. */
export const MIN_PATH_WAYPOINTS = 2

/** How far ahead the aim samples when the camera looks along its direction of travel.
 *
 *  In progress units, not metres. A fixed distance would swing wildly between a short path and a
 *  long one; a fraction of the path is stable, and small enough that the aim tracks the curve
 *  rather than cutting across it. */
export const AIM_LOOKAHEAD = 0.01

/** Build a curve from waypoints, or null when there are too few.
 *
 *  Callers cache this — it allocates, and it only changes when the waypoints do. */
export function buildPath(
  waypoints: readonly CameraWaypoint[],
  closed = false,
): THREE.CatmullRomCurve3 | null {
  if (waypoints.length < MIN_PATH_WAYPOINTS) return null

  const points = waypoints.map(
    ({ position }) => new THREE.Vector3(position[0], position[1], position[2]),
  )
  // `centripetal` rather than the default `catmullrom`: uniform parameterisation overshoots and
  // loops when control points are unevenly spaced, which on a camera path reads as the camera
  // lurching sideways between two waypoints that looked fine.
  return new THREE.CatmullRomCurve3(points, closed, 'centripetal')
}

/** Position at `progress` along the path, written into `out`.
 *
 *  Progress wraps rather than clamps, so a closed path loops and an open one restarts — which is
 *  what a repeating clip driving progress needs. Pure in `progress`, so an out-of-order render
 *  reproduces exactly (HC-3). */
export function samplePath(
  curve: THREE.CatmullRomCurve3,
  progress: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  // `getPointAt` walks arc length rather than the raw parameter, so progress moves the camera at
  // a constant speed. Without it the camera speeds up wherever waypoints are far apart, which is
  // the opposite of what a spacing change should mean.
  return curve.getPointAt(wrap(progress), out)
}

/** A point slightly ahead, for aiming along the direction of travel. */
export function samplePathAhead(
  curve: THREE.CatmullRomCurve3,
  progress: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  return curve.getPointAt(wrap(progress + AIM_LOOKAHEAD), out)
}

/** 0–1, wrapping. Handles negative progress, which a bipolar modulation range can produce. */
function wrap(value: number): number {
  if (!Number.isFinite(value)) return 0
  const wrapped = value - Math.floor(value)
  // `getPointAt(1)` is valid, but floating error can produce 1 + ε; clamp the top.
  return Math.min(0.999999, Math.max(0, wrapped))
}

/** Total arc length, for the readout. Tells you whether a path is a nudge or a flight. */
export function pathLength(curve: THREE.CatmullRomCurve3): number {
  return curve.getLength()
}
