# 03 — Architecture

> **This document outranks all others.** Code that violates a hard constraint is wrong
> even if it appears to work. Constraints exist because retrofitting them later means
> touching every consumer.

---

## 1. Platform: one codebase, two shells

**Decided 2026-07-27.** Previous docs contradicted themselves ("Tauri preferred" vs.
"100% pure web SPA, desktop dropped entirely"). Resolved as: **neither, and both.**

All host-specific capability sits behind a single `PlatformAdapter` interface. The
browser adapter ships today. A Tauri adapter can land any time without touching engine
code. Distribution stays a business decision, not an architectural one.

```ts
// engine/platform/PlatformAdapter.ts
export interface PlatformAdapter {
  pickAudioFiles(): Promise<FileHandle[]>
  readProject(ref: ProjectRef): Promise<Uint8Array>
  writeProject(ref: ProjectRef, bytes: Uint8Array): Promise<void>
  writeVideo(name: string, bytes: Uint8Array): Promise<void>
  /** Can stem paths be re-resolved on project reopen without re-picking files? */
  readonly canRelinkByPath: boolean
  /** Can long render queues survive backgrounding? (false in a browser tab) */
  readonly supportsBatchQueue: boolean
}
```

Nothing outside `engine/platform/` may touch `File`, `showOpenFilePicker`, `fetch` for
local assets, or Tauri APIs. Features degrade by **querying capability flags**, never by
sniffing the environment.

Known browser-only limitations, to be honest about in the UI: projects cannot relink
stems by path on reopen; long batch renders are subject to tab throttling.

## 2. Technology

| Layer | Choice | Notes |
|---|---|---|
| Build | Vite + TypeScript (strict) | |
| UI | React 19 + Tailwind v4 + Lucide | |
| 3D | Three.js + React Three Fiber + Drei | **WebGL2 now.** WebGPU is a Phase-3F toggle — it needs async renderer init and TSL shaders. Do not block on it. |
| State | Zustand | Plain stores. No middleware in the audio path. |
| Node graph UI | React Flow (`@xyflow/react`) | |
| Audio analysis | **essentia.js** (offline MIR, in a worker) + **Meyda** (cheap live features) | See HC-3. |
| Audio playback | Web Audio API | |
| Video export | WebCodecs `VideoEncoder` + `mp4-muxer` | In a worker with `OffscreenCanvas`. |
| Undo | **Command pattern** (`{do, undo}` pairs) | Locked. Not `zundo` — snapshotting stores that reference `AudioBuffer`s and GPU resources is a memory disaster. |

---

## Hard constraints

### HC-1 — Audio-reactive data never passes through React

Per-frame values (RMS, bands, onset, transient) are produced ~60×/sec per track. Pushing
them into Zustand triggers a re-render storm across every subscriber. This is the single
most common way audio-reactive R3F projects die.

**Rule:** per-frame values are written into `Float32Array` buffers or straight into
shader uniforms inside `useFrame`. Only values a *human must watch* (a VU meter, the
timecode) reach React, throttled to 10–15 Hz.

**This applies to the transport clock too.** The playhead position is a per-frame value.
It lives in `TransportClock` and is mirrored into the store at display rate only.

### HC-2 — One time authority

Every time-dependent system reads from a single injectable clock. There are three
implementations of one interface:

```ts
export interface Clock {
  /** Seconds into the project timeline. */
  readonly time: number
  readonly playing: boolean
}
```

| Implementation | Used by | Source of truth |
|---|---|---|
| `RealtimeClock` | preview playback | `AudioContext.currentTime` |
| `ScrubClock` | timeline scrubbing while paused | user input |
| `FrameClock` | offline export | `frameIndex / fps`, stepped deterministically |

No module may call `performance.now()`, `Date.now()`, or read `AudioContext.currentTime`
directly to decide what to draw. If a system cannot be driven by `FrameClock`, it cannot
be exported, which means it is broken.

### HC-3 — Features are timelines, not live taps

**The constraint that makes offline rendering possible at all.**

A live Meyda analyser reports *the value right now*. The exporter renders frames out of
order and faster than real time. You cannot ask a live analyser what the RMS was at
frame 5000. Building on live taps means **preview and export produce different videos.**

**Rule:** all audio features are pre-computed on import into dense **feature timelines** —
one `Float32Array` per (track, metric), sampled at a fixed rate (200 Hz), produced once by
a worker.

```ts
AudioFeatures.sample(trackId, 'band-sub', t)   // -> number, deterministic, any t
```

