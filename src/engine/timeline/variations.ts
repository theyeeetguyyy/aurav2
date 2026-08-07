import type { SectionMarker, SectionType } from '@/types/project'

/** Turning one scene into a sequence.
 *
 *  The gap this closes is the one the first real end-to-end run made obvious: building a
 *  good-looking frame is already easy, and turning that frame into a *piece* is not. The
 *  timeline works, but it starts empty, and "capture a state, capture another one, place
 *  both, drag the edges" is four deliberate steps before anything cuts. Most people will
 *  never take them, and a static three-minute shot is not what they came for.
 *
 *  So: derive the variations from what is already in the scene. Nothing here invents visual
 *  content — every variation is a **subset** of what the user built (HC-7: a state selects,
 *  it does not own), which is why this can be a pure function and why the result is always
 *  something they would recognise as theirs.
 *
 *  Two rules keep the output usable rather than merely varied:
 *
 *  1. **Lights are in every variation.** A variation that switches the lights off is a black
 *     frame. It is technically a different look and it is never the one anyone wanted.
 *  2. **Wires are in every variation.** Routing is project-global and a state activates a
 *     subset (HC-8), but dropping wires makes a section *static*, which reads as broken
 *     rather than as restrained. Intensity belongs to the section engine (6C), not here.
 *
 *  What actually varies is **which shapes are present** and **how much post is on** — the two
 *  axes that read instantly at a cut. */

/** What the scene currently contains, split the way variation cares about. */
export interface VariationSeed {
  /** Non-light objects, in stack order. The first is treated as the hero. */
  shapeIds: readonly string[]
  /** Lights. Present in every variation. */
  lightIds: readonly string[]
  /** Post effects, in chain order. Later ones are treated as the more aggressive. */
  postIds: readonly string[]
  /** Every connection. Present in every variation. */
  connectionIds: readonly string[]
}

/** A variation, ready to become a `VisualState`. Carries its section so it can be placed
 *  against a matching marker rather than in an arbitrary order. */
export interface Variation {
  name: string
  section: SectionType
  sceneObjectIds: string[]
  activePostIds: string[]
  activeConnectionIds: string[]
}

/** The arc. Deliberately four and deliberately in this order — it is the shape of nearly
 *  every electronic track, and a sequence that follows it will feel intentional even though
 *  nothing here understands the music.
 *
 *  `shapes` is the fraction of the stack to show, `post` the fraction of the chain to run.
 *  `heroOnly` overrides the fraction with "just the first one", which is what makes a
 *  breakdown read as a breakdown rather than as a slightly emptier drop. */
const ARC: {
  section: SectionType
  name: string
  shapes: number
  post: number
  heroOnly?: boolean
}[] = [
  { section: 'intro', name: 'Intro', shapes: 0, post: 0, heroOnly: true },
  { section: 'build-up', name: 'Build', shapes: 0.5, post: 0.5 },
  { section: 'drop', name: 'Drop', shapes: 1, post: 1 },
  // The hero shape with the whole chain on it: emptier than the drop but not calmer, which
  // is the specific feeling a breakdown has and a simple fade does not.
  { section: 'breakdown', name: 'Breakdown', shapes: 0, post: 1, heroOnly: true },
]

/** How many of `total` a fraction should take.
 *
 *  Zero means zero — an intro asking for no post must get none. Any fraction above zero
 *  rounds up to at least one, so "half of three" is two rather than one and a half, and
 *  "a tenth of two" is still something rather than nothing. */
function take(total: number, fraction: number): number {
  if (total === 0 || fraction <= 0) return 0
  return Math.max(1, Math.round(total * fraction))
}

/** Build a set of variations from the current scene.
 *
 *  Returns `[]` when there is nothing to vary — an empty scene has no subsets, and offering
 *  four identical empty states would be worse than offering none. */
