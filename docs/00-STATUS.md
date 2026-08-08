# 00 — Status

**Read this first.** Where the project actually is, what runs today, what does not, and
what to do next. Everything here is verified against the code, not aspirational.

*Last verified: 2026-08-07 · `npm run check` green (typecheck · lint · 430 tests) · production
build clean · **driven in a real browser: every page screenshotted, and a 720p MP4 exported,
decoded and measured for brightness and motion**  (`run-aura` skill)*

> **Read next: [17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md).**
>
> The engine works. An mp3 goes in and a deterministic, sharp, audio-reactive MP4 comes out. But
> **give this to ten people and eight will make the same thing** — wireframed cloned shapes, routed
> to a stem, with a little post. One of three declared render backends is implemented, and four of
> eight element families, and all four built ones resolve to *lit mesh* or *full-frame filter*.
>
> That is the only thing that matters right now. Not UI polish, not more effects.
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
│   └── src/         101 files
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
2. **Scene & Shapes** — add a shape from the library. Layer stack on the left, viewport in
   the middle, descriptor-driven inspector on the right. Drag any numeric field to scrub it.
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
✅ **4I post-processing** — 14 whole-frame effects in five groups (Glow · Distort · Time ·
Colour · Texture), a project-global reorderable stack with a master bypass, adjacent
effects merged into one fullscreen pass.
✅ **4L materials** — 7 shading models as bricks (Standard, Physical, Unlit, Gradient,
Fresnel Rim, Toon, Normal). `MaterialParams` is open, not a fixed struct.
✅ **4M environment** — gradient background, fog, three-point rig with drivable intensity
and angle, procedural image-based reflections, grid. All routable.
✅ **4H cloners** — radial/linear/grid layouts + Step/Random/Wave/**Time Delay** effectors,
GPU instanced, clone count drivable at frame rate.
✅ **4N lights** — 5 light types as scene objects with routable intensity, per-light
shadows and an authoring gizmo layer. Strobe-on-hit needed no code: it is an onset
trigger into intensity (D-48).
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
| 4 | **Geometry params are not modulation targets** | `realtime: false` | Intentional (D-31) — wiring a kick to `radius` would re-tessellate 60×/sec. `scale.uniform` covers the common case; deformers (4G) are the real answer |
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

**Widen the medium. Nothing else.**

The full argument, the falsifiable bar, and the sequence are in
[17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md). In short:

| Pass | What | Why here |
|---|---|---|
| 1 | **Colour & light as things you author** — scene palettes, gradients across clones, hue from signal, environments that are not near-black | Cheapest, and it changes every frame. Today a user who makes no colour decision gets the same palette as everyone else |
| 2 | **The points backend** — `points` is in the type union and nothing implements it | Doubles the medium. A cloud is not a surface. Stateless, so D-49's objection to particle *libraries* does not apply |
| 3 | **Structure that is not a lattice** — noise, curl-flow, surface scatter | Cloners place on grids, so multiplicity always reads as an array. Loudest "toy" tell in the output |
| 4 | **Lines & ribbons** | Third image family, cheap once points exist |
| 5 | **The SDF backend** | Most distinctive, most work |
| 6 | **Text** | For this audience, its absence is a hole rather than a gap |

**The bar, run after every pass:** ten projects from one stem, fifteen minutes each. A stranger must
tell all ten apart from a single frame, none may be embarrassing, and there must be **at least four
distinct image families**. Today it fails the first and third and passes the second — the floor is
fine, the room is narrow.

**Deliberately not next:** interaction craft (gizmos, drag-to-scrub, hover, motion) and more
post effects. The first makes a narrow tool pleasant; the second adds permutations inside the one
image family that already exists. Both are recorded — see
[05-DESIGN-SYSTEM.md](05-DESIGN-SYSTEM.md) §"Where this system is still not honest".

Full queue: [15-BUILD-PLAN.md](15-BUILD-PLAN.md) · breakdown with test criteria:
[06-ROADMAP.md](06-ROADMAP.md).