- Analysis runs **once on import**, in a worker, off the main thread.
- `RealtimeClock` and `FrameClock` sample the *same* arrays, so **what you preview is
  exactly what renders.** This is a product guarantee worth marketing.
- Live Meyda analysis is retained only for future live-microphone input, which by
  definition cannot be exported.
- Feature timelines serialise into the project file, so reopening a project does not
  re-analyse.

### HC-4 — Render backends

**Decided 2026-07-27.** Three mutually exclusive geometry systems were previously
specified. Resolved by making the render path an explicit, pluggable property of a scene
object rather than a global commitment.

```ts
type RenderBackend = 'mesh' | 'sdf' | 'points'
type MeshKind = 'procedural' | 'primitive' | 'imported'
```

| Backend | Morphing | Deformers | Cloners | Lighting / shadows | Status |
|---|---|---|---|---|---|
| `mesh/procedural` | **any↔any**, vertex lerp | yes | yes | yes | v1 core |
| `mesh/primitive` | swap only (crossfade) | limited | yes | yes | v1 |
| `mesh/imported` (GLTF) | swap only | no | yes | yes | v1 |
| `sdf` | **any↔any**, `smooth-min` | shader-space | shader-space repeat/mirror | own model | parallel module |
| `points` | n/a | GPGPU | n/a | additive | later |

Each backend implements one interface and is a self-contained module:

```ts
export interface RenderBackendModule {
  readonly id: RenderBackend
  create(obj: SceneObject): BackendHandle
  update(handle: BackendHandle, params: ParamSnapshot, clock: Clock): void
  dispose(handle: BackendHandle): void
  /** Which other objects this one can morph into. */
  morphTargets(obj: SceneObject): ID[]
}
```

**Why this and not one paradigm:** shared-topology meshes give true vertex morphing and
carry the whole deformer/cloner/lighting story, but every shape ends up topologically a
sphere. Native primitives give correct topology and UVs but cannot vertex-morph. SDF
raymarching morphs beautifully and for free but is a separate render path that does not
compose with meshes, cloners, or particles. Each is genuinely the best answer to a
different question.

**This satisfies "transform between any to any" honestly:** any↔any *within* the
procedural mesh family (vertex lerp), any↔any *within* the SDF family (smooth-min), and
*across* families it is a crossfade — which is what an NLE would do anyway.

`mesh/procedural` and `mesh/primitive` are built first because they unblock deformers,
cloners, and the entire modulation story. `sdf` is built as a parallel module to be
evaluated visually against them, not chosen on paper.

**Procedural mesh topology:** one subdivided icosphere, fixed vertex count, displaced per
shape type. Every procedural shape must satisfy
`geometry.attributes.position.count === BASE_VERTEX_COUNT`. Enforce this in a test.

### HC-5 — Parameters are addressed, not enumerated

A closed string union of target parameters cannot express a light's intensity, a
particle count, an effect's blend factor, or a brick that does not exist yet. It breaks
the moment a second object type appears.

**Rule:** a modulation target is an **address** resolved against a **descriptor registry**.

```ts
type ParamAddress = {
  objectId: ID
  /** undefined = a property of the object itself, otherwise an effect in its stack */
  effectId?: ID
  paramKey: string
}

interface ParamDescriptor {
  key: string
  label: string
  type: 'float' | 'int' | 'bool' | 'color' | 'vec3' | 'enum'
  min: number; max: number; default: number
  unit?: 'm' | 'deg' | 'x' | '%' | 'hz'
  /** Niagara "User Parameters": only exposed params are modulation targets. */
  exposed: boolean
  curve?: 'linear' | 'log' | 'exp'
}
```

Sources are symmetrical — a `FieldRef`, not an enum, so audio metrics, LFOs, noise,
beat phase, drop tension, and future field types are one uniform kind (Principle 12).

Every brick, effect, backend, and light **declares its descriptors**. The routing UI,
node graph, automation lanes, and serializer all read the registry. Nothing hardcodes a
parameter list.

### HC-6 — Typed node graph

Per Principle 3. `Signal` is the only type permitted to bind onto a parameter of another
type. Enforced in React Flow via `isValidConnection`, and independently in the engine —
the UI is not the validator.

### HC-7 — States reference, they do not copy

Per Principle 5. `Strip.stateId` is a reference. Editing a `VisualState` updates every
strip that points at it.

### HC-8 — Routing is global; States activate subsets

**Decided 2026-07-27.** Previously the type said connections belong to a State while the
store held one flat global array — a direct contradiction.

Resolved: **the modulation graph is project-global.** A `VisualState` holds a set of
*activations* — which connections are live, and per-state overrides of their weights.

