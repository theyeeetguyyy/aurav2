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

**Everything that makes a frame is built. Nothing that makes a film is.**

You can build a scene, light it, treat it, drive it from your stems, save it, undo it,
and **get an MP4 out**. What is missing is **sequencing** — the timeline, states and cuts
that turn one continuous scene into a piece with structure.

And none of it has been run in a browser yet.

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

### Tier 1 — these make it not-a-product

| # | Missing | Cost | Phase | Size |
|---|---|---|---|---|
| 1 | **Export** | The product's entire output does not exist. You cannot get a video out. | 8A–8C | medium |
| ~~2~~ | ~~**Save / load**~~ | **Built** (D-52, D-56). Stems referenced, analysis cached, and the audio itself comes back — file handles persist in IndexedDB. | 8E ✅ | — |
| ~~3~~ | ~~**Undo**~~ | **Built** (D-53). Ctrl+Z / Ctrl+Y, drag coalescing. | 3F ✅ | — |
| 4 | **Timeline & states** | One static scene for the whole song. No cuts, no build, no drop. The brief's core structural idea. | 6A–6F | large |

Nothing above is blocked by anything else. `activeClock()` already unblocks export
(D-45) and the state data model is specified (HC-7, HC-8).

### Tier 2 — visual ceiling

| Missing | Why it matters | Where |
|---|---|---|
| **GPU particles** | Largest remaining jump in visual density. Must be **stateless** (D-49) | 10-ELEMENTS C |
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
4. **Phase 6 timeline** — large, the brief's core idea, and nothing substitutes for it.
5. **Particles** — the visual ceiling.
6. **Phase 7 camera authoring** — needs the timeline underneath it.
7. **Craft pass** — once the feature set stops moving.
