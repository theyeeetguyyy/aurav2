# 13 — Product Gap Analysis

> *"currently the thing we have made is good, but is too basic, so we need to make it a
> proper product, right now its near mvp unfinished"*
>
> The honest accounting of what exists, what is missing, and — more usefully — **which
> missing things actually block being a product** versus which are merely unbuilt.
>
> Phase status lives in [06-ROADMAP.md](06-ROADMAP.md); the working queue lives in
> [15-BUILD-PLAN.md](15-BUILD-PLAN.md). This is the *why it matters* view.

*As of 2026-08-04 · 45 of 68 sub-phases · 324 tests.*

---

## The one-sentence version

**The path from an mp3 to a finished mp4 is now closed end to end. What is missing is
everything that would make the result unmistakably yours.**

You can build a scene, light it, treat it, drive it from your stems, cut between looks on the
beat, mark the drop, save it, undo it, and get an MP4 out. What is left divides cleanly:
**narrative** — the section-aware intensity engine and crossfades, so structure does more than
switch — and **the visual ceiling**, where particles, morphing and text live.

Most of it has still only been run in a browser a handful of times.

---

## Built

| Area | State |
|---|---|
| **Shell & workspace** | 6 pages, docked layout, dual camera, remappable shortcuts, **save/open/relink**, **undo/redo** |
| **Audio** | Multi-stem decode + sync, trim, solo-isolates-visuals, offline MIR worker, 13 feature timelines, onsets, BPM, beat grid |
| **Modulation** | Weighted N:1, Gain→Curve→Rise/Fall→Range→Weight, input window + Normalise, response curves, discrete triggers, generators, **a per-stem editable modulation curve** |
| **Routing UI** | Patchbay with drag-to-connect, live wires, honest reachable-range readouts, per-connection graph drawn from the real engine |
| **Geometry** | 7 procedural (any↔any morph-ready) + 10 primitive shapes, **15 deformers**, **3 cloners × 4 effectors** including the time-delay one |
| **Look** | **14 post effects**, **7 materials**, **environment** (gradient sky, fog, IBL reflections, grid), **5 light types** as scene objects |
| **Camera** | **5 behaviours** (Orbit/Sway/Shake/Dolly/Lens), Look-At, Align-to-view |
| **Export** | **MP4 out** — H.264 + AAC, deterministic frame stepping, 16:9 / 9:16 / 1:1, cancellable |

---

## Missing, ranked by what it costs

### Tier 0 — **the gap that decides everything**

*Added 2026-08-07, after using the software rather than reading about it.*

| Missing | Why it matters | Where |
|---|---|---|
| **Expressive range** | Ten users, eight similar outputs. One of three declared `RenderBackend`s implemented; four of eight element families, and all four resolve to *lit mesh* or *full-frame filter*. The whole output space is `{primitive} × {deformer} × {regular array} × {accent colour} × {bloom, kaleidoscope, grade}`, and its centre of mass is the thing everyone makes. | **[17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md)** |

Everything in Tier 2 below is a *piece* of this gap. What 17 adds is the ordering, the reason for
it, and a falsifiable bar to stop at. Read it before picking anything from the lists that follow —
several Tier 2 items look equivalent and are not: colour authoring changes every frame for almost no
work, while another twelve post effects change nothing.

### Tier 1 — these make it not-a-product

| # | Missing | Cost | Phase | Size |
|---|---|---|---|---|
| 1 | **Export** | The product's entire output does not exist. You cannot get a video out. | 8A–8C | medium |
| ~~2~~ | ~~**Save / load**~~ | **Built** (D-52, D-56). Stems referenced, analysis cached, and the audio itself comes back — file handles persist in IndexedDB. | 8E ✅ | — |
| ~~3~~ | ~~**Undo**~~ | **Built** (D-53). Ctrl+Z / Ctrl+Y, drag coalescing. | 3F ✅ | — |
| ~~4~~ | ~~**Timeline & states**~~ | **Built** (6A/6B/6D). States are selections not copies, three lanes, beat-grid snap, markers. Cuts work; **crossfades (6E) and the intensity engine (6C) do not** — so structure switches rather than swells. | 6A–6D ✅ | — |
| 5 | **Section-aware intensity engine** | A `drop` marker is a label, not a force. Nothing in the piece knows it is in a build-up, so "tension over eight bars" is still unexpressible — frame-local metrics structurally cannot say it (D-29). | 6C | medium |
| 6 | **Transitions** | Every change of look is a hard cut. Fine for trap, wrong for almost everything slower. `resolveTimeline` already returns the *set* of live strips, so a crossfade is a weight over that set — no restructuring needed. | 6E | medium |

