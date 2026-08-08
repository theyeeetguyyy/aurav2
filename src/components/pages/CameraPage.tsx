import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'
import { CameraRigPanel } from '@/components/camera/CameraRigPanel'
import { CameraPathPanel } from '@/components/camera/CameraPathPanel'
import { CameraTrack } from '@/components/camera/CameraTrack'

/** Workspace 5 — Camera.
 *
 *  Same scene as Scene & Shapes, viewed through the same renderer (HC-9).
 *
 *  Left is the Scene Camera: its transform as ordinary parameters, then the behaviour stack
 *  that offsets them. Keyframing needs no separate system — the transform is a routing
 *  target, so an automation lane drawn against `position.z` *is* a dolly on a time axis.
 *
 *  Spline paths are still to come, and belong as a behaviour brick that reads a curve
 *  rather than as a parallel way to own the camera. */
export function CameraPage() {
  return (
    <WorkspaceLayout
      left={<CameraRigPanel />}
      center={<ViewportSlot cameraGizmos />}
      // Right, not left: the transform and the behaviour stack say where the camera IS, and these
      // two say how it MOVES. Two questions, two columns.
      right={
        <div className="h-full overflow-y-auto">
          <CameraPathPanel />
          <CameraTrack />
        </div>
      }
    />
  )
}
