import type { LaneInterpolation } from '@/engine/automation/lane'

/** The three modes the sampler implements, with the reason each exists.
 *
 *  Shared between the stem curve and the drawn curve so the vocabulary cannot drift — the
 *  same three modes described two different ways is how "Flat" ended up meaning a preset in
 *  one panel and an interpolation in another. */
export const INTERPOLATIONS: { value: LaneInterpolation; label: string; hint: string }[] = [
  {
    value: 'smooth',
    label: 'Smooth',
    hint: 'Flat entering and leaving each point — the default, and what a hand-drawn curve should feel like',
  },
  {
    value: 'linear',
    label: 'Linear',
    hint: 'Straight ramps. Predictable, and right for a steady sweep',
  },
  {
    value: 'step',
    label: 'Step',
    hint: 'Holds, then jumps. This is how you draw a snap — a zoom that hits rather than eases',
  },
]
