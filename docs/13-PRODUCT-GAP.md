# 13 — Product Gap Analysis

> *"currently the thing we have made is good, but is too basic, so we need to make it a
> proper product, right now its near mvp unfinished"*
>
> Agreed. This is the honest accounting of what exists, what is missing, and — more
> usefully — **which missing things actually block being a product** versus which are
> merely unbuilt.

*As of 2026-08-03 · 36 of 67 sub-phases complete · 230 tests.*

---

## The one-sentence version

**The modulation engine is genuinely good. Everything around it is a prototype.**

You can wire audio to visuals with real depth — weighted N:1, envelope shaping, response
curves, 15 deformers, deterministic sampling. But you cannot **save**, you cannot
**undo**, you cannot **sequence**, and you cannot **export**. Those four are the
difference between a toy and a tool, and none of them is hard.

---

## Done — by phase

| Phase | State | What works |
|---|---|---|
| **1 · Shell** | ✅ complete | 5-tab workspace, resizable docks, true dual camera, remappable modifier-aware shortcuts |
| **2 · Audio** | ✅ complete | Multi-stem decode + sync, trim, solo with visual isolation, offline MIR worker, 13 feature timelines, onsets, BPM, beat grid |
| **3 · Foundations** | 🟡 4 of 6 | Time authority ✅ · parameter registry ✅ · scene store ✅ · persistent renderer ✅ · **platform adapter ⬜** · **undo ⬜** |
| **4 · Scene** | 🟡 10 of 13 | Layer stack ✅ · brick registry ✅ · 7 procedural + 10 primitive shapes ✅ · inspector ✅ · **15 deformers ✅** · **14 post effects ✅** · **7 materials ✅** · **environment ✅** · **cloners ✅** · morph ⬜ · GLTF ⬜ · SDF ⬜ |
| **5 · Modulation** | 🟡 6 of 8 | Signal chain ✅ · matrix ✅ · patchbay ✅ · triggers ✅ · generators ✅ · **response curves ✅** · node graph ⬜ · object-to-object ⬜ · automation lanes ⬜ |
| **6 · Timeline** | ⬜ none | — |
| **7 · Camera** | ⬜ none | Dual camera exists; no spline, keyframes, constraints or easing |
| **8 · Export** | ⬜ none | — |
| **9 · Polish** | ⬜ none | — |

---

## The gap, ranked by what it costs the user

### Tier 1 — these make it not-a-product

| # | Missing | What it costs | Phase | Size |
|---|---|---|---|---|
| 1 | **Save / load** | Every refresh destroys everything. Nobody can build anything real. | 8E | small |
| 2 | **Export** | The product's entire output does not exist. You cannot get a video out. | 8A–8C | medium |
| 3 | **Undo** | Every mistake is permanent. Discourages experimenting, which is the whole activity. | 3F | small |
| 4 | **Timeline & states** | One static scene for the whole song. No cuts, no build, no drop. The brief's core structural idea. | 6A–6F | large |

Those four are the entire distance between "impressive demo" and "tool someone finishes a
video with". Three of the four are small or medium.

### Tier 2 — these make it feel thin

| # | Missing | What it costs | Phase |
|---|---|---|---|
| ~~5~~ | ~~**Post-processing**~~ | **Built.** 14 effects, all modulatable. Materials and environment landed with it — the three causes of "looks untreated" are closed. | 4I · 4L · 4M ✅ |
| ~~6~~ | ~~**Cloners + effectors**~~ | **Built.** 3 layouts x 4 effectors, instanced, plus the time-delay one nothing else can do. | 4H ✅ |
| 7 | **Camera authoring** | The "flying cinematographer" — a headline differentiator — does not exist yet. | 7A–7F |
| 8 | **Particles** | A whole visual language absent. | 10-ELEMENTS C |
| 9 | **Data elements** (spectrum bars, waveform) | Nothing instantly reads as "music visualiser". | 10-ELEMENTS B |

### Tier 3 — real, but survivable

Morph engine · GLTF import · SDF backend · lighting · 2D overlays · node graph ·
object-to-object routing · automation lanes · section markers · rig presets · batch export.

---

## What is actually strong

Worth being explicit about, because it is where the leverage is:

- **The modulation engine.** Weighted N:1, Gain→Curve→Rise/Fall→Min/Max→Weight, response
  curves with a real editor, discrete triggers as pure functions of time, generators as
  synthetic stems. This is deeper than NeuralFrames and more approachable than
  TouchDesigner, which is exactly the stated white space.
- **Determinism.** Features are timelines, not live taps (HC-3). Preview and export will
  be identical, automation lanes are drawable ahead of playback, and scrubbing backwards
  reproduces exactly. Most tools in this space cannot claim any of that.
- **The parameter system.** Addressed, not enumerated. A new brick becomes modulatable
  the moment it declares descriptors — no switch statement anywhere knows about it.
- **The architecture holds.** 32 sub-phases in, the hard constraints have not needed
  revising, and nothing audio-rate has leaked into React.

---

## Recommended order

Ranked by **cost of delay**, not by phase number.

1. **8E save/load** — small, and every hour spent authoring before it exists is thrown away.
2. **3F undo** — small, and it gets harder every phase.
3. **4I post-processing** — three shaders, largest visual-quality jump available.
4. **4H cloners** — multiplies everything already built.
5. **Phase 6 timeline** — large, but it is the brief's core structural idea and nothing
   else substitutes for it.
6. **Phase 8 export** — after the timeline, since exporting one static scene is not
   worth much.
7. **Phase 7 camera** — the differentiator, but it needs the timeline underneath it first.

Everything after that is elements ([10-ELEMENTS.md](10-ELEMENTS.md)) — particles, data
elements, text, tunnels — which is where the *ceiling* rises rather than the floor.

---

## Honest risks

- **UI is functional, not designed.** Acknowledged and deferred by decision. Worth a
  dedicated pass once the feature set stops moving — doing it earlier means doing it twice.
- **The post chain has not been profiled.** Merged effects keep the pass count low, but
  Feedback Trails owns two full-resolution half-float targets and the composer runs 4×
  MSAA. Nothing here is measured yet; that is Phase 9C.
- **No performance work has been done.** 60fps has never been measured under load. The
  audit is Phase 9C and everything before it is guesswork.
- **Nothing is persisted at all** — not projects, not preferences beyond keybindings.
- **Deformers are CPU-side.** Fine at 642 vertices; cloners (4H) multiply that by N and
  the decision (D-33) will need revisiting then, exactly as its "revisit when" note says.
