# 00 — Status

**Read this first.** Where the project actually is, what runs today, what does not, and
what to do next. Everything here is verified against the code, not aspirational.

*Last verified: 2026-08-13 · `npm run check` green (typecheck · lint · **534 tests**) · production
build clean · **driven in a real browser: every new brick screenshotted, and a 720p MP4 of a deformed
stroke with bloom and a camera orbit exported, decoded and measured for brightness and motion**
(`run-aura` skill) · 47 of 70 sub-phases, 4 partial*

> **Read next: [17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md).**
>
> The engine works. An mp3 goes in and a deterministic, sharp, audio-reactive MP4 comes out. The
> open question was whether **ten people would all make the same thing** — wireframed cloned shapes,
> routed to a stem, with a little post.
>
> **Passes 1, 2 and 4 are in, and 3 is most of the way.** Three of four render backends, six of
> eight element families: a scene palette every object binds to with a routable hue shift, five
> scatter bricks, a switch that draws any mesh as a cloud of its own vertices, Scatter and Surface
> layouts with a curl-noise Flow effector — and now **strokes**: five path bricks drawn as indexed
> line segments, two stroke materials, and two ribbon bricks sweeping the same paths into real
> meshes. All fifteen deformers work on a surface, a cloud and a stroke with no backend-specific
> code.
>
> **The next action is not a build.** The ten-project test has not been run since Pass 2, and it is
> the only thing that says whether four kinds of image produce ten distinguishable projects. The
> protocol is **[18-TEN-PROJECT-TEST.md](18-TEN-PROJECT-TEST.md)** — three hours, ten stills, and a
> friction log that outranks the score. Run it before starting SDF, text, or anything in §Next.
>
> What else is missing and what it costs: [13-PRODUCT-GAP.md](13-PRODUCT-GAP.md).

---

## What AURA is

An audio-reactive visual NLE for musicians and producers. Load your own stems, route each
stem's musical character to parameters of a 3D scene, direct a camera by hand, cut between
visual states on a timeline, render a video. Nothing auto-generates — see
[01-VISION.md](01-VISION.md).

## Where things are

```
aura/
├── aurav2/          the application — React 19 · TS strict · Vite · R3F · Zustand
│   ├── docs/        source of truth (you are here)
│   └── src/         195 files (27 of them tests)
└── legacy/aura-v1/  frozen vanilla-JS v1, 64 mode files. Parts donor, never shipped.
```

```bash
npm install --prefix aurav2
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + test — must be green before any commit
```

Both work from the **workspace root** (scripts forward into `aurav2/`) or from inside
`aurav2/` directly.

Runtime deps are deliberately few: `three`, `@react-three/fiber`, `@react-three/drei`,
`postprocessing`, `zustand`, `meyda`, `lucide-react`, `react`. No FFT library, no state
middleware, no node-graph library yet.

---

## The loop that works today

This is the whole product in miniature, and it runs end to end:

1. **Media & Stems** — drag in MP3/WAV stems. Each decodes, appears in the rack with a
   waveform and trim handles, and is analysed once in a worker.
2. **Scene & Shapes** — add something from the library: a **surface**, a **cloud**, a **stroke** or
   a **ribbon**, in seven folding groups. Layer stack on the left, viewport in the middle,
   descriptor-driven inspector on the right. Drag any numeric field to scrub it. Every object binds
   to a palette slot, so re-picking the palette recolours the whole scene at once.
