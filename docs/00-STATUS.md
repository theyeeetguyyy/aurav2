# 00 — Status

**Read this first.** Where the project actually is, what runs today, what does not, and
what to do next. Everything here is verified against the code, not aspirational.

*Last verified: 2026-07-29 · `npm run check` green (typecheck · lint · 103 tests)*

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
│   └── src/         83 files, ~10.1k lines
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
`zustand`, `meyda`, `lucide-react`, `react`. No FFT library, no state middleware, no
node-graph library yet.

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
4. **Press play.** The shape reacts. Scrub backwards — identical values, because features
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
⬜ **3E platform adapter** · **3F command history (undo)**.

### Phase 4 — Scene objects & backends (partial)
✅ Layer stack outliner · `BrickRegistry` with geometry caching · **7 procedural shapes on
one shared 642-vertex icosphere** (any↔any morphable) · **10 native primitives**
(swap-only) · descriptor-driven inspector · `ScrubField` with pointer lock.
· **15 deformers**, each a structurally distinct class of vertex operation, with a stack
UI, all drivable at frame rate · inspector shows live modulated values.
See [12-DEFORMERS.md](12-DEFORMERS.md).
⬜ **4H cloner/effectors** · 4F morph · 4I post-processing · 4J GLTF · 4K SDF backend.

### Phase 5 — Modulation (partial)
✅ `SignalShaper` (Gain→Rise/Fall→Min/Max→Weight) · `ModulationMatrix` with weighted N:1 ·
field evaluation (audio, rhythm, generative) · discrete triggers as decaying impulses ·
**patchbay UI** — drag-to-connect, live pulsing wires, wire inspector, per-stem meters ·
**Generators** — LFO/noise as first-class synthetic stems you can name and configure.
⬜ 5C node graph (advanced view) · 5E object-to-object routing · 5F automation lanes.

### Not started
**Phase 6** timeline & states · **Phase 7** camera authoring · **Phase 8** export &
project files · **Phase 9** brick mining from v1.

---

## Known gaps — deliberate, with locations

| # | Gap | Where | Consequence |
|---|---|---|---|
| 1 | **No undo** | Phase 3F | `ScrubField` already emits `onCommit` on drag end, so drags will coalesce into one step when it lands |
| 2 | **Camera page is viewport only** | `CameraPage.tsx` | No spline, keyframes, or constraints yet |
| 3 | **Deliver page is a placeholder** | `DeliverPage.tsx` | No timeline, no export |
| 4 | **Geometry params are not modulation targets** | `realtime: false` | Intentional (D-31) — wiring a kick to `radius` would re-tessellate 60×/sec. `scale.uniform` covers the common case; deformers (4G) are the real answer |
| 5 | **No project save/load** | Phase 8E | Everything is lost on refresh |
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

---

## Next

**Phase 4H — cloner + effectors.** From the original brief (*"replicate shape and
symmetrically offset it"*), and it multiplies everything already built: one shape becomes
8 in a radial array, each clone individually offset by a Step effector that is itself a
modulation target.

After that: **4I post-process** (bloom + kaleidoscope + feedback — three shaders, transforms
every scene) → **save/load** (before real authoring time is invested) → **undo** →
**Phase 6 timeline** → **Phase 8 export**.

Full breakdown with test criteria: [06-ROADMAP.md](06-ROADMAP.md).

---

## Document index

| Doc | Read when |
|---|---|
| [01-VISION](01-VISION.md) | Deciding *whether* to build something |
| [02-PRINCIPLES](02-PRINCIPLES.md) | **Before designing any subsystem** |
| [03-ARCHITECTURE](03-ARCHITECTURE.md) | **Before writing engine code.** Binding |
| [04-ENGINE-SPECS](04-ENGINE-SPECS.md) | Implementing a module |
| [05-DESIGN-SYSTEM](05-DESIGN-SYSTEM.md) | Writing UI |
| [06-ROADMAP](06-ROADMAP.md) | Picking what is next. **Only home for phase status** |
| [07-DECISIONS](07-DECISIONS.md) | "Why is it like this?" — every locked decision, with reasoning |
| [08-OPEN-QUESTIONS](08-OPEN-QUESTIONS.md) | Only list of genuinely undecided things |
| [09-BRICK-REGISTRY](09-BRICK-REGISTRY.md) | Operator catalogue |
| [10-ELEMENTS](10-ELEMENTS.md) | **What to build next.** Element families + build order |
| [11-ROUTING-UX](11-ROUTING-UX.md) | Patchbay routing redesign |
| [CODEBASE_MAP](CODEBASE_MAP.md) | Where a file lives and what it owns |
| [AUDIT-2026-07-27](AUDIT-2026-07-27.md) | How the current architecture was arrived at |
| `research/` | Frozen source material. Never edit |