```ts
interface VisualState {
  id: ID
  name: string
  sceneObjectIds: ID[]
  activeConnectionIds: ID[]
  connectionOverrides: Record<ID, Partial<SignalChain>>
  // ...
}
```

Why: if routing lived inside a state, every timeline cut would hard-reset every envelope
in the project. Musically that is almost always wrong — you want "drums → scale" to
survive the cut and only the *scene* to change. Global routing with per-state activation
gives both behaviours, and makes the common case (a link that persists across the whole
song) require zero work.

### HC-9 — One scene, one renderer

The 3D scene is a **singleton owned by the engine**, not by a page component. Mounting a
separate `<Canvas>` per workspace tab destroys and rebuilds the WebGL context, scene
graph, and all GPU resources on every tab switch.

Scene & Shapes and Camera are two *views of the same scene*. One persistent canvas is
mounted at the shell level; pages contribute overlays, gizmos, and docks.

### HC-10 — The dual camera is genuinely dual

Two distinct `PerspectiveCamera` objects exist at all times:

- **Scene Camera** — default `(0, 0, 50)` facing origin. **The only camera that ever
  renders output.** Driven by the camera track during playback and export.
- **Preview Camera** — free authoring camera. Fly (WASD + Shift/Ctrl, 6-direction) and
  Orbit sub-modes.

Which camera the *viewport* displays is a view toggle. It must never alter Scene Camera
state. Flying the preview camera around and then exporting must produce the framing the
camera track specifies, not wherever the user left the preview.

Fly and Orbit control schemes are mutually exclusive and must never be mounted
simultaneously — they both write `camera.position` and will fight every frame.

### HC-11 — Analysis is pre-fader; solo is an explicit flag

Tapping analysis after the track's gain node makes the **volume fader a visual fader**:
pulling a stem down to −20 dB silently kills its visual reaction, and muting kills its
visuals entirely.

**Rule:** the analysis tap sits **pre-fader**, immediately after the source node.
Solo-isolates-visuals (an explicit product requirement) is implemented as a flag the
modulation matrix reads — `isTrackVisuallyActive(trackId)` — not as a side effect of
audio gain.

### HC-12 — World units

`1 unit = 1 metre`. Origin `(0, 0, 0)` is the primary scene anchor. All spatial
parameter descriptors declare `unit: 'm'` and display accordingly.

---

## Store inventory

| Store | Owns | Never holds |
|---|---|---|
| `useUIStore` | active page, dock sizes, collapse state | anything persisted in a project |
| `useAudioStore` | tracks, trim, solo/mute/volume, loop region | `AudioBuffer`s (those live in the rack), playhead at frame rate |
| `useSceneStore` | **the SceneObject layer stack** — shapes, lights, emitters, backgrounds, images; selection | Three.js objects |
| `useModulationStore` | global connections, event triggers | evaluated values |
| `useCameraStore` | active camera view, control mode, keyframes, waypoints, constraints | live camera transforms during playback |
| `useProjectStore` | states library, timeline strips, markers, project metadata | anything derivable |

> `useSceneStore` is the centre of the application and does not exist yet. It is the
> next thing to build (Phase 3A).

**Nothing in any store may reference an `AudioBuffer`, a `THREE.Object3D`, a `GPUTexture`,
or a DOM node.** Those live in engine singletons, keyed by ID.

---

## Directory structure

```
src/
├── types/          Pure type declarations, zero runtime
├── store/          Zustand stores (see inventory above)
├── engine/         No React import anywhere below this line
│   ├── platform/   PlatformAdapter + Web/Tauri implementations
│   ├── time/       Clock interface, Realtime/Scrub/Frame clocks, TransportClock
│   ├── audio/      MultiTrackRack, AudioFeatures, analysis worker
│   ├── scene/      SceneGraph singleton, backends/{mesh,sdf,points}
│   ├── params/     ParamRegistry, descriptors, address resolution
│   ├── modulation/ ModulationMatrix, SignalShaper, EventTriggers
│   ├── camera/     DualCameraEngine, spline, constraints, interpolation
│   ├── timeline/   StateManager, BeatGrid, SectionEngine, transitions
│   ├── commands/   Undo/redo command history
│   └── export/     FrameRenderer, encoder worker
├── components/     React. Presentation only.
└── bricks/         Brick implementations + their param descriptors
```

**The `engine/` boundary is absolute.** No file under `engine/` may import React, a
store, or a component. Engine modules are driven by explicit calls and read state passed
into them. This is what makes offline rendering, testing, and a future non-React host
possible.
