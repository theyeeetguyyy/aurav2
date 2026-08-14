# 08 — Open Questions

The **only** list of undecided things. If it isn't here, it's decided — check
[07-DECISIONS.md](07-DECISIONS.md).

> Previously this list existed in two places (`research/04-…` and the old knowledge
> base §6) and had already drifted — items marked resolved in one were still open in the
> other. Both are now superseded. `research/04-…` is frozen historical material.

---

## Blocking — needed before the phase that depends on them

### Q1 · Primary vs. secondary shape relationship
**Blocks:** nothing, currently.
Original notes distinguish "primary" and "secondary" shapes but never say what secondary
*does* — orbit the primary? sit behind as a backdrop? be driven by a different stem?

**Current position:** the open `SceneObject` layer stack (HC-4, §4.3) may have already
dissolved this question — with N objects each independently transformable and routable,
"primary/secondary" is just naming. **Revisit only if a real need for a parent/child
relationship appears.** If it does, the answer is scene-graph parenting, not a shape type.

### Q3 · 2D background / overlay layer
**Blocks:** Phase 4.
Named repeatedly ("arrows, lines, circles, squares"), never designed. Open: is it a
screen-space compositing pass over the 3D render, or 3D quads on a back plane? Screen-space
is more useful for the target audience (channel branding, lower-thirds) but needs its own
render path and its own coordinate system in the parameter registry.

> *2026-08-14 — this now has a forcing function and a set of numbers.* Vertical delivery needs
> **safe-area guides**, and the specs are exact: the cross-platform safe area is **900×1400 centred
> in 1080×1920**, with TikTok claiming ~130 px at the top, ~400–484 px at the bottom and ~140–180 px
> on the right for its action rail ([19 §2](19-RESEARCH-2026.md)). Guides are authoring furniture and
> belong on a gizmo layer, which needs no answer to this question — but a *watermark, tag or
> lower-third* is content in the same coordinate system, and that is the half Q3 has to decide.
> See [20 §A4](20-OPPORTUNITIES.md).

### Q4 · Lasers and image layers
**Blocks:** Phase 4.
Each named exactly once in the original notes, never elaborated. Lasers = volumetric
beams. Images = PNG/JPG on quads with displacement/glitch. Both are plausible
`SceneObject` types; neither has a spec. Cut from v1 unless specified.

---

## Non-blocking — decide before the relevant phase

### Q4b · Field naming collision — "Field" means two things
**Blocks:** nothing yet, but every day it stays open makes it worse.
AURA uses **Field** for a control signal (Principle 12, `FieldRef`). Cinema 4D uses
**Field** for a spatial falloff mask limiting which clones an effector affects (Q6). Both
belong in this product. Two meanings of one word across the UI and the docs is a
documentation disaster waiting to happen — decide a second name before the Cloner lands
in Phase 4H.

### Q5 · Expression-based parameter driving
Blender-style driver expressions beyond weighted sums (`sin(beat*2) * rms`). Powerful,
but it is a language, a parser, and a sandbox. Weighted sums plus derived Fields
(§4.1) may cover 95% of real use. **Recommendation: defer past v1.**

### Q6 · Spatial falloff masks as a general mechanism
Cinema 4D's spatial masks limit which clones an effector affects. Open: does spatial
masking generalise across the whole modulation system — "this connection only applies to
objects inside this volume" — or stay scoped to the Cloner? See also Q4b on naming.

### Q7 · Subsequences / nested states
Unreal Sequencer lets sequences nest. A State could contain its own mini-timeline.
Genuinely useful once projects get large; not needed for v1. Flagged so the strip data
model doesn't foreclose it.

### Q8 · Session view / live trigger mode
Ableton's session-vs-arrangement duality. Would serve the streamer/DJ audience with the
same data model. Explicitly v2+ — but worth confirming the state model can be triggered
non-linearly, which it can.

### Q9 · Export presets
Resolution/FPS/bitrate defaults are unspecified. Cheap to decide, needs deciding before
Phase 7A ships a dialog.

### Q10 · Rig portability format
`.aura-rig.json` (§4.7) is specified as a concept and identified as a business-model
feature, but the ID-remapping strategy is not designed. A rig that references object IDs
from its birth project is worthless. Needs to be solved *before* the first rig is
exported, or every early rig breaks.

> *2026-08-14 — promoted in importance, still unanswered.* Two findings make this the highest-value
> open question in this document. The market **already pays $5–35 for a single look** and $240 for a
> bundle of them, which is precisely what a portable state is; and remix communities are credited
> with training their own users because the shared thing is **openable rather than a black box**
> ([19 §1, §6](19-RESEARCH-2026.md), [20 §D1–D2](20-OPPORTUNITIES.md)). Both depend on this format
> existing and being right the first time.

### Q11 · Collaboration / hand-off
Exporting a rig separately from audio so an artist and a visual designer can work
asynchronously. Follows from Q10; no independent decision needed yet.

---

## Deferred by decision (recorded here so they aren't re-litigated)

| Item | Status |
|---|---|
| WebGPU + TSL renderer | Deferred to Phase 3F toggle. WebGL2 ships v1. |
| AI stem separation (Demucs) | v2+. v1 targets stem owners. Architecture accepts stems from any source, so it's a drop-in. |
| Web MIDI control | v2+. No Safari/iOS support; target audience uses keyboard/mouse. |
| Rig marketplace | v2+. Depends on Q10. |
| Live mic input | v2+. Retained as the sole justification for keeping live Meyda analysis (HC-3). |
| Millumin-style cue triggering | v2+. Depends on Q8. |

## Resolved

| Question | Resolved by | Where |
|---|---|---|
| **Q2 · Lighting module scope** | 2026-08-04 | D-48 in [07-DECISIONS.md](07-DECISIONS.md); encoded in [04-ENGINE-SPECS.md](04-ENGINE-SPECS.md) §4.3 |
