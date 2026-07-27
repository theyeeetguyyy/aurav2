# AURA Studio — Tech Stack & Architecture Principles

> Decisions made, with reasoning, plus hard technical constraints the
> implementation must respect. Written for a coding AI to treat as ground truth
> before writing engine code.

## 1. Web vs. native — decision: web-first, wrapped in a desktop shell

### Why not fully native (TouchDesigner's approach)
TouchDesigner is fully native (Vulkan, C++ custom ops) because its target users
need protocol/hardware access a browser sandbox cannot reach:
- **NDI/Spout/Syphon** (GPU frame-sharing between apps, used to route visuals to
  other software/projectors) — OS-level, unreachable from a browser sandbox
  without a native helper process.
- **DMX/Art-Net** for physical lighting rigs — native-only.
- **Multi-projector/multi-monitor spanning** — trivial natively, awkward in a
  browser.
- **Web MIDI** works in Chrome/Edge/Opera/Firefox 108+, but **not Safari or
  iOS** — a real gap if any user is on Mac/Safari with a MIDI controller.

### Why none of that blocks AURA's v1
All of the above only matters for a **live-performance VJ tool**. AURA's
actual v1 target user (see market research doc) is a producer rendering a
finished mp3-driven video for YouTube/release — not someone running a rig at a
club. That workflow is: load stems → author a scene → scrub a timeline → hit
render → get an mp4. No NDI, no DMX, no multi-projector output required.

### Rendering performance reality (2026)
- Three.js's **WebGPU** renderer is production-ready with ~95% browser
  support; compute shaders now handle particle systems past **1 million
  particles**, up from a ~50,000 ceiling of old WebGL — comfortably covers AURA's
  particle ambitions.
- WebGPU compute delivers **2–3x** performance over old WebGL for
  compute-heavy workloads.
- Unity WebGL has **no WebGPU path** at all and won't gain ground the way
  Three.js will.
- On modern desktop hardware, both native and WebGPU-based web hit smooth
  60fps for moderate scenes — the gap only opens under heavy stress or weak
  hardware. Web is not literally equal to raw Vulkan/Metal (there's still an
  abstraction layer), but it's no longer the "toy tier" it was five years ago.

### Decision
Build **web-first**, wrapped in **Tauri** (preferred) or Electron as a desktop
shell. This gets:
- Approachability — browser-based demo/marketing version with no install friction
- A "real app" feel via the desktop wrapper
- Local file system access for loading stems and batch-exporting renders (the
  thing pure browsers are worst at)
- Three.js + WebGPU for real particle/shader power without touching C++
- An open door to add native modules later (NDI output, DMX) as an opt-in
  "pro/live" tier, without paying that architecture cost upfront

**Accepted tradeoff:** if AURA ever wants to compete for the live-club-VJ
audience running multi-projector rigs, a native (or native-hybrid) build will
eventually be needed. Not a v1 concern.

## 2. Confirmed technology choices

| Layer | Choice | Why |
|---|---|---|
| Build tool | Vite + TypeScript (strict) | Fast dev loop, type safety across a large engine |
| UI framework | React 18/19 + Tailwind + Lucide | Team familiarity, component ecosystem |
| 3D rendering | Three.js + React Three Fiber + Drei, **WebGPU renderer** | See performance section above |
| State management | Zustand | Right-sized; no Redux ceremony needed |
| Node graph UI | React Flow (`@xyflow/react`) | Mature, don't reinvent node-canvas interactions |
| Audio analysis | **essentia.js** (WASM port of Essentia C++ MIR library) layered with **Meyda** | Essentia covers deep MIR features (onset detection, beat tracking, spectral/band-energy) Meyda doesn't; Meyda is faster for lightweight real-time features (RMS, spectral centroid). Use Essentia for the heavy analysis, Meyda for cheap per-frame reads. |
| Audio playback/sync | Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `AnalyserNode`, `AudioWorklet`) | Native browser primitive, sample-accurate multi-track sync |
| Video export | WebCodecs API (`VideoEncoder`) + `mp4-muxer` | Modern browser-native encoding path, avoids ffmpeg.wasm overhead |
| App shell | Tauri (preferred) or Electron | See web-vs-native section |

## 3. Hard architectural constraints (must be respected from the first commit)

