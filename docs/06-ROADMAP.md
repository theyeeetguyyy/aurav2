# 06 — Roadmap

**The only place phase status is tracked.** Do not restate status in other documents.

> **Renumbered 2026-07-27.** The audit found that several foundational systems
> (time authority, parameter registry, scene store, platform adapter) were assumed by
> later phases but never scheduled — Phase 3 would have had to invent all of them
> ad hoc. They are now an explicit phase. Old numbering is mapped at the bottom.

Rule: every sub-phase produces a working, testable build. No big-bang steps.

---

## Phase 1 — Shell & viewport ✅

| | | |
|---|---|---|
| 1A | Vite + React 19 + TS scaffold | ✅ |
| 1B | Tailwind v4 `@theme` tokens | ✅ |
| 1C | Zustand stores + type system | ✅ |
| 1D | DaVinci workspace shell, 5 pages | ✅ |
| 1E | R3F canvas, scene camera, lighting, grid | ✅ |
| 1F | Preview camera, WASD fly | ✅ |
| 1G | Remappable shortcuts + settings modal | ✅ |
| **1H** | **Audit remediation** — true dual camera (HC-10), modifier-aware shortcuts, input guards, immersive-view state restore, design-token compliance | ✅ 2026-07-27 |

## Phase 2 — Audio engine

| | | |
|---|---|---|
| 2A | `MultiTrackRack` — decode, sync, seek, loop | ✅ |
| 2B | Stem rack UI — waveforms, import, drag-drop | ✅ |
| 2C | Solo/mute with visual isolation | ✅ |
| 2D | Trim handles, trim-aware playback | ✅ |
| 2E | Live analysis → `AudioDataBus` | ✅ |
| **2F** | **Audit remediation** — pre-fader tap (HC-11), correct spectral-centroid scaling, power/dB band normalisation, bus aliasing fix, transport clock off React (HC-1) | ✅ 2026-07-27 |
| **2G** | **Feature timelines** (HC-3) — analysis worker with own radix-2 FFT, offline MIR on import, `AudioFeatures.sample(track, metric, t)`, 13 metrics, onsets, BPM, beat grid | ✅ 2026-07-27 |

**2G notes.** Written without essentia.js — a ~60-line FFT covers RMS, peak, 7 bands, spectral centroid, spectral flux, onset detection and tempo estimation, with no WASM dependency and no AudioWorklet plumbing. essentia.js remains an option if beat tracking needs to be stronger than inter-onset-interval histogramming.

The step that matters most is **percentile normalisation per metric**, which is only possible offline: each band is scaled against its own distribution across the whole file, so a band spanning one FFT bin (sub) and one spanning 150 (brilliance) both use the full 0–1 range. That is the root fix for the defect a live analyser cannot avoid — bands that read to a user as "nothing reacts to my hats".

**2G complete.** Feature timelines are cached into the project file as of 8E, so reopening does not re-analyse (D-52).

## Phase 3 — Engine foundations

> Nothing downstream is buildable without these. Small, unglamorous, load-bearing.

| | | |
|---|---|---|
| 3A | **Time authority** (HC-2) — `Clock` interface, `SteppedClock` / `FrameClock`, `TransportClock` singleton with throttled store mirror | ✅ |
| 3B | **Parameter registry** (HC-5) — `ParamAddress`, `ParamDescriptor`, `FieldRef`, transform/material descriptors, address resolution, exposed-param filtering | ✅ |
| 3C | **`useSceneStore`** — the SceneObject layer stack; add / remove / duplicate / reorder / rename / select / lock / hide, param writes by address | ✅ |
| 3D | **Persistent scene** (HC-9) — one shell-level Canvas positioned over whichever page exposes a `ViewportSlot` | ✅ |
| 3E | **Platform adapter** (§1) — interface + web implementation; all file I/O behind it (D-52) | ✅ |
| 3F | **Command history** — `{do, undo}` pairs over slice snapshots, coalescing, `Ctrl+Z`/`Ctrl+Y` (D-53) | ✅ |

**3D test:** ✅ verified — 16 Scene↔Camera switches leave exactly 1 canvas, zero `Context Lost`.
**3F test:** ✅ passing — `CommandHistory.test.ts` asserts ordering, that a 50-change drag
collapses to one step keeping the oldest undo and newest redo, that different keys never
merge, that a new action drops the redo branch, that pushes made *while applying* are
ignored (or an undo would push its own inverse and never drain), and that the stack is
bounded with the oldest entries dropped first.

