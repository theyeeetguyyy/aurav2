import { ViewportSlot } from '@/components/viewport/ViewportSlot'
import { Timeline } from '@/components/timeline/Timeline'

/** Workspace 6 — Timeline. Where the video gets its shape.
 *
 *  A page of its own rather than a half of Deliver, because arranging and encoding are two
 *  different jobs and sharing a page made the second one look like the point. The pipeline
 *  reads left to right across the tabs:
 *
 *    **Media & Stems** — pull automation out of the audio
 *    **Scene & Shapes** — build a state: what is in the scene and what drives it
 *    **Look / Routing / Camera** — refine that state
 *    **Timeline** — arrange states in time. *This* is the video
 *    **Deliver** — write the file
 *
 *  So the monitor is the largest thing here, and it is the finished frame: the timeline
 *  resolves which state is live at the playhead, so scrubbing across a cut shows the cut. It
 *  is also load-bearing — the exporter drives the live renderer (HC-9), and both this page
 *  and Deliver must host a viewport for it to have anything to drive (D-67).
 *
 *  Camera motion in time lands here too (Phase 7): a camera move belongs on the same time
 *  axis as the cuts it has to work with, not in a separate editor that cannot see them. */
export function TimelinePage() {
  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Non-interactive: dragging in a monitor while placing strips would fly the preview
          camera, which is never what the gesture meant. */}
      <div className="flex-1 min-h-[180px] border-b border-aura-line">
        {/* Camera gizmos, so you can see where the Scene Camera is at this point in the cut. The
            HUD comes with them, for the Scene/Preview toggle. */}
        <ViewportSlot interactive={false} cameraGizmos />
      </div>

      {/* Fixed height, like every NLE. Given the rest of the column the lanes floated in a
          few hundred pixels of empty track. */}
      <div className="h-[268px] shrink-0">
        <Timeline />
      </div>
    </div>
  )
}