Nothing above is blocked by anything else.

### Tier 2 — visual ceiling

**Ordered by variance per unit of work in [17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md) §3.**
This table is the inventory; that document is the sequence.

| Missing | Why it matters | Where |
|---|---|---|
| **Colour & light authoring** | Not previously listed, and it is **first**. One colour per object from a rotating palette, over near-black, under one rig — so every scene is "an accent colour on dark", including for a user who made no colour decision. Palettes, gradients across clones, hue from signal. Cheapest change that touches every frame | 17 §3 Pass 1 |
| **Points backend** | Doubles the medium: a cloud is not a surface. `points` is already in the type union with nothing behind it. Stateless, so D-49's objection to particle *libraries* does not apply | 10-ELEMENTS C |
| **Non-lattice structure** | Cloners distribute on grids, radials and spirals — all regular, so multiplicity always reads as an array. Loudest "made in a toy" signal in the current output | 17 §3 Pass 3 |
| **Morph engine** | "Transform between any to any" is in the brief, and the shared-topology work is already done | 4F |
| **More deformers** | FFT/spectrum, curl noise, cull/dissolve, voronoi shatter, taper, spline, jelly | 14-VISUAL-IDEAS §2 |
| **Data elements** | Spectrum bars, waveform, Lissajous — what makes a video read instantly as *music* | 10-ELEMENTS B |
| **Extruded 3D text** | The audience's clearest unmet need — beat name, producer tag, channel logo | 10-ELEMENTS A |
| **Tunnels / SDF fields** | Also solves "the camera needs somewhere to go" | 4K |
| **GLTF import** | Bring your own mesh | 4J |
| **Trails / ribbons** | Doubles perceived density cheaply | 10-ELEMENTS A |

### Tier 3 — depth, not breadth

Node graph (5C) · object-to-object routing (5E) · camera spline, keyframes, easing,
constraints, motion trail and presets (7A/7B/7C/7E/7F) · batch export (8D) · portable
rigs (8F) · autosave (8G) · v1 brick mining (9A) · recipe library (9B).

### Tier 4 — quality of life

- **Stems page as a real editor** — bars/beats ruler, move in time, split, fades, zoom
- **Object parenting / linking**, groups, multi-select
- **UI craft pass** — controls are small and undifferentiated, density is uniform

---

## Eleven open questions

Still genuinely undecided, in [08-OPEN-QUESTIONS.md](08-OPEN-QUESTIONS.md). The ones that
block work rather than merely sit there:

- **Q3 · 2D overlay layer** — named repeatedly in the brief, never designed. Blocks
  lower-thirds, channel branding, safe-area guides for vertical export.
- **Q4b · "Field" means two things** — a control signal *and* a spatial falloff mask.
  Costs nothing today, costs a rename later.
- **Q9 · Export presets** — cheap, but needs deciding before the export dialog exists.
- **Q10 · Rig portability** — a rig referencing object IDs from its birth project is
  worthless. Must be solved *before* the first rig is exported.

---

## Honest risks

- **Nothing has been visually verified.** No browser has been driven in this workspace.
  The post-processing GLSL has never compiled on a GPU, and the instanced cloner path has
  never rendered. Both are covered by structural tests; neither is covered by a pixel.
- **No performance work has been done.** 60fps has never been measured under load. The
  post chain runs 4× MSAA and Feedback Trails owns two full-resolution half-float
  targets. Deformers and cloners are CPU-side, and a cloner multiplies the vertex work by
  N. The audit is 9C and everything before it is guesswork.
- **Autosave does not exist.** Save is manual, so a crash still costs the session. 8G.
- **The UI is functional, not designed.** Acknowledged and deferred by decision; the
  feature set is now large enough that the pass is worth scheduling.

---

## Recommended order

By cost of delay, not by phase number.

1. ~~8E save/load~~ — ✅ built.
2. ~~3F undo~~ — ✅ built.
3. ~~Phase 8 export~~ — ✅ built.
4. ~~Phase 6 timeline~~ — ✅ built (6A/6B/6D).
5. **6C intensity engine** — markers exist and do nothing yet; this is what makes them matter.
6. **6E transitions** — small next to what it buys, and every cut is currently hard.
7. **Particles** — the visual ceiling.
8. **Phase 7 camera authoring** — the time axis it needed now exists.
9. **Craft pass** — once the feature set stops moving.