3. **Routing** — add a **Generator** (LFO/noise) if you want motion that isn't in your
   stems, then **drag** a source dot (say your drum stem's *Envelope*) onto a parameter
   (say *Scale*, or *Explode · Strength*). One gesture. A wire appears and pulses with the
   signal. Click it to edit its chain. The **scene monitor** is pinned bottom-left, so you
   watch the result while you wire it.
4. **Treat the frame.** Pick a shading model — chrome, neon, a Fresnel rim — set the world
   (gradient background, fog, light angles), then stack post effects: bloom, feedback
   trails, kaleidoscope, grade. Every knob in all three is a modulation target, so the
   background can brighten on the downbeat and the kaleidoscope can turn on a generator.
5. **Press play.** The shape reacts. Scrub backwards — identical values, because features
   are sampled by time, not tapped live.

Solo a stem and its visual contribution isolates with it. That is an explicit flag, not a
side effect of the fader.

---

## Built

### Phase 1 — Shell & viewport ✅
DaVinci-style 5-tab workspace · resizable docks with splitters · **two genuinely distinct
cameras** (Scene renders, Preview authors; Fly and Orbit mutually exclusive) · remappable
modifier-aware shortcuts with conflict detection and localStorage persistence.

### Phase 2 — Audio ✅
Multi-stem decode and sample-accurate sync · per-track pre-fader analysis tap · solo/mute
with visual isolation · trim handles with trim-aware scheduling · `TransportClock` off
React · **offline MIR worker** producing 13 metric timelines, onsets, BPM, beat grid.

Not done: feature timelines are not serialised, so reopening a project re-analyses (8E).

### Phase 3 — Engine foundations (partial)
✅ `Clock` interface + `TransportClock` + `FrameClock` · `ParamAddress`/`ParamDescriptor`/
`FieldRef` registry · `useSceneStore` layer stack · **persistent single-Canvas viewport**
(HC-9) — pages expose a `ViewportSlot` and one renderer follows it, which is also how the
Routing page gets a live scene monitor for free.
✅ **3E platform adapter** — all file I/O behind one interface (D-52).
✅ **3F undo/redo** — command history over slice snapshots, drag coalescing, Ctrl+Z/Ctrl+Y (D-53).

### Phase 4 — Scene objects & backends (partial)
✅ Layer stack outliner · `BrickRegistry` with geometry caching · **7 procedural shapes on
one shared 642-vertex icosphere** (any↔any morphable) · **10 native primitives**
(swap-only) · descriptor-driven inspector · `ScrubField` with pointer lock.
· **15 deformers**, each a structurally distinct class of vertex operation, with a stack
UI, all drivable at frame rate · inspector shows live modulated values.
See [12-DEFORMERS.md](12-DEFORMERS.md).
✅ **4I post-processing** — **17** whole-frame effects in five groups (Glow · Distort · Time ·
Colour · Texture), a project-global reorderable stack with a master bypass, adjacent
effects merged into one fullscreen pass. Includes the **1-bit family** — Dither, Halftone and
ASCII — which reduce the frame rather than smoothing it, and are the one addition that is a
different kind of image rather than another glow (D-121).
✅ **4L materials** — 7 shading models as bricks (Standard, Physical, Unlit, Gradient,
Fresnel Rim, Toon, Normal). `MaterialParams` is open, not a fixed struct.
✅ **4M environment** — gradient background, fog, three-point rig with drivable intensity
and angle, procedural image-based reflections, grid. All routable.
✅ **4H cloners** — radial/linear/grid/**scatter**/**surface** layouts + Step/Random/Wave/
**Time Delay**/**Flow**/**Palette Ramp** effectors, GPU instanced, clone count drivable at frame
rate. The last two layouts are the ones that are not lattices (D-113).
✅ **4N lights** — 5 light types as scene objects with routable intensity, per-light
shadows and an authoring gizmo layer. Strobe-on-hit needed no code: it is an onset
trigger into intensity (D-48).
✅ **4O lines** — a third render backend. Five path bricks (Lissajous · Spiral · Rosette · Flow
Lines · Web) as indexed `LineSegments`, so every deformer works on a stroke unmodified and a web of
links is the same buffer with a different index. Two stroke materials; **no width control, because
WebGL has none** — weight comes from the two ribbon bricks, which sweep the same paths into ordinary
meshes (D-114).
⬜ 4F morph · 4J GLTF · 4K SDF backend.

### Phase 5 — Modulation (partial)
✅ `SignalShaper` (Gain→Rise/Fall→Min/Max→Weight) · `ModulationMatrix` with weighted N:1 ·
field evaluation (audio, rhythm, generative) · discrete triggers as decaying impulses ·
**patchbay UI** — drag-to-connect, live pulsing wires, wire inspector, per-stem meters ·
**Generators** — LFO/noise as first-class synthetic stems · **response curves** with an
editor, **real value ranges** in the parameter's own units, and a **modulation graph**
drawn from the real engine.
✅ **5F automation, rebuilt as clips over patterns** (D-83). A **pattern** is a shape in
normalised time; a **clip** places it — start, length, repeat count. Draw a one-second shape and run
it every second across ten by setting one number. Copies share the pattern, so editing either
changes both. A stem lane with no clips *is* its analysed signal, and a clip overrides it only where
it covers (D-84) — so "the kick drives this, except during the drop" needs no mode.
✅ **A stem exposes the signals you selected, not all thirteen** (D-88). Selection happens on the
stems page; Routing lists lanes. Four stems used to mean sixty-four source rows.
✅ **Shared processors** — Quantise, Sample & Hold, Delay, referenced by id so several wires use one
(D-95). The last two work by changing *when* the source is read, which keeps them pure (D-96).
Plus the signal-chain **input window** and **Normalise** (D-51).
⬜ 5C node graph (advanced view) · 5E object-to-object routing.

### Phase 7 — Camera (partial)
✅ **The Scene Camera's transform is a parameter** — position, rotation and fov as ordinary
descriptors, so they can be typed, wired from a stem, or drawn as a curve. That last one is
keyframing: a lane against `position.z` is a dolly on a time axis (D-64). Look-At now applies
with or without a behaviour (D-65).
✅ **7D camera behaviours** — Orbit / Sway / Handheld Shake / Dolly / Lens, each a pure
function of clock time with every amplitude a modulation target. Additive on top of the
authored transform rather than the only way to move (D-50).
✅ **7A path** — waypoints define *where*, a `progress` parameter defines *where along it*, so a
move can be retimed without being redrawn (D-93). A `Follow Path` behaviour reads it, and creating
one also creates the progress ramp so it moves instead of sitting at zero.
✅ **Camera gizmos** — the Scene Camera draws a frustum and its motion trail in preview, on their
own layer so only the pages that asked for camera furniture show them and the exporter never does.
⬜ 7A spline — belongs as a behaviour brick reading a curve, not a parallel owner of the
camera · 7B easing editor · 7C constraints · 7E motion trail · 7F presets.

### Phase 6 — Timeline & states (partial)
✅ **6A states + strips** — a state is a *selection* of visible objects, live wires and live
post effects (HC-7/HC-8), never a copy, so editing a shape updates every state that shows it.
✅ **6B the NLE timeline** — three lanes, drag and resize, imperative playhead, Ctrl+wheel
zoom anchored under the pointer, states and section markers in the left rail.
✅ **6D beat-grid snap** — tolerance in pixels so it feels identical at every zoom, and every
section marker joins the grid (D-60).
✅ **Auto-sequence** — Intro / Build / Drop / Breakdown derived as subsets of the current
scene and laid across the song in one click (D-74), with markers picking the variation by type.
The escalation is measurable in the exported file. Plus `Cut Flash` (D-75), which makes a hard
cut land rather than merely happen.
🟡 **6C markers** — placing, typing, jumping and snapping all work; the section-aware
**intensity engine** is still to come, and that is the part that carries musical narrative.
⬜ 6E transitions (crossfade / morph) · 6F camera track lane.

### Not started
**Phase 9** brick mining from v1.

---

## Known gaps — deliberate, with locations

| # | Gap | Where | Consequence |
|---|---|---|---|
| ~~1~~ | ~~No undo~~ | ✅ 3F | Ctrl+Z / Ctrl+Y, or the top-bar buttons. A slider drag is one step |
| ~~2~~ | ~~Camera page is viewport only~~ | ✅ D-64 | Transform fields, routing targets and lane-drawn moves. Spline paths still to come |
| ~~3~~ | ~~Deliver has export but no timeline~~ | ✅ 6A/6B | Timeline across the width, export in the right rail. Sequencing is optional — an empty timeline is one continuous scene (D-59) |
| 4 | **Geometry params are not modulation targets** | `realtime: false` | Intentional (D-31) — wiring a kick to `radius` would re-tessellate 60×/sec. `scale.uniform` covers the common case; deformers (4G) are the real answer. Same rule keeps a path's Strands and Resolution off the patchbay — a stroke animates through deformers, like everything else |
| 7 | **A stroke is always one pixel wide** | WebGL | Not fixable in the material: `LineBasicMaterial.linewidth` is ignored by every WebGL renderer. Weight comes from the ribbon bricks, which sweep a real section (D-114) |
| 8 | **Cloners are refused on clouds and strokes** | `EffectStack` | Cloning draws an `InstancedMesh`; neither backend is one. Both carry their own multiplicity — point count, strand count — so the loss is smaller than it sounds |
| 5 | ~~No project save/load~~ | ✅ 8E | Save/Open/Relink in the top bar. Stems are referenced, so a reopened project needs its audio re-picked — analysis is cached, so it does not re-run |
| 6 | **Root is not a git repo** | — | `aurav2/` and `legacy/aura-v1/` have separate histories; nothing spans the workspace |

---

## Invariants — do not break these

Full statements in [03-ARCHITECTURE.md](03-ARCHITECTURE.md). The five that are easiest to
break by accident:

1. **HC-1 — nothing audio-rate touches React.** Per-frame values go to typed arrays and
   `useFrame`. If you find yourself putting a 60 Hz value in a store, stop.
2. **HC-3 — features are sampled by time, not tapped live.** `AudioFeatures.sample(id, k, t)`.
   Anything reading "the value now" cannot be exported.
3. **HC-2 — one clock.** No `performance.now()` or `Date.now()` in the engine. If a system
   cannot be driven by `FrameClock`, it cannot be exported, which means it is broken.
4. **The `engine/` boundary is absolute.** No file under `engine/` imports React, a store,
   or a component. Pass context in instead — `FieldContext` is the pattern.
5. **HC-4 — procedural shapes share one topology.** Every brick in that family must report
   `BASE_VERTEX_COUNT` (642). `proceduralMesh.test.ts` enforces it; that test has already
   caught one silent break.
6. **D-36 — deformers cannot animate themselves.** `DeformContext` has no `time`, and a
   test asserts its absence. Motion arrives through modulation, never from inside an
   effect. If something needs to move on its own, wire a Generator to it.
7. **D-45 — the render path reads `activeClock()`, never `TransportClock` directly.**
   That indirection is the only reason `FrameClock` is reachable at all. Post effects may
   read time; they may not read a wall clock or an accumulator (D-46).
8. **D-42/D-44 — post and world address themselves with reserved owner ids** (`@post`,
   `@env`) through the ordinary `ParamAddress`. Do not add a second addressing scheme.

---

## Next

**Measure the widening, then finish it.**

The full argument, the falsifiable bar, and the sequence are in
[17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md). In short:

| Pass | What | Why here | |
|---|---|---|---|
| 1 | **Colour & light as things you author** — scene palettes, gradients across clones, hue from signal, environments that are not near-black | Cheapest, and it changes every frame | 🟡 |
| 2 | **The points backend** | Doubles the medium. A cloud is not a surface | ✅ |
| 3 | **Structure that is not a lattice** — noise, curl-flow, surface scatter | Cloners place on grids, so multiplicity always reads as an array | 🟡 |
| 4 | **Lines & ribbons** | Third image family, cheap once points exist | ✅ |
| 5 | **The SDF backend** | Most distinctive, most work | ⬜ |
| 6 | **Text** | For this audience, its absence is a hole rather than a gap | ⬜ |

**The bar, run after every pass:** ten projects from one stem, fifteen minutes each. A stranger must
tell all ten apart from a single frame, none may be embarrassing, and there must be **at least four
distinct image families**. There are now four backends' worth of vocabulary — lit surface, cloud,
stroke, swept band — so the *third* criterion is reachable for the first time. **Run it.** Nothing
below is worth starting until someone has sat down and made ten of them.

**What is left inside the passes already landed**, none of it blocking and all of it cheap:

| Left over | Pass | Note |
|---|---|---|
| Rig colour derived from the palette | 1 | The background and the objects follow the palette; the three-point rig is still one fixed white rig |
| Per-point and per-strand colour from the palette | 2 / 4 | `vertexColors` is wired on the point material and never fed. A cloud or a bundle that ramps across the palette is one attribute away |
| Clone count as an audio-driven target | 3 | The descriptor is already `realtime`; what is missing is the demonstration that a drop *adds copies* |
| Trails | 4 | A stroke whose vertices are one object's positions at successive past times. Needs modulation evaluated at `t − k` per vertex — a pass of its own, not a leftover |

**Deliberately not next:** interaction craft (gizmos, drag-to-scrub, hover, motion) and more
post effects. The first makes a narrow tool pleasant; the second adds permutations inside an image
family that already exists. Both are recorded — see
[05-DESIGN-SYSTEM.md](05-DESIGN-SYSTEM.md) §"Where this system is still not honest".

**Outside the widening, and now the oldest debts:** the section-aware intensity engine (6C) so a
`drop` marker is a force rather than a label; transitions (6E) so a change of look can be a swell
rather than a cut; and the performance audit (9C), which has been deferred long enough that the
per-frame CPU vertex budget has doubled twice under it.

**And, from the 2026-08 landscape scan** — [19-RESEARCH-2026.md](19-RESEARCH-2026.md) for the facts,
[20-OPPORTUNITIES.md](20-OPPORTUNITIES.md) for what to do about them. Three of its findings change
what is worth building, and none of them is a visual effect:

1. **Stem separation now runs in a browser tab.** Demucs v4 via ONNX, three to five minutes for a
   four-minute song, no server. 01-VISION deferred this as "a genuinely harder problem"; that is no
   longer true, and it is currently the product's largest onboarding barrier — the whole thesis is
   per-stem routing and the user has to arrive already holding stems.
2. **Spotify Canvas is an unserved, specified, recurring need** — 9:16, 3–8 s, no audio, loops
   forever, one per track. A tool built entirely from pure functions of `t` can guarantee a seamless
   loop; one built on accumulators cannot.
3. **Lyrics are geometry.** Whisper runs in-browser at 5–8× real time with sub-100 ms word timings,
   the AI tools are reviewed badly for having no lyric sync, and kinetic typography is a named 2026
   style. Text plus an aligner turns the whole existing timeline into a lyric engine.

Full queue: [15-BUILD-PLAN.md](15-BUILD-PLAN.md) · breakdown with test criteria:
[06-ROADMAP.md](06-ROADMAP.md).
