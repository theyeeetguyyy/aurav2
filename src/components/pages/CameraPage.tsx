import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { CameraRigPanel } from '@/components/camera/CameraRigPanel'

/** Workspace 5 — Camera.
 *
 *  Same scene as Scene & Shapes, viewed through the same renderer (HC-9).
 *
 *  Left is the Scene Camera's behaviour stack — the declarative half of Phase 7, which
 *  needs no timeline because every behaviour is a pure function of clock time. Spline
 *  waypoints, keyframes and easing land with Phase 6, since a keyframe needs a time axis
 *  to sit on. */
export function CameraPage() {
  return <WorkspaceLayout left={<CameraRigPanel />} center={<ViewportSlot />} />
}