## Phase 4 — Scene objects & render backends

| | | |
|---|---|---|
| 4A | Layer stack UI — Figma/Blender outliner with visibility, lock, reorder, rename, duplicate | ✅ |
| 4B | `GeometryBrick` interface + `BrickRegistry` with geometry caching (HC-4) | ✅ |
| 4C | `mesh/procedural` — shared-topology icosphere factory, 6 shapes, **invariant test** | ✅ |
| 4D | `mesh/primitive` — 10 native Three geometries, swap-only | ✅ |
| 4E | Inspector — fully descriptor-driven, `ScrubField` with pointer lock | ✅ |
| 4F | Morph engine — vertex lerp within the procedural family | ⬜ |
| 4G | Deformers — **15 structurally distinct** (D-38). See [12-DEFORMERS.md](12-DEFORMERS.md) | ✅ |
| 4H | **Cloner + Effectors** — radial/linear/grid layouts, Step/Random/Wave/Time-Delay effectors, GPU instanced (D-47) | ✅ |
| 4I | **Post-processing** — 14 whole-frame effects in 5 groups, project-global stack, every knob a modulation target (D-42/D-46) | ✅ |
| 4J | `mesh/imported` — GLTF loading, swap-only | ⬜ |
| 4K | `sdf` backend — Shader Park / LYGIA raymarch, `smooth-min` morphing | ⬜ |
| 4L | **Material system** — 7 shading models as bricks, open `MaterialParams` (D-43) | ✅ |
| 4M | **Environment** — background, fog, three-point lighting, image-based reflections, grid, all routable (D-44) | ✅ |
| 4N | **Lights as objects** — 5 light bricks, routable intensity, per-light shadows, authoring gizmo layer (D-48, resolves Q2) | ✅ |

**4C test:** ✅ passing — `proceduralMesh.test.ts` asserts every procedural brick builds exactly `BASE_VERTEX_COUNT` (642) vertices at default *and* extreme parameters, that all share one morph group, that `baseDirection` stays unit-length, and that no primitive ever claims morph compatibility.

> This test earned its keep immediately: it caught that Three.js `PolyhedronGeometry`
> subdivides each face into `(detail+1)²` triangles, not `4^detail` as the original plan
> assumed, and that `mergeVertices()` refuses to weld across a UV seam. The base mesh was
> silently producing 183 vertices instead of 642 — which would have surfaced as corrupted
> morphing in Phase 4F, far from the cause.

**4G notes.** CPU vertex displacement, not shaders (D-33). Deformers displace an
already-built mesh, which is what makes them the only geometry-changing values drivable at
frame rate — `radius` rebuilds, `Explode · Strength` does not. Delivers the original
brief's vocabulary directly: *"drums make the sphere explode and reform"*, *"guns make it
stretch, protrude out"*.

**4G test:** ✅ passing — every deformer is inert at defaults, is deterministic, declares
at least one realtime exposed parameter, and `DeformContext` provably has no `time` (D-36).
Plus structural assertions: squash conserves volume, quantize lands on the grid, spherify
converges to one radius, fracture moves cell-mates identically.

**4I notes.** Built on `postprocessing` (pmndrs) rather than three's `EffectComposer`
examples: mipmap-blur bloom is materially better than `UnrealBloomPass`, and adjacent
mergeable effects compile into ONE fullscreen pass, so a five-effect colour chain costs
about what one costs. Fourteen effects across Glow · Distort · Time · Colour · Texture.
Seven wrap library effects; seven are hand-written — Kaleidoscope, Mirror, Zoom Blur,
Colour Grade, Palette, Film Grain and Feedback Trails, the last being a real `Pass` with
ping-pong frame history.

Deliberately **not** exposed: `ScanlineEffect.scrollSpeed` and `GlitchEffect`. Both animate
from the composer's wall clock, and a value that depends on wall time cannot be exported
deterministically (HC-2). Where that motion is wanted the parameter is a static offset and
the user wires a Generator — same movement, authored and sync-able.

**4I test:** ✅ passing — `PostRegistry.test.ts` asserts unique ids, coherent descriptor
ranges, that every brick exposes at least one drivable parameter, that every brick builds
a composer node and survives an update with missing parameters, that convolution effects
declare `standalone`, and that film grain's seed is a pure function of clock time.