export function generateVariations(seed: VariationSeed): Variation[] {
  if (seed.shapeIds.length === 0) return []

  return ARC.map((step) => {
    const shapeCount = step.heroOnly ? 1 : take(seed.shapeIds.length, step.shapes)

    return {
      name: step.name,
      section: step.section,
      // Lights last so the ids read shapes-then-lights, which is the order the layer stack
      // shows and therefore the order someone comparing two states will scan.
      sceneObjectIds: [...seed.shapeIds.slice(0, shapeCount), ...seed.lightIds],
      // From the start of the chain, which is the order the user stacked it in. Effects
      // early in a chain are usually the grade and late ones the spectacle, so the intro
      // getting none and the build getting the first half tends to land — and if it does
      // not, reordering the chain is how you say so.
      activePostIds: seed.postIds.slice(0, take(seed.postIds.length, step.post)),
      activeConnectionIds: [...seed.connectionIds],
    }
  })
}

/** A strip to lay down: which variation, when, and for how long. */
export interface PlannedStrip {
  variationIndex: number
  startTime: number
  duration: number
}

/** The shortest gap between two cuts worth making. Below about a second a cut reads as a
 *  glitch rather than as an edit, and two markers dropped close together should not produce
 *  a strip nobody can see or grab. */
export const MIN_STRIP_SECONDS = 1

/** Lay variations out across the song.
 *
 *  **Markers win when they exist.** Someone who marked the drop has told us more about their
 *  track than any heuristic can infer, and the marker's *type* selects the variation — so a
 *  `drop` marker gets the Drop variation, not whichever one came next in a rotation. Marker
 *  types with no matching variation fall back to cycling, which keeps `fill` and `verse`
 *  useful rather than ignored.
 *
 *  With no markers it divides the duration evenly and walks the arc. That is a guess, and it
 *  is a guess in the right shape — every strip is still a state the user can edit, move or
 *  delete, so a wrong division costs one drag rather than a redo. */
export function planSequence(
  variations: readonly Variation[],
  markers: readonly SectionMarker[],
  duration: number,
): PlannedStrip[] {
  if (variations.length === 0 || duration <= 0) return []

  const indexOfSection = (section: SectionType) =>
    variations.findIndex((variation) => variation.section === section)

  const usable = markers
    .filter((marker) => marker.time < duration - MIN_STRIP_SECONDS)
    .sort((a, b) => a.time - b.time)

  if (usable.length > 0) {
    const planned: PlannedStrip[] = []

    // A marker at 0 starts the piece; anything later leaves a head that still needs covering,
    // and leaving it empty would mean the song opens on nothing.
    const cuts =
      usable[0].time > MIN_STRIP_SECONDS
        ? [{ time: 0, type: 'intro' as SectionType }, ...usable]
        : usable

    cuts.forEach((cut, i) => {
      const end = i + 1 < cuts.length ? cuts[i + 1].time : duration
      const width = end - cut.time
      if (width < MIN_STRIP_SECONDS) return

      const matched = indexOfSection(cut.type)
      planned.push({
        variationIndex: matched >= 0 ? matched : i % variations.length,
        startTime: cut.time,
        duration: width,
      })
    })

    return planned
  }

  // No markers: even division along the arc.
  const width = duration / variations.length
  if (width < MIN_STRIP_SECONDS) {
    // Too short to cut at all. One strip of the most complete variation beats four
    // sub-second flashes, which is a stutter rather than a sequence.
    const drop = Math.max(0, indexOfSection('drop'))
    return [{ variationIndex: drop, startTime: 0, duration }]
  }

  return variations.map((_, i) => ({
    variationIndex: i,
    startTime: i * width,
    duration: width,
  }))
}

/** The sections the arc covers. Exported so a test can assert they all exist in the
 *  vocabulary — a section named here but missing from `SECTION_TYPES` could never be matched
 *  by a marker, and `planSequence` would silently fall back to cycling forever. */
export const ARC_SECTIONS: readonly SectionType[] = ARC.map((step) => step.section)
