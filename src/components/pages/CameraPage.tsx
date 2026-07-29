import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { WorkspaceLayout } from '@/components/shell/WorkspaceLayout'

/** Workspace 4 — Camera.
 *
 *  Same scene as Scene & Shapes, viewed through the same renderer (HC-9). Spline gizmo,
 *  keyframe list and constraint stack land in Phase 7. */
export function CameraPage() {
  return <WorkspaceLayout center={<ViewportSlot />} />
}