**4L test:** ✅ passing — `MaterialRegistry.test.ts` asserts the `material.` prefix
contract in both directions (descriptors prefixed, stored values not), that every model
survives an update with missing keys, and that a model swap carries shared values across.

**4M notes.** `RoomEnvironment` + `PMREMGenerator` for image-based lighting — procedural,
so no asset and no network. Renderer tone mapping is deliberately left at three's default:
the Colour Grade post brick owns filmic roll-off, and doing it in both places would
double-apply it.

**4H notes.** Layout and variation are separate questions, so they are separate bricks:
one cloner decides where the copies are, any number of effectors vary them. Three layouts
and four effectors cover a space that would otherwise need dozens of presets — a spiral is
a radial cloner with a Step effector on Y, a staircase is a linear cloner with a Step
effector on rotation.

One `InstancedMesh`, one draw call, buffers allocated once at `MAX_CLONES = 512`. That
allocation strategy is what makes **clone count safe to drive at frame rate** — the only
"how much geometry exists" value that is (contrast D-31): raising it changes the draw
count, not an allocation.

The **Time Delay effector** is the one nothing else on the market can do. Clone *i* reads
a stem's feature timeline at `t - i x delay`, so clone 0 is now and clone 7 is half a
second ago: the ring becomes a physical waveform of the recent past and every hit visibly
travels outward (14-VISUAL-IDEAS 1.2). Its `lookAhead` reads the *future*, so the array
braces a moment before the hit lands (1.1). Both are structurally impossible for a
live-tap architecture, which knows the present and nothing else.

**4H test:** ✅ passing — `cloners.test.ts` asserts count clamping, that a full turn does
not stack the last clone on the first while a partial arc reaches its end angle, that
every effector is inert at its defaults, that random scatter is deterministic from its
seed, that a second cloner is ignored rather than half-applied, and — the load-bearing
one — that a frame restarts from the layout instead of accumulating.

**4N test:** ✅ passing — `LightRegistry.test.ts` asserts every light exposes `intensity`
as an exposed realtime target with real headroom above its default, that a shadow toggle
appears only on lights that can cast one, that aiming lights parent a target down -Z so
the object's rotation aims the beam, and that a light describes placement plus its own
knobs with no material and no scale.

**4F test:** sphere → torus morphs without self-intersection; a cross-family transition presents as a crossfade and is labelled as such.
**4K test:** `sdf` and `mesh` objects coexist in one scene so the two looks can be judged side by side.

## Phase 5 — Modulation

| | | |
|---|---|---|
| 5A | `ModulationMatrix` + `SignalShaper` — Gain→Curve→Rise/Fall→Min/Max→Weight, weighted N:1, envelope reset on clock jump | ✅ |
| 5B | Routing UI, first pass (stacked list) — superseded by 5G | ✅ |
| 5C | React Flow node graph (advanced toggle), typed connections | ⬜ |
| 5D | Discrete event triggers — generic decaying impulse, pure function of time | ✅ |
| 5E | Object-to-object routing + dependency ordering with cycle detection (§4.5) | ⬜ |
| 5F | **Automation lanes** — one editable curve per stem, drawn under its waveform (D-55), plus the signal-chain input window and Normalise (D-51) | ✅ |
| 5G | **Patchbay** — drag-to-connect, live pulsing wires, wire inspector, resizable columns. See [11-ROUTING-UX.md](11-ROUTING-UX.md) | ✅ |
| 5H | **Generators** — LFO/noise as first-class synthetic stems (D-37) | ✅ |
| 5I | **Response curves + real-value display + modulation graph** (D-39/40/41) | ✅ |

**5A/5D notes.** Two design changes from the original spec, both recorded in
[07-DECISIONS.md](07-DECISIONS.md):

- **Event triggers are a generic decaying impulse into any parameter address**, not four
  hardcoded actions (`explode` / `color-flash` / `scale-pulse` / `morph-snap`). Simpler
  *and* strictly more capable — "explode" is an impulse into a deformer's strength,
  "flash" is an impulse into emissive intensity. (D-30)