### 3.1 Audio-reactive data must bypass React's render cycle
`AudioAnalyser` produces values at frame rate (60x/sec) per track: rms, onset,
sub, bass, mid, treble, transient. **Do not** push these into Zustand/React
state and let components subscribe via React — this triggers a re-render
storm across every subscribed component, 60 times a second. This is the single
most common way audio-reactive R3F projects grind to a halt.

**Correct pattern:** per-frame audio-reactive values write directly into
**refs** or straight into **Three.js shader uniforms** inside `useFrame`,
bypassing React entirely. Only push to Zustand the values a human actually
needs to *see* update in the UI (e.g. a VU meter), and throttle that update
rate (e.g. 10–15fps is plenty for a meter, not 60fps).

This must be decided in `ModulationMatrix.ts`'s design *before* other systems
are built on top of it — retrofitting later means touching every consumer.

### 3.2 Any-to-any shape morphing requires a shared base topology
`position → targetPosition` vertex interpolation only works cleanly when every
morphable shape shares the same vertex count and correspondence. Sphere →
Torus → arbitrary custom mesh as genuinely different topologies will **not**
lerp cleanly — expect exploding/self-intersecting geometry mid-morph.

**Correct pattern:** generate all morphable shapes from **one shared base
topology** (e.g. a subdivided icosphere) and *displace* its vertices
differently per shape, rather than authoring genuinely different meshes.

**Explicit scoping decision needed:** which shapes are "morph-compatible"
(procedural, shared topology, can any-to-any morph) vs. "swap-only" (custom
imported GLTF/OBJ meshes with arbitrary topology — hard cut, no morph, or a
much harder volumetric/4D morphing technique reserved for a future version).
State this distinction explicitly in the shape system's type definitions.

### 3.3 Typed node graph, not a free-for-all
Following TouchDesigner's operator-family pattern (see tool research doc):
categorize graph nodes by signal type (e.g. `Signal` for audio/control data,
`Geometry`, `Camera`, `Material`) and constrain wiring to same-type by default.
Let `Signal` be the one type allowed to bind onto a parameter of any other
type (mirrors TouchDesigner's CHOP "Exporting" mechanism). This gives
"anything can be linked to anything" real structure and lets the UI
color-code connections meaningfully.

### 3.4 Dual view of the node graph: stack (default) vs. graph (advanced)
Following Unreal Niagara's pattern: build the real modulation logic as a
graph internally, but present a **simplified stacked list view by default**
("Drums → Radius: 50%, Guns → Explode Strength: 30%..."), with the full node
graph as an opt-in "advanced" toggle. Same underlying data, two UI skins. This
is the concrete mechanism for the "simpler than TouchDesigner" product goal —
don't force the graph view on everyone.

### 3.5 Modulation signal chain order
Per-connection in the modulation matrix, the signal should flow: **Gain →
Rise/Fall (attack/release smoothing) → Min/Max (range clamp) → Weight**, based
on Ableton's Envelope Follower design (see tool research doc). Not a flat
percentage — raw audio-to-parameter mapping without attack/release shaping
looks jittery and amateurish.

### 3.6 Two modulation mechanisms, not one
- **Continuous modulation** (the weighted matrix) — for smooth, ongoing
  changes (e.g. atmosphere track → slow background color drift).
- **Discrete events** (Niagara-style generate/listen) — for percussive,
  one-shot reactions (e.g. kick onset → fire one explosion burst). Don't force
  percussive hits through continuous blending; they need a trigger/response
  model instead.

### 3.7 States reference, not copy
Following Blender's NLA Action/Strip model: a **State** is a named, reusable
definition (the source of truth). What's placed on the NLE timeline is a
**reference** to that State, not a duplicate. Editing the source State updates
every placement of it on the timeline. This must be the data model from the
start — retrofitting reference semantics onto a copy-based system later is a
substantial rewrite.

### 3.8 Camera is an independent track, not nested in a State
Per the earlier design discussion (converged on by both Blender's NLA
constraint model and Unreal Sequencer's dedicated Camera Cut Track): camera
keyframes live on their **own track**, parallel to the state/visual track, not
nested inside each State. This allows continuous camera movement across state
cuts. Camera authoring happens in a spatial 3D panel (to place spline
waypoints), but the resulting keyframes are the same underlying data shown as
a track on the NLE timeline — one camera-keyframe store, two views (spatial +
temporal), not two disconnected systems.