- **`ParamDescriptor.realtime`** gates what may be driven at frame rate. Geometry
  parameters rebuild the mesh, so wiring a kick to `radius` would re-tessellate 60 times
  a second and blow the geometry cache. `scale.uniform` covers the common "pulse with
  the kick" case for free; genuine continuous shape change is Phase 4G deformers. (D-31)

**5G shipped.** One drag connects. Wires are measured from real DOM anchors, so both
columns stay ordinary scrollable lists and the SVG owns no layout. Colour encodes source
family, thickness encodes weight, and opacity/width pulse with the live signal — animated
imperatively off `TransportClock`, never React (HC-1). `onset` sources default to a
discrete trigger, everything else to a continuous blend, so the drop gesture asks nothing.
New connections seed their range from the target descriptor rather than a flat 0→1, which
was invisible on a parameter spanning −500…500.

**5G test:** ✅ verified in-browser — two drags create two wires, the cursor wire renders
mid-drag, clicking a wire opens its 6-field chain editor, wires track column scrolling,
zero console errors.

**5I notes.** The FL-Studio-style piece: every connection now has an editable response
curve, the routing UI shows the real value span in the parameter's own units, and the
inspector draws the parameter's actual value over time — computed by running the real
shaper over the real feature timeline, not illustrated from the settings. Each stem also
shows its own signal strip, so you can read a stem's character before wiring it.

**5F test:** ✅ passing — `lane.test.ts` also asserts decimation is peak-preserving (a
one-sample spike survives being reduced to 64 points), refuses a zero-length project, and
clamps into 0–1. Plus: a lane holds its end values outside the
drawn range rather than falling to zero, that all three interpolation modes behave, that
sampling is a pure function of time, that freehand writes stay sorted and collapse
near-coincident points, and that the input window stretches a narrow range onto the full
one, clamps outside it, is inert at its defaults and never divides by zero.

**5 test:** ⬜ manual — wire drums envelope → sphere `scale.uniform` and a drums onset
trigger → `emissiveIntensity`. Play; scrub backwards and confirm identical values;
profile for zero React re-renders during playback.

## Phase 6 — Timeline & states 🟡

| | | |
|---|---|---|
| 6A | State library + Strip references (HC-7), per-state connection activation (HC-8) | ✅ |
| 6B | NLE timeline canvas — 3 lanes, playhead, drag/resize, zoom, pan | ✅ |
| 6C | Section markers ✅ · **section-aware intensity engine** (restored from v1) | 🟡 |
| 6D | Beat-grid snap, zoom-aware, markers included in the grid | ✅ |
| 6E | Transitions — cut / crossfade / morph on overlap | ⬜ |
| 6F | Camera track lane on the timeline | ⬜ |

Markers landed with 6B rather than waiting for 6C, because `add-marker` (M) had been in the
shortcut registry since Phase 1 with nothing listening — an advertised feature that silently
did nothing. Marking a moment and snapping to it is the half that needs no intensity engine.

**Cuts are hard by construction.** 6E is the *only* thing standing between this and
crossfades, and nothing in 6A–6D presumes a hard cut: `resolveTimeline` returns the set of
live strips, so a transition is a weight over that set rather than a change to it.

**Auto-sequence (D-74) is the entry point 6A–6D were missing.** Four variations derived from
the scene, laid across the song, in one click — and every strip is an ordinary state the user
can then edit. Verified in an exported file rather than asserted: mean luma escalates 14.6 →
35.1 → 38.6 across Intro, Build and Drop.

**Cut Flash (D-75) makes a hard cut a feature rather than a limitation.** Not a substitute for
6E, but it is what makes the current hard cuts *intentional* instead of abrupt.

**6 test:** one state placed three times, edited once → all three update. Overlap two strips → crossfade. Drop a `drop` marker → intensity multiplier visibly rises.

## Phase 7 — Camera ⬜

| | | |
|---|---|---|
| 7A | Catmull-Rom spline + draggable 3D waypoint gizmo | ⬜ |
| 7B | F-curve easing editor with tangent handles | ⬜ |
| 7C | Constraints — Follow Path, Look-At, Child-Of with blendable influence | ⬜ |
| 7D | **Camera behaviours** — Orbit / Sway / Shake / Dolly / Lens as pure functions of time, every amplitude a modulation target, plus Align-to-view (D-50) | ✅ |
| 7E | Motion trail with speed-indicating dot spacing | ⬜ |
| 7F | Saveable camera-move presets | ⬜ |

**7D test:** ✅ passing — `behaviours.test.ts` asserts every behaviour is a pure function of
time when evaluated out of order, exposes at least one drivable parameter, survives
missing parameters without producing NaN, that shake decorrelates its axes, and that a
stack accumulates rather than overwriting.

**7 test:** Look-At tracks a moving shape with no roll. Follow Path travels the spline. Easing change is visible in motion. Trail dots bunch on slow sections.

## Phase 8 — Export & project ⬜

| | | |
|---|---|---|
| 8A | **Frame renderer** — `FrameClock`-stepped render through the live renderer, not a worker (D-54) | ✅ |
| 8B | **WebCodecs encoder + `mp4-muxer`** — H.264 + AAC, backpressure, offline stem mixdown | ✅ |
| 8C | Horizontal + vertical from one pass | 🟡 presets exist (16:9 / 9:16 / 1:1); one render per aspect, not yet one pass |
| 8D | Batch queue (capability-gated) | ⬜ |
| 8E | **`.aura.json` save/load** with base64 feature-timeline cache, versioning, migration and stem relinking (D-52) | ✅ |
| 8F | `.aura-rig.json` portable rigs (needs Q10) | ⬜ |
| 8G | Autosave | ⬜ |

**8E test:** ✅ passing — `project.test.ts` asserts float encoding round-trips exactly and
survives arrays past the `String.fromCharCode` argument limit, that the cache does not
share memory with its source, that a newer-version file is refused rather than half-read,
that non-JSON and non-projects produce readable messages, that an older project has its
missing collections filled, and that project names become filesystem-safe.

**8A/8B test:** ✅ passing — `export.test.ts` asserts the clock seam swaps and restores,
that frame times are integer-derived so they never drift, that timestamps match the frame
grid, that every resolution preset is even-dimensioned (H.264 chroma subsampling requires
it), and that frame count follows from duration rather than from render time.

**8 test:** export 1080p → frame count equals `duration × fps`, plays in VLC, audio-synced. **Render the same project twice → byte-identical output.** Save, reload → identical project.

## Phase 9 — Bricks & polish ⬜

| | | |
|---|---|---|
| 9A | Mine `legacy/aura-v1` for bricks (see below) | ⬜ |
| 9B | Recipe library built from those bricks | ⬜ |
| 9C | Performance audit | ⬜ |

### Mining the v1 codebase

Per the 2026-07-27 decision, the 24 v1 modes are **not ported as modes** — a ported
monolithic mode is a black box, and black boxes are what Principle 12 exists to prevent.
Extract the maths, discard the packaging:

| Source | Extract |
|---|---|
| `js/markers.js` | Section-aware intensity engine → Phase 6C |
| `js/engine/keyframeEngine.js` | Easing set + Catmull-Rom interpolation → Phase 7B |
| `js/engine/mathLib.js` | Noise, easing, interpolation helpers |
| `js/engine/colorLib.js` | HSL / gradient / palette utilities |
| `js/modes/geometryShapes2.js` (1215 ln) | Deformer and geometry maths |
| `js/modes/hyperforge3.js` (918 ln) | Geometry generation |
| `js/modes/titanforge.js` (801 ln) | Geometry generation |
| `js/modes/gpgpuParticles.js` | GPU particle technique → `points` backend |
| `js/modes/kaleidoscope.js`, `shaderTunnel.js`, `neonPlasma.js` | GLSL worth adapting as post-process bricks |
| `js/project/` | Schema and serialisation approach |

**Performance audit checklist:** 60fps with 4 stems + modulation + post-processing ·
zero React re-renders from audio (profiler-verified) · GPU resource count stable across
50 tab switches · timeline smooth with 10+ strips · deterministic export verified by
double render.

---

## Numbering map (old → new)

| Old | New |
|---|---|
| 2F essentia pre-analysis | **2G** feature timelines (scope expanded per HC-3) |
| 3A–3F shapes | **4A–4J** (backends added) |
| 4A–4E modulation | **5A–5F** (object-to-object added) |
| 5A–5F timeline | **6A–6F** |
| 6A–6D camera | **7A–7F** |
| 7A–7C export/project/undo | **8A–8G**; undo moved earlier to **3F** |
| 7D–7E mode migration | **9A** brick mining — scope changed from port to mine |
| — | **Phase 3** engine foundations — new, was never scheduled |
