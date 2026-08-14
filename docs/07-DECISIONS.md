# 07 — Decision Log

Chronological record of locked decisions. **Every entry states its reasoning**, so a
future reader can tell whether the reasoning still holds rather than guessing at intent.

Format: `[date] · TITLE — decision. Why. What it forecloses.`

---

## 2026-07-24 — Foundation

**D-01 · Tech stack.** React 19 + Vite + TypeScript strict, over Next.js and over a
native C++/Rust build. *Why:* AURA is GPU-heavy with no SSR need; native buys hardware
access (DMX, NDI) that v1's audience does not use.

**D-02 · UI model.** DaVinci Resolve-style workspace pages with a bottom switcher,
rejecting the v1 monolith of floating popups. *Why:* five distinct modes of work, each
wanting the full window.

**D-03 · Incremental delivery.** Strict phase-by-phase milestones, each producing a
working build. No big-bang rewrites.

**D-04 · Build location.** New work in `aurav2/`; v1 retained as reference.

**D-05 · Open layer stack.** Replaced rigid primary/secondary shape slots with an
arbitrary-count `SceneObject[]` stack (Figma/Blender outliner). *Why:* the slot model
could not express "any number of shapes, plus lights, plus particles, plus backgrounds."
*Forecloses:* nothing — and it may have dissolved the primary/secondary question entirely (Q1).

**D-06 · Lego-brick architecture.** Atomic generic operator bricks; presets are Recipes —
named, editable combinations, never black boxes. *Why:* the product's stated purpose is a
high creative ceiling; canned modes are exactly what it exists to replace.

**D-07 · Unified Field signal type.** Audio metrics, noise, LFOs, feedback buffers and
tension signals are one type differing only in update rate. Any Field modulates any
parameter. *Why:* separate routing systems per signal kind multiply combinatorially.

**D-08 · Audio bypasses React.** Per-frame values go to typed arrays and uniforms, never
Zustand. *Why:* 60 Hz × N subscribers is the standard way audio-reactive R3F projects die.

**D-09 · Shared base topology for morphing.** Vertex lerp requires matching vertex count
and correspondence. *Superseded by D-20* — narrowed to one backend rather than a global rule.

**D-10 · Typed node graph.** TouchDesigner operator families; `Signal` is the sole type
that binds onto any parameter.

**D-11 · States reference, not copy.** Blender NLA Action/Strip. *Why:* retrofitting
reference semantics onto a copy-based model is a rewrite.

**D-12 · Camera is an independent track.** Blender NLA and Unreal's Camera Cut Track
converged on this independently. *Why:* camera nested in states hard-resets at every cut,
killing continuous movement.

**D-13 · Signal chain order.** Gain → Rise/Fall → Min/Max → Weight, from Ableton's
Envelope Follower. *Why:* a flat percentage with no attack/release looks jittery.

**D-14 · Two modulation mechanisms.** Continuous weighted blend *and* discrete
fire-once events. *Why:* percussion forced through continuous blending reads mushy.

**D-15 · Cloner + Effectors, not symmetry.** Cinema 4D MoGraph. *Why:* richer, more
musical, and reuses the modulation architecture instead of adding one.

---

## 2026-07-27 — Post-audit

> Following a full-codebase audit ([AUDIT-2026-07-27.md](AUDIT-2026-07-27.md)) that found
> 8 architectural contradictions, 5 design gaps, and 14 code defects. These entries
> resolve every contradiction found.

**D-16 · Documentation consolidated.** The old `PROJECT_KNOWLEDGE_BASE.md`,
`IMPLEMENTATION_PLAN.md`, `LEGO_BRICKS_REGISTRY.md`, `CODEBASE_ARCHITECTURE.md`, the
duplicated `DESIGN_SYSTEM.md`, and the `notes/` checklist are superseded by `docs/01`–`08`.
*Why:* the source of truth lived in the deprecated `aura/` folder; the feature checklist
existed twice and had already drifted; `DESIGN_SYSTEM.md` was byte-identical in two places.
Frozen originals remain in `legacy/aura-v1/`.

**D-17 · Repository layout.** `aura/` → `legacy/aura-v1/` (git history intact);
`notes/` → `aurav2/docs/research/` (now versioned, previously in no repo).

**D-18 · v1 is archived and mined, not ported.** The 24 modes are parts donors.
*Why:* porting monolithic modes into a brick architecture spends ~2 weeks producing
exactly the black boxes D-06 forbids. Extraction targets are listed in
[06-ROADMAP.md](06-ROADMAP.md) §9A.

**D-19 · Platform adapter — hybrid by construction.** Previous docs said both "Tauri
preferred" and "pure web SPA, desktop dropped." Resolved: all host capability sits behind
`PlatformAdapter`; browser ships now, Tauri drops in later with no engine change.
*Why:* batch rendering and stem relinking are real audience requirements that a browser
cannot serve, but a zero-install demo is real marketing value. Making it an interface
costs one file and defers the business decision indefinitely.

**D-20 · Render backends.** `mesh/procedural` · `mesh/primitive` · `mesh/imported` ·
`sdf` · `points`, each a self-contained module behind one interface.
*Why:* three mutually exclusive geometry systems had been specified — shared-topology
meshes (KB Constraint 2), native Three geometries (brick registry §2), and SDF raymarching
(brick registry §3). Each is genuinely best for a different question. Making the backend
an explicit property of a scene object means all are implementable and comparable **visually
rather than on paper**. *Supersedes D-09.* Morphing becomes a per-backend capability:
any↔any within a family, crossfade across families.

**D-21 · Features are timelines, not live taps.** All audio features are pre-computed
into dense arrays sampled by `t`. *Why:* the exporter renders frames out of order and
faster than real time; a live analyser cannot answer "what was the RMS at frame 5000."
Building on live taps would have made preview and export produce different videos —
discovered only at Phase 8, after every consumer was written against the wrong contract.
*Bonus:* enables automation-lane pre-visualisation and a real product guarantee — what you
preview is exactly what renders.

**D-22 · One time authority.** A single injectable `Clock` interface with realtime,
scrub, and frame implementations. *Why:* three ad-hoc clocks already existed (rack rAF,
R3F `useFrame`, and an implied export clock). Anything not drivable by `FrameClock`
cannot be exported, which means it is broken.

**D-23 · Parameters are addressed, not enumerated.** `ParamAddress` + `ParamDescriptor`
registry replaces the closed `TargetParam` / `SourceMetric` string unions.
*Why:* the unions covered 18 shape parameters and could not express a light's intensity,
a particle count, an effect blend, or any future brick — directly contradicting D-07's
promise that any Field modulates any parameter. Also delivers Niagara's "User Parameters"
(explicit exposure) and lets the UI derive range, step, and unit instead of hardcoding them.

**D-24 · Routing is global; States activate subsets.** *Why:* the type said connections
belong to a State while the store held one flat global array. Routing owned by states
would hard-reset every envelope at every cut — musically wrong in the common case, where
you want "drums → scale" to persist and only the scene to change.

**D-25 · One persistent scene and renderer.** *Why:* each page mounted its own `<Canvas>`,
so every tab switch destroyed and rebuilt the WebGL context and all GPU resources. Scene
& Shapes and Camera are two views of one scene.

**D-26 · The dual camera is genuinely dual.** Two real camera objects; only Scene Camera
ever renders output. *Why:* only one camera existed — "preview" moved the render camera,
the exact inverse of the spec. Fly and Orbit controls were also mounted simultaneously,
fighting over `camera.position` every frame.

**D-27 · Analysis is pre-fader; solo isolation is an explicit flag.** *Why:* the analysis
tap sat after the gain node, making the volume fader a visual fader and mute a visual kill.
Solo-isolates-visuals is a product requirement and deserves an explicit mechanism, not an
emergent side effect.

**D-28 · Undo is the command pattern.** Locked, ending a three-way contradiction across
prior docs. *Why:* `zundo` snapshots whole stores; AURA's stores would reference decoded
`AudioBuffer`s and GPU handles. Command pairs also coalesce slider drags naturally.

**D-30 · Event triggers are a generic decaying impulse, not a fixed action list.**
The spec named four actions — `explode`, `color-flash`, `scale-pulse`, `morph-snap`.
Replaced by: a trigger adds `amount` to any `ParamAddress`, decaying with time constant
`decay`. *Why:* the four actions are just impulses into four particular parameters, and
enumerating them contradicts HC-5 the same way the closed `TargetParam` union did.
"Explode" is an impulse into a deformer's strength; "flash" is an impulse into emissive
intensity. Simpler and strictly more capable.
*Also:* the impulse is derived from the AGE of the most recent onset at or before `t`,
never accumulated frame to frame — so discrete events stay a pure function of time and
survive scrubbing backwards and out-of-order export (HC-3).

**D-31 · `ParamDescriptor.realtime` gates frame-rate modulation.**
Geometry parameters rebuild the mesh. Wiring a kick to `radius` would re-tessellate 60
times a second and make the geometry cache unbounded. Geometry and resolution
descriptors are `realtime: false` and do not appear as modulation targets; transform and
material are `realtime: true`. *Why this rather than just allowing it:* offering a target
that silently cannot be driven is worse than not offering it. `scale.uniform` already
covers the common "pulse with the kick" case for free, and genuine continuous shape
change is what deformers (Phase 4G) are for — they displace an already-built mesh.

**D-32 · Offline analysis is hand-written, not essentia.js.**
A ~60-line radix-2 FFT covers RMS, peak, seven bands, spectral centroid, spectral flux,
onset detection and tempo estimation. *Why:* no WASM dependency, no AudioWorklet
plumbing, and full control over the normalisation step — which is the part that actually
determines whether the product feels responsive. essentia.js stays available if beat
tracking needs to be stronger than inter-onset-interval histogramming.

**D-39 · Every connection has an editable response curve.**
`SignalChain` gains `curve: CurvePoint[]` — point-based with per-segment exponential
tension, the model every DAW envelope editor already uses. Applied after Gain and *before*
Rise/Fall, so a gate curve genuinely gates rather than gating a smoothed average. Chain
order is now **Gain → Curve → Rise/Fall → Min/Max → Weight**.
*Why:* Gain and Min/Max control how much and Rise/Fall controls how fast, but nothing
controlled the *shape* of the reaction — whether quiet detail matters or only peaks do.
That is the single most expressive control in a modulation system and it was missing.

**D-40 · Routing shows real parameter values, not abstractions.**
The patchbay and the connection inspector display the span the parameter will actually
move between, in its own units — `1.00× → 2.50×`, `0.00 → 3.00` — computed by sampling
the curve rather than assuming its endpoints.
*Why:* "Min 0 / Max 1.5 / Weight 1" requires mental arithmetic to answer the only question
that matters. Sampling rather than assuming matters because a Band curve peaks mid-range
and returns to zero at both ends, so endpoint-only maths would report a range of zero
while the parameter visibly moves.

**D-41 · The modulation curve is drawn from the real engine.**
`previewConnection()` runs the actual `SignalShaper` over the actual feature timeline and
returns the values the parameter will take. The inspector graph and the per-stem signal
strips draw that, not an illustration of the settings.
*Why:* it is the "show me the LFO underneath" view, and drawing anything less than the
real thing would eventually lie. Only possible because features are timelines and the
chain is deterministic (HC-3) — a live-tap architecture could only ever draw the past,
never the four seconds ahead of the playhead.

**D-42 · The post chain is project-global and addresses itself with a reserved owner id.**
Post effects live in `usePostStore`, not in `SceneObject.effects`, and address themselves
as `{ objectId: '@post', effectId: <instance>, paramKey }`. `ParamAddress` is unchanged.
*Why:* bloom is a property of the frame, not of the sphere — hanging it off an object
would mean deciding which object owns it, and duplicating the object would duplicate the
bloom. The reserved id is what makes the patchbay, the modulation matrix, the inspector
and the serialiser handle a bloom knob with zero special cases. Ids come from
`crypto.randomUUID()`, so a leading `@` can never collide.

**D-43 · Materials are bricks; `MaterialParams` is open.**
The fixed eight-field material struct is replaced by `materialId` plus an open
`Record<string, ParamValue>`, with descriptors declared by a `MaterialBrick`.
*Why:* the old struct was exactly the closed enumeration HC-5 forbids, and it was the
direct cause of every object looking like the same grey plastic — there was one shading
model and no way to declare a second. Seven models ship (Standard, Physical, Unlit,
Gradient, Fresnel Rim, Toon, Normal). Descriptor keys keep the `material.` prefix so
addressing and serialisation are unchanged; stored values stay unprefixed, which is the
split `writeParam` already used.

**D-44 · The world is a fixed set of sections, not an open stack.**
Background, fog, lighting, reflections and grid live in `useEnvironmentStore` under the
reserved id `@env`, each section addressed as an `effectId`.
*Why:* a scene has exactly one background and one fog — an open stack would model
something that cannot happen. But every knob still needs to be a modulation target, and
reusing the effect slot of `ParamAddress` gets that for free. This is what finally
delivers the brief's routable background colour, and what makes light intensity and
angle drivable. Image-based lighting is generated from `RoomEnvironment` rather than
loaded from an HDRI: no asset, no network, and it is the single largest improvement to
how metal and rough surfaces read.

**D-45 · The render path reads `activeClock()`, not `TransportClock`.**
`engine/time/timeAuthority.ts` returns the transport during preview and whatever clock
the exporter installs during an offline render.
*Why:* HC-2 promises three implementations of one interface, but the render path named
one of them directly, which made the other two unreachable — `FrameClock` could be
constructed and nothing would ever read it, so "if a system cannot be driven by
FrameClock it is broken" was unenforceable. This is the seam that makes it enforceable.

**D-46 · Post effects may read time; deformers still may not.**
`PostContext` carries `time`; `DeformContext` still has no `time` (D-36).
*Why:* film grain that does not move is not grain, and a feedback trail is stateful by
definition. The rule that actually matters is not "no time" but "no time source other
than the clock": grain quantises `activeClock().time` into a seed, and the composer's own
wall-clock `time` uniform is banned. Anything animated from an internal accumulator would
render differently on the second export of the same project.

**D-47 · Cloners and effectors are separate bricks, and effectors may read time.**
A cloner lays copies out; effectors vary them. One cloner per object (a second would
overwrite the first's placement, so it is disabled rather than silently ignored); any
number of effectors, applied in stack order. All three kinds — deformer, cloner, effector
— live in one `EffectRegistry` and are told apart by which method they carry (`apply` /
`layout` / `affect`), not by a discriminant field, so the fifteen existing deformers
needed no edit.

`EffectorContext` carries `time`, which `DeformContext` deliberately does not (D-36). Not
a relaxation: the Time Delay effector's entire purpose is reading a signal at a moment
other than now, which is not expressible without time. It stays a pure function of it —
no accumulator, no frame counter — so scrubbing backwards reproduces exactly. The rule
that actually matters, here as in D-46, is *no time source other than the clock*.

That effector reads `AudioFeatures` directly rather than going through the modulation
matrix, and the reason is structural: the matrix evaluates one value per address per
frame, and this needs `count` values at `count` different moments. It also needs to name
a stem, which no static `enum` descriptor can express — hence the `stem` `ParamType`,
whose options are whatever the user has imported.

**D-48 · A light is a SceneObject; strobe is a wire, not a light type.** *(resolves Q2)*
Five light bricks — Point, Spot, Sun, Area, Ambient — registered in a `LightRegistry`
alongside the other four registries. A light is an ordinary `SceneObject` with
`type: 'light'`: same layer stack, same transform, same addressing. Position and rotation
come from the transform; intensity and colour become modulation targets the moment they
are declared as descriptors (HC-5).

*Why five:* none of them is reachable by configuring another. Point is a bulb, Spot a
beam, Sun parallel rays from infinity, Area a soft panel, Ambient unshaped fill.

**Strobe-on-hit is deliberately NOT a light type.** It is an onset trigger into
`intensity` (D-30, Principle 4). Enumerating "strobe light" as a kind would repeat exactly
the mistake the closed `TargetParam` union made — a fixed action where a generic mechanism
already covers it, and covers "flash the rim on the snare" too. This is the architecture
paying out: the lighting module needed no trigger code at all.

Shadows are opt-in per light, because each shadow-casting light costs a depth pass per
frame. Ambient and area lights do not offer the toggle at all — a test asserts that a
light only advertises a control it can honour.

Lights have no geometry, so they get an **authoring gizmo on a dedicated Three layer**
(`GIZMO_LAYER`). Both cameras display that layer while authoring; the exporter disables it
on the Scene Camera. A visibility flag would have been simpler and wrong — the viewport
IS the render, so anything drawn unconditionally ends up in the video.

The built-in three-point rig becomes **switchable** rather than a fixture. Once a user
lights the scene themselves it is competing with them.

*Not built:* volumetric shafts and lasers. Those are a *visible cone* — geometry plus a
light, not a light type — and belong with the mesh bricks (10-ELEMENTS §F).

**D-49 · Particles must be stateless; general-purpose particle libraries are rejected.**
`three.quarks`, `three-nebula` and every comparable library integrate state frame by
frame: `position += velocity * dt`. That is an accumulator, and under HC-3 the exporter
renders frame 5000 before frame 12 while scrubbing backwards must reproduce exactly. A
simulated particle system can do neither; the same project would export differently on
every run.

AURA's particle system will therefore be **stateless**: each particle's position is a pure
function of `(seed, birthTime, t)` — curl-noise advection integrated over a fixed step
count from birth, closed-form strange attractors, surface scatter from a deterministic
hash. Achievable, but it has to be designed in rather than discovered at Phase 8, and it
rules out the obvious dependencies. Full assessment in [16-LIBRARIES.md](16-LIBRARIES.md).

**D-50 · Camera behaviours are the timeline-independent half of Phase 7.**
Orbit, Sway, Handheld Shake, Dolly and Lens, stacked on the Scene Camera and evaluated as
pure functions of clock time. Every amplitude is a modulation target, so "shake rises with
the drop" is a wire (Principle 1: raw data plus a declarative behaviour layer).

*Why now, ahead of keyframes:* the research already flagged that camera keyframes need a
time axis Phase 6 has not built. Constraints and procedural motion do not. And this is
what the rest of the product was waiting on — feedback trails, zoom blur and kaleidoscope
are all effects on *movement*, and the only camera that renders had never moved. Preview
flying looked alive while the actual output was static, which is exactly what an export
would have shown.

`DualCameraEngine` now separates the **authored** transform (`baseScene*`) from the
**resolved** one (`scene*`). Behaviours are additive and re-evaluated every frame, so
writing orbit onto the authored value would accumulate and the camera would drift further
every tick — depending on uptime rather than on time.

Also adds **Align to this view**, which puts the Scene Camera where the Preview Camera is.
Its absence meant the camera that actually renders could not be aimed at all.

**D-55 · Automation belongs to a stem, not to a track of its own.** *(revises D-51)*
The first version put drawn curves on a shared panel under the rack. Wrong, and the reason
is worth keeping: **a detached lane has no time reference.** You are drawing to a beat you
cannot see, so "make it swell here" has no *here*.

Every imported stem now owns one lane, drawn directly under that stem's waveform on that
stem's timeline. You can see where the kick lands, so you know what moment you are
editing. It starts as the curve the analyser derived; drawing takes ownership; **Reset**
gives it back.

*A lane in `analysis` mode holds no points at all.* It defers to the feature timeline,
which is exact and costs nothing — no decimation error, no second copy to keep in sync,
and a stem with a hundred lanes' worth of data allocates none of it. The first edit
snapshots the curve into ~320 points and the mode flips to `edited`. One-way, so "what is
this showing me" always has a simple answer.

*Decimation is peak-preserving.* A 200 Hz timeline is 48 000 values over four minutes,
which is not a curve anyone can drag. But a kick is one or two samples wide at that rate,
so averaging into buckets would flatten exactly the transients the curve exists to
capture. Each output point takes the peak of its bucket instead.

*Solo still gates it.* The curve came from that stem, so isolating the stem isolates what
its curve drives (HC-11) — in both modes.

Detached lanes survive, for "I want a shape the music does not contain". They are the
exception now rather than the path, and they live in their own section.

**D-51 · Automation lanes are Fields, and the signal chain gains an input window.**
Two halves of one problem — "this stem barely moves", and "the routed range says 0→16 but
the visual does something else".

*Lanes.* A hand-drawn curve over project time is a `FieldKind: 'automation'`, sourced by
lane id. It appears in the patchbay beside stems and generators, wires to anything, and
sums with a stem through the same weighted N:1. It satisfies HC-3 trivially — a lookup by
`t` is already a pure function of time. Drawing happens on the **stems page**, under the
rack and on the same timeline, because a curve is drawn *against* what you are hearing and
the reference you need is the waveform directly above it.

*Input window.* `SignalChain` gains `inputMin`/`inputMax`, applied before gain, rescaling
the useful part of a source's range onto the full 0–1 the rest of the chain assumes.
Percentile normalisation makes each stem use all of 0–1 *across the whole file*, but
within any bar its envelope may only occupy 0.3–0.6 — so a parameter travels a third of
the range the settings promise. **Gain cannot fix this**: it multiplies, so raising it
clips the peaks long before it lifts the floor. `Normalise` measures the source's real
p2/p98 (`measureField`) and writes the two numbers.

*Why both:* honest numbers made the problem visible (`reachableRange`), the window fixes
the common case in one click, and the lane is the escape hatch for when the music simply
does not do what the visual needs. None of the three substitutes for the others.

**D-52 · Save/load ships with the platform adapter, and feature timelines are cached.**
*(delivers 3E and 8E together)*

The adapter exists to serve file I/O, and this is the first file I/O — building one
without the other would have meant writing the picker twice. `PlatformAdapter` is
installed once in `main.tsx`; **nothing outside `engine/platform/` may touch a file
picker, a download anchor or a Tauri API**, and the stem importer was moved onto it as
part of this (it had been a hidden `<input type="file">`).

*Stems are referenced, never embedded* — a project carrying its audio stops being a
document you can email. *Feature timelines ARE embedded*, base64-encoded: they are
derived, but re-deriving them means re-analysing every stem on every open, and analysis is
deterministic so the cache is the same answer rather than an approximation. Base64 of the
raw `Float32Array` is about a tenth the size of a JSON number array and lossless — which
matters, because a lossy cache would mean a reopened project modulates differently from
the one that was saved, breaking HC-3's guarantee.

*The browser cannot relink by path.* `canRelinkByPath` is false and the UI says so: a
reopened project has every wire, shape and drawn curve intact and no audio, with a
**Relink** action that matches re-picked files by name. Pretending the load succeeded
would be worse than admitting it half did.

*Format rules.* A file from a newer version is **refused**, not partially read — silently
dropping what a newer version added and then saving over the original is how work actually
disappears. A file from an older version has its missing collections filled: a project
saved before lanes existed is not corrupt, it predates them.

`useUIStore` is deliberately absent from the file. Dock sizes and the active page are not
project state.

**D-53 · Undo is the command pattern over *slice snapshots*, not store snapshots.**

The engine's `CommandHistory` holds `{label, undo, redo}` closures and knows nothing about
state — which is what makes it testable without a single store. The bridge above it
(`src/project/history.ts`) captures a **slice snapshot**: only the parts of the project an
action declares it touches, so adding an object does not snapshot the automation lanes.

*This does not contradict the rejection of `zundo`.* That decision rejected snapshotting
**stores**, because stores hold `AudioBuffer`s and GPU handles. No slice here contains
either: stems, decoded audio and feature timelines are deliberately absent. An undo cannot
unload your audio, and a keystroke does not cost a megabyte of cached analysis.

*Stores record ahead of mutating.* `recordChange(label, slices, coalesceKey)` is called at
the top of an action, because the state about to be replaced is the natural thing to
capture. The redo side is captured lazily on the first undo — the only moment it is known,
and free until then. Stores reach the recorder through `store/historyHook.ts`, which holds
a callback and nothing else; without that indirection the bridge and the stores would
import each other and the module graph would cycle.

*Coalescing is the feature that makes it usable.* A scrub drag emits a change per pixel.
Entries sharing a key inside 600 ms merge, keeping the **oldest undo** (before the drag)
and the **newest redo** (where it ended). Without it, one drag would cost two hundred
presses of Ctrl+Z.

*Re-entrancy is guarded.* Restoring a snapshot writes to stores, and those writes call
`recordChange`. `CommandHistory.push` ignores anything pushed while applying, or an undo
would push its own inverse and the stack would never drain.

View state is deliberately not undoable: selection, active camera, dock sizes, the post
master bypass. Ctrl+Z should reach the last thing you *changed*, not the last thing you
looked at. Loading a project clears the history — undoing into a document that no longer
exists is worse than having no undo.

**D-54 · Export renders through the LIVE renderer; only encoding is separate.**
§4.6 specified a worker with `OffscreenCanvas`. Overruled, for one reason: the scene is
built by React components, so a worker renderer would be a **second scene-construction
codepath** — and two codepaths is exactly how "what you preview is what renders" stops
being true. The exporter drives the same renderer the viewport does, through a
`FrameSource` the viewport publishes.

Encoding is not the cost that buys. `VideoEncoder` is hardware-backed and already runs off
the main thread inside the browser; what stays on it is a queue push per frame and a muxer
write per chunk. What is gained is `encodeQueueSize` being directly readable, which keeps
backpressure a four-line loop instead of a message protocol — and without backpressure a
fast GPU queues thousands of full-resolution `VideoFrame`s and the tab runs out of memory
before the render ends.

Two details that are easy to get wrong and fatal when wrong:

- The `VideoFrame` is constructed **in the same task as the draw**. A WebGL drawing buffer
  is cleared at compositing time, which happens when the task yields — reading it later
  captures black.
- `flush()` before `finalize()`, always. Skipping it produces a file that looks complete
  and will not play.

The Scene Camera is forced for the duration (HC-10) whatever the user is looking through,
and the gizmo layer is disabled on it so authoring furniture never reaches the file.

This is also the **first thing that exercises HC-2 and HC-3**. Every "pure function of
time" note in this codebase is a promise that gets called in here.

**D-56 · Stems are remembered by handle, not by path.** *(corrects D-52)*
D-52 recorded `canRelinkByPath: false` and treated a reopened project with no audio as an
honest limitation of the host. That was too pessimistic. A browser cannot store a *path*,
but `showOpenFilePicker` returns a `FileSystemFileHandle`, which is structured-cloneable
and therefore survives in **IndexedDB** across sessions.

So a saved project reopens with its own audio. Better than a path, in fact: a handle
survives the file being renamed or moved.

Only the permission needs re-granting, and that has one rule worth stating because getting
it wrong is invisible: **requesting permission needs a user gesture.** A project load is
not one. So the restore runs in two passes — a silent pass on load that recovers whatever
is still granted, and a **Restore** button that asks for the rest in a single click for
every stem at once.

*Drag-and-drop carries no handle.* Files dropped onto the rack come from a `DataTransfer`,
which yields `File` and nothing reopenable. Those still need re-picking, and the Restore
button falls through to the file dialog for them. Picking through the button is the path
that remembers — the tooltip says so rather than leaving it to be discovered.

Handles are forgotten when a stem is deleted, or storage accumulates entries for files no
project references any more.

**D-57 · Light intensity defaults are scaled to scene distance.**
Three has been physically correct since r165 — `useLegacyLights` is gone, point and spot
intensity is candela, and with `decay: 2` it falls off as 1/d².

A light spawns at (12, 14, 12), which is 22 units from the origin, so d² is 484. The
original default of 60 arrived at the object as **0.12** and read as "lights do not work".
Defaults are now `desired_brightness × d²` at the distance lights actually sit — large
numbers, but derived rather than guessed, and named as `SPAWN_DISTANCE_SQUARED` so the
relationship survives the next edit. Directional and ambient lights are distance-
independent and keep small numbers.

**D-36 · Deformers cannot animate themselves.**
`DeformContext` has no `time`. A deformer is a pure function of its parameters; all
motion arrives through modulation. `Noise Wave` and `Wave` lost their `speed` parameter
and gained `phase`, which a saw LFO drives.
*Why:* built-in motion produced movement the user never asked for, could not switch off,
and could not sync to anything — the opposite of the product's premise that the music
drives the visuals. Removing `time` from the contract makes it structural rather than a
convention; `deformers.test.ts` asserts the absence, so reintroducing it means arguing
with a test. *Consequence:* nothing moves while the transport is paused, which is the
same property that makes preview identical to export (HC-3).

**D-37 · Generators are first-class synthetic stems.**
LFOs and noise are user-created entities with a name, colour, type, rate, phase offset,
depth and bias, listed in the patchbay beside imported audio — not a fixed dropdown of
five options.
*Why:* D-36 means anything moving on its own needs a driver, and you routinely want
several differently configured. "A slow sine for background drift" and "a fast saw for
the strobe" are two sources you name, not one LFO reconfigured per connection. They are
kept in their own store rather than folded into `useAudioStore`, which would mean a dozen
permanently-null fields (buffer, trim, solo, analysis).

**D-38 · Deformers are selected for structural distinctness, not count.**
Fifteen deformers, each a different *class* of vertex operation: radial, axial,
field-based, angular-along-axis, angular-by-radius, periodic, distance-ring, cellular,
gravitational, warp, banded, volume-coupled, discretising, point-field, normalising.
*Why:* value is in how they combine, so "explode but slightly different" earns nothing
while a genuinely new class multiplies with all fourteen others. Catalogue and the
distinctions worth knowing: [12-DEFORMERS.md](12-DEFORMERS.md).

**D-33 · Deformers displace on the CPU, not in a shader.**
Six deformers run as whole-array passes over a per-object working geometry, re-normalised
each frame. *Why:* 642 vertices × a handful of objects is nothing (well under a
millisecond), and CPU displacement keeps correct normals, shadows and standard materials
for free. A vertex-shader path breaks shadow casting unless the depth material is patched
too, and recomputing normals in-shader is genuinely awkward. *Revisit when:* cloners (4H)
multiply vertex counts by 50×, or particle counts get large — then the `points` backend
and GPU displacement earn their complexity.
*Also:* geometry is shared between objects using the same brick and parameters, so an
object with an active deformer stack gets a private working copy. Objects without one keep
the shared geometry and allocate nothing.

**D-34 · Routing becomes a patchbay, not a node canvas.**
Two fixed columns — sources and targets — with a live wire layer between, and
drag-to-connect as the single gesture. *Why:* the wires are what TouchDesigner gets right
(direction is visible, signal visibly flows); the free canvas is what it gets wrong for
this audience (node layout becomes project state, 8 stems × 13 metrics is 104 potential
nodes, and spaghetti is a known failure mode). A patchbay keeps the wires and drops the
canvas. The node graph still ships as the advanced view (5C) for what a patchbay cannot
express — processor nodes, object-to-object routing. Full reasoning in
[11-ROUTING-UX.md](11-ROUTING-UX.md). *Supersedes* `StackedRoutingList.tsx`, which is
replaced rather than extended.

**D-35 · Elements, not modes.**
v1's 24 modes are mined for *element families* — geometry, data-driven, particle, field,
environment, light, overlay, post-process — rather than for individual looks. *Why:* a
mode is a whole screen and combines with nothing; an element shares the layer stack,
transform, parameter registry and modulation matrix with everything else, so element
families multiply where modes only add. Catalogue and build order in
[10-ELEMENTS.md](10-ELEMENTS.md).

**D-29 · Section awareness is restored and is the answer to "musical narrative."**
The section-aware intensity engine shipped in v1 (`js/markers.js`) and was dropped from
the v2 design by accident. Combined with memory-carrying Fields (`drop-decay`,
`is-buildup`) and object-to-object routing, it is the concrete mechanism behind the brief's
"story, tension, call and response" — which had sat as an open philosophical question
through every prior document. *Why it matters:* frame-local metrics like RMS structurally
cannot express "tension building over eight bars."

**D-58 · The timeline and the editor's own toggles are one channel, and exactly one wins.**
`isVisible(objectId, authored)` takes the authored eye-toggle value and *replaces* it while a
strip is live, rather than being ANDed with it. Same for `isConnectionActive` and
`isPostActive`. *Why:* capturing a state reads precisely those toggles (HC-7 — a state is a
selection, not a copy), so consulting both means a state can never switch on something the
user has since hidden — both answers would have to be true, and one of them is stale by
construction. With one authority at a time, the eye icon works on an unsequenced project and
the timeline works on a sequenced one, and neither has a hidden failure mode. *Consequence:*
meshes and lights now mount regardless of visibility and are hidden via `.visible` in the
frame loop. A hidden mesh is skipped before any draw call, so this costs nothing, and it
means a cut is a boolean write rather than a remount of the layer stack (HC-1).

**D-59 · An empty timeline means "everything", and so does a gap.**
`resolveTimeline([], …)` returns a shared constant with every field null. A gap between
strips returns the same. *Why:* every project is unsequenced before it is sequenced, and
"mp3 → good-looking mp4" has to be reachable without ever opening the timeline — sequencing
is opt-in, not a prerequisite. Cutting to black in a gap is nearly never what someone meant
by leaving a space; holding the look is. Returning an identical object reference in the
common case also means the per-frame driver allocates nothing.

**D-60 · Markers join the snap grid; the snap window is in pixels, not seconds.**
`snapToGrid(time, grid, tolerance)` takes tolerance in seconds and the caller derives it from
zoom (`SNAP_WINDOW_PIXELS / pxPerSecond`). Section markers are appended to the detected beat
grid. *Why:* a fixed time window cannot feel right at two zoom levels — 0.12s is 48px of dead
pull when zoomed in and half a pixel across a whole song, i.e. grabby exactly where precision
is wanted and absent exactly where snapping is the only way to hit anything. And a moment
someone bothered to name is the moment they most want to cut on; it also still works when the
tempo detector guessed wrong, which the beat grid does not.

**D-61 · Post-processing rebuilds its chain at a cut; everything else reads a flag.**
`useTimelineCut` re-renders `PostChain` when the live strip set changes. Every other consumer
reads `isVisible`/`isConnectionActive` inside its own `useFrame` and never re-renders. *Why:*
an effect is either compiled into a merged fullscreen pass or absent from it — there is no
per-frame switch. Gating via `blendMode.opacity` was considered and rejected: several bricks
(grain, vignette) own that uniform themselves, so gating would stomp an authored parameter,
and the effect would keep costing GPU time while contributing nothing. Rebuilding happens a
handful of times per song, never during a static passage. *Known limitation:* during an
offline export the React rebuild lands after `advance()` returns, so a post-chain cut can be
one frame late. Logged as D14 in [15-BUILD-PLAN.md](15-BUILD-PLAN.md).

**D-62 · `projectDuration` has one definition.**
The furthest trim end across every stem, exported from `useAudioStore` and used by the stem
rack, the timeline and the exporter. *Why:* it had been re-derived in three places, and the
last time each waveform measured its own buffer instead, the rack drew four playheads that
disagreed (D2). A shared definition is what makes the rack one timeline rather than N.

**D-63 · An unused store action is either wired or deleted, never left sitting.**
Auditing `useProjectStore` after Phase 6 found five actions nothing called. Three named real
gaps and were wired: `setProjectName` (the project name became the `.aura.json` and the `.mp4`
filename and was unchangeable — now editable in the top bar), `updateState` (states were stuck
as "State 1/2/3", which is unusable at four of them — now renameable in place), and `setBpm`
(the detected tempo was analysed, serialised, and never once shown — now set by the first stem
that reports one and displayed in the timeline header). Two named nothing and were deleted:
`addState` and `clear`. *Why:* an unused action reads as a feature to a later reader, so it
gets maintained, serialised and tested for a capability the product does not have. This is the
same failure as `forgetHandle` (D12) and `add-marker` (Phase 1 → 6C): written, registered,
never called. Both edits that record history coalesce per id — renaming is typing, and one
undo step per keystroke is worse than none.

**D-64 · The Scene Camera's transform is a parameter, and that is the whole keyframe system.**
`position.x/y/z`, `rotation.x/y/z` and `fov` are registered as descriptors under `@camera`
with no effect id, stored in `useCameraStore.transform`. *Why:* the camera that renders was
the least controllable object in the product. Its transform lived as raw vectors on
`DualCameraEngine`, writable only by *Align to this view*, so a camera move had to be **picked
from a list of five behaviour shapes** rather than authored — which is exactly the "modes"
complaint the element model (D-35) was supposed to have retired. Because everything
downstream addresses parameters rather than enumerating them (HC-5), one registration gives
all of it at once: numeric fields in the panel, seven new patchbay targets so a stem can drive
a dolly, and — the point — an **automation lane against `position.z` is a dolly on a time
axis**. That is keyframing, using the curve editor that already exists rather than a second
one that would have to agree with it. Behaviours stay, additive on top of the authored value;
they are for shapes you would not want to draw by hand, like handheld shake.
*Consequence:* `alignSceneToPreview()` and `resetSceneCamera()` moved off the engine into
store actions — the driver rewrites `baseScene*` from parameters every frame, so anything
writing them directly would be overwritten on the next tick. `CameraKeyframe`,
`SplineWaypoint` and `CameraConstraint` are **deleted**: three store slices with add/remove/
update actions and zero readers, i.e. a keyframe system that existed only as a type (D-63).
Spline paths, when they land, belong as a behaviour brick that reads a curve.

**D-65 · Look-at applies with or without a behaviour.**
`CameraRigDriver` no longer early-returns on an empty behaviour stack. *Why:* an empty rig is
the identity — zero offsets, `distanceScale` 1 — so the same code path reproduces the authored
transform exactly, and *Aim at target* now works on a locked-off camera. It previously did
not: the checkbox is on by default and did nothing at all until an Orbit was added. The
spherical round-trip is skipped when nothing orbits, because it is not a true no-op — a camera
sitting exactly on its target has radius 0, and the clamp would nudge it to 0.01.

**D-66 · Render targets follow the drawing buffer, never React's `size`.**
`PostChain` reads `gl.getDrawingBufferSize()` each frame and resizes the composer when it
changes. *Why:* the exporter resizes the drawing buffer with `updateStyle: false` on purpose,
so the CSS box does not jump mid-render — which means R3F's `size` and the actual buffer
disagree for the entire export. Following `size` allocated every render target at *preview*
resolution and upscaled the result into the file, so a 1080p export with any effect enabled
was a blurry 1080p. Resolution-dependent uniforms (kaleidoscope's aspect, grain's cell size)
read the same buffer, or they would change appearance between preview and file.

**D-67 · R3F's own loop stands down during an export, and Deliver hosts the viewport.**
`ExportBridge.begin()` sets `frameloop: 'never'` and restores it. Deliver has a monitor above
the timeline. *Why, for the first:* with the loop running, the browser's rAF kept firing
between the exporter's hand-driven frames, feeding wall-clock timestamps into the same
`useFrame` subscribers — so anything reading `delta` (feedback trail decay, grain) saw garbage
interleaved with real frames, and the render was neither correct nor reproducible. *Why, for
the second:* the exporter drives the live renderer (HC-9), and Deliver had no `ViewportSlot`.
With no on-screen box the canvas measured **1×1**, which is what every post-processing render
target was allocated at. The monitor is also the only way to see what a cut looks like while
placing it.

**D-68 · The H.264 level is derived, then confirmed with the browser.**
`avcCandidates(width, height, fps)` returns codec strings from the lowest sufficient level
upward, and `configure()` takes the first that `VideoEncoder.isConfigSupported` accepts.
*Why:* a hardcoded level is a resolution ceiling hiding in a string literal — level 4.0 caps
at 8192 macroblocks, which 1080p (8160) sneaks under and 1440p (14400) and 4K (32400) do not,
so two presets the UI offered had never worked once. Frame *rate* matters too: 4K@60 needs
2.07M macroblocks/second, past level 5.1's 983k. Lowest-sufficient-first because a lower level
is more widely playable — a phone that decodes 4.0 in hardware may drop to software at 5.2 —
and the higher levels stay in the list as fallbacks for encoders that under-report.

**D-69 · Authoring furniture is a layer, and everything that qualifies must be on it.**
The selection outline moved onto `GIZMO_LAYER` alongside the light gizmos. *Why:* the layer
already existed and the exporter already disabled it, but the outline was a plain mesh and so
was never excluded — selecting a shape before pressing Export baked a wireframe cage into the
video. The rule is now explicit rather than incidental: **anything drawn to help the author
and not to appear in the film goes on `GIZMO_LAYER`**, and adding such a thing without setting
its layer is a defect, not an oversight.

**D-70 · A new object gets the next colour, not the default colour.**
`addObject` rotates `paletteColor` over the shape count. *Why:* three shapes arriving in the
same indigo is the same failure D-43 named — "everything is grey plastic" — in a nicer colour,
and picking a colour per object is the most common first edit anyone makes. Starting varied
skips it, and a fresh scene reads as composed instead of unfinished. Lights are excluded: a
light's colour is a lighting decision, not an identity.

**D-71 · Placement finds a free slot; an aimed drop does not get one found for it.**
`findFreeSlot` prefers the requested lane, then any free lane, then appends after everything.
`placeStrip` uses it only when the caller passes no lane. *Why:* two *Place* clicks at the
same playhead used to land exactly on top of each other, and by the higher-lane-wins rule the
buried one was inert as well as invisible — a button that looked broken. But a double-click on
lane 2 means lane 2; deciding otherwise would make the drop target a lie.

**D-72 · `step` interpolation belongs on the stem lane, because the snap is the move.**
`StemAutomation` now carries the interpolation picker, with `step` described as what makes a
snap rather than a ramp. *Why:* the engine has sampled all three modes since it was written and
`LaneInterpolation` has always had three members, but the control existed only on the
detached-lane panel — the exception. On the primary path (D-55) a drawn curve could only ease,
which means the one camera move this genre is built on, the hard snap-zoom, was undrawable in a
product whose entire premise is cutting to music. This is the third instance of the same
pattern: a capability fully implemented in the engine and unreachable from the UI (`add-marker`
in Phase 1, `forgetHandle` in D12). **An engine feature with no control is not a feature.**

**D-73 · A creation affordance never lives inside the thing it creates.**
*Draw a curve* moved out of `AutomationPanel`'s header and into the page footer beside *Add
more stems*. *Why:* the panel now hides itself when there are no detached lanes — correctly, an
empty dock is furniture — and the `+` that made one was inside it. A door on the inside of the
room. Worth stating as a rule because the same shape is easy to reproduce anywhere an empty
state is hidden rather than shown.

**D-74 · Auto-sequence derives variations from the scene; it never invents content.**
`generateVariations` returns four states — Intro / Build / Drop / Breakdown — each a *subset*
of what is already there, and `planSequence` lays them across the song. *Why:* the first real
end-to-end run made the actual gap obvious. Building a good-looking frame is already easy;
turning it into a piece was four deliberate steps (capture, capture, place, place, drag) that
most people would never take, and a static three-minute shot is not what anyone came for. This
is only possible because a state *selects* rather than owns (HC-7) — so the whole thing is a
pure function over id lists, every strip is an ordinary state the user can edit or delete, and
the output is always something they recognise as theirs.

Two rules keep it usable rather than merely varied, and both were learned by writing the naive
version first: **lights are in every variation** (a variation without them is a black frame —
technically a different look, never the one anyone wanted), and **every wire stays live** —
routing is project-global with states activating a subset (HC-8), but dropping wires makes a
section *static*, which reads as broken rather than as restrained. Intensity is 6C's job.

**Markers win when they exist.** Someone who marked the drop has told us more about their track
than any heuristic can infer, so the marker's *type* selects the variation rather than its
turn in a rotation. With no markers it divides evenly and walks the arc — a guess, but a guess
in the right shape, and a wrong division costs one drag rather than a redo. It **replaces** the
timeline rather than layering onto it: burying hand-placed strips under generated ones would
make survival depend on lane order instead of on intent.

*Verified in the exported file*, which is the only place it counts: mean luma 14.6 → 35.1 →
38.6 across Intro, Build and Drop, with Breakdown landing between the two. The arc is real, not
just four differently-named states.

**D-75 · Cut Flash: admit the cut and hit it.**
A post brick that reads `cutTime` from the resolved timeline and decays exponentially from it.
*Why:* 6E's crossfade is the obvious way to *soften* a cut and it is still worth building, but
the cheaper and — for this audience — more useful move is the opposite one. A single bright
frame on a strip boundary is the difference between the picture having changed and the picture
having landed, and it reads at any tempo.

Keyed off the **edit**, not off an onset: it stays in sync when you drag the strip, and it does
nothing at all on an unsequenced project rather than firing at arbitrary moments. `t - cutTime`
is a pure function of the clock (HC-3), so an offline render that asks for frame 5000 before
frame 12 gets the same flash either way — which is why `cutTime` is published by the resolver
rather than tracked as a "time since last cut" accumulator. It is the **latest** boundary among
live strips: with a background strip running under a drop, the moment the picture changed is
when the drop came in. Confirmed in the export at 220.9 luma on a 6-second boundary against a
38.6 baseline.

**D-76 · REVERSED: auto-variations are deleted. A State is scene + routing, and nothing else
decides one for you.**
`generateVariations` / `planSequence` / `autoSequence` are gone, along with the Intro / Build /
Drop / Breakdown arc. *Why:* rejected outright — *"I don't want those intro drop and everything
pre refined states."* The implementation was fine and the premise was wrong. A **State** in this
product means **the scene plus its routing**: what is present and what drives it. It is a unit
of authorship, not a musical section, and generating four sections was the product guessing at
content instead of arranging the user's. Deleted rather than adapted, because a musical-arc
generator has no smaller correct version. *This retires D-74.* The remaining machinery — states
as selections, strips as references — is untouched and is what the Timeline page arranges.

**D-77 · The tabs ARE the pipeline, and Timeline is a page.**
Seven workspaces, left to right: **Media & Stems** (pull automation out of the audio) →
**Scene & Shapes** (build a state) → **Look / Routing / Camera** (refine it) → **Timeline**
(arrange states in time — *this* is the video) → **Deliver** (write the file). *Why:* the
timeline was half of Deliver, which made encoding look like the point when the timeline is where
the video is actually decided. Splitting them also gives each its own answer to "what is this
page for", which is the one-page-one-job rule (05-DESIGN-SYSTEM) applied to the two jobs that
were sharing. Both pages still host a viewport, because the exporter drives the live renderer
(HC-9) and a page without one renders the whole chain at 1×1 (D-67).

**D-78 · States are captured where they are built.**
The state selector moved from the timeline rail to a panel under the layer stack on Scene &
Shapes; the timeline keeps only *Place*. *Why:* capturing on the arranging page meant leaving
the thing you were looking at in order to record it, and it made a State read as a timeline
feature rather than as the unit of work. Authoring and arranging are now on the pages named for
them: Scene & Shapes has capture / edit / save / rename, the Timeline has placement.
`editingStateId` tracks which state is loaded — deliberately **not** saved to the project, since
it says which state you were last looking at, which is session state and not document state.

**D-79 · Every picture of time is seekable.**
A scrub bar in the transport strip, present on every page, plus click-to-seek on the stem lanes.
*Why:* only the two pages that happened to draw a timeline could move the playhead, so hearing a
specific moment while editing a material meant switching tabs, scrubbing, and switching back.
The scrubber also carries the section markers, which makes it a map rather than a slider — the
one thing on every page that says where the drop is. Drawn imperatively from `TransportClock`
via `scaleX` (HC-1): it moves every frame, and a component that re-rendered for it would
re-render the shell sixty times a second.

**D-80 · Drawn curves are rows in the stem rack, not a dock.**
`AutomationPanel` is deleted; `DrawnLaneRow` renders each detached lane under the stems, in the
same shape as a stem's own curve, sharing the same left inset so every curve on the page reads
against one time axis. *Why:* a drawn lane and a stem lane are the same kind of thing — a signal
on this project's timeline that anything can be wired from — and the only difference is where the
shape came from. A separate dock made it look like a separate feature and, before D25, listed
every stem curve twice. This is the first structural step toward **stems as automation sources
rather than waveforms**; the rest is Pass C.

**D-81 · The routing strip graphs the metric you are reaching for.**
Clicking a metric under a stem's signal strip redraws the strip for that metric. *Why:* it was
hardwired to `envelope`, so it drew the same shape regardless of which of thirteen signals you
were about to wire — a picture answering a question nobody asked. The preview fires on
*pointer-down*, before the drag begins, so the shape is on screen while you aim: press-and-look
is one gesture rather than two.

**D-82 · Selection outline: a hugging shell on simple shapes, a box on dense ones.**
Above `OUTLINE_SHELL_MAX_TRIANGLES` (600) an object's selection indicator switches from the
inflated back-face shell to the same wireframe bounding box a cloned array gets. *Why:* the
shell traces the silhouette exactly, which is why it is right on a cube or a cone. On a
subdivided icosphere it is several hundred lines drawn over the art — it hides the thing it
exists to point at, which is the same failure the per-clone shells had (D5). A box is less
precise and always legible, and precision is not what a selection indicator is for. The box is
sized from the geometry's own bounding sphere each frame rather than once, so a deformer's
displaced vertices are inside it.

**D-83 · Automation is clips over patterns, not one curve per lane.**
Three objects where there was one. A **lane** is the wireable identity, a **clip** is a placement
(start, length, repeat), and a **pattern** is the shape, stored in **normalised 0–1 time** so it
has no length of its own. Patterns are project-global; clips reference them.

*Why:* the old model — one curve per lane spanning the whole project — cannot express the thing
people actually ask for. *"I draw a shape that takes a second and I want it to happen every
second for ten seconds"* meant drawing it ten times, and changing your mind meant redrawing it
ten times. It is the same Action/Strip split that already works for visual states (HC-7) and the
same one Blender's NLA uses, arrived at for the same reason.

Three consequences worth stating:

1. **`repeat` is on the clip.** FL Studio would have you clone a clip ten times; Blender puts a
   repeat count on the strip. The count wins here because dragging the clip's edge then retimes
   every cycle at once, which a hand-copied row of clips can never do.
2. **Duplicating shares the pattern.** Blender offers linked and unlinked duplicates; this offers
   only linked, because "so that I don't have to remake them every time" is a request for the
   linked one and there is no use for the other. A copy lands immediately *after* the original —
   in place it would sit on top, and since later wins, the *original* would be the one that
   stopped playing.
3. **A pattern outlives the clip that made it.** Patterns are deliberately not garbage-collected
   when their last clip goes. A shape you spent time drawing should survive deleting the clip you
   drew it for; the cost of keeping one is a few hundred bytes.

**D-84 · `LaneMode` is deleted. Clips override the analysis exactly where they cover it.**
A lane no longer carries `analysis | edited`. `clips.length === 0` says the same thing and cannot
disagree with the data it describes, which a flag can. More usefully, the *semantics* changed:
where a clip covers time, the clip wins; everywhere else a stem lane resumes its analysed signal.
So "the kick drives this, except during the drop where I want my own shape" is two objects and no
modes — and it was previously inexpressible, because the first edit took the whole lane
irreversibly into `edited` and silenced the analysis for the entire song. *Resetting* is now
"delete the clips", which needs no special action beyond the one that already exists.

**D-85 · One interpolator, one drawing routine.**
`samplePoints(points, interpolation, t)` is the only place curve values come from. The clip track
draws with it, the pattern editor draws with it, and the engine reads through it via
`sampleClips`. There is a test asserting the track and the engine agree at the same phase. *Why:*
the previous editor sampled per pixel through the *lane's* sampler specifically so the drawn line
matched what ran; splitting patterns out of lanes would have quietly broken that guarantee unless
the interpolator came with it.

**D-86 · Project format v2, with a real migration.**
`PROJECT_VERSION` is 2. A v1 lane's `points` become a pattern (via `patternFromPoints`) plus one
clip spanning what was drawn, so an old file reopens looking and sounding the same — and its
curve is now something that can be shortened, moved and reused. A v1 lane in `analysis` mode had
no points and converts to a lane with no clips, which means precisely the same thing in v2. The
bump matters in the other direction too: an older build now refuses a v2 file rather than
half-reading it and saving over the original, which is the whole reason the field exists.

**D-87 · Patterns travel with lanes through undo.**
The `lanes` history slice snapshots `{ lanes, patterns }` together. *Why:* a clip references its
pattern, so the shape lives in the pattern table — undoing a curve edit that restored only the
lanes would restore nothing at all. They are one unit of history because they are one unit of
meaning.

**D-88 · A stem exposes the signals you selected, and a signal is a lane.**
One lane per (stem, metric) pair, created by ticking that metric on the stems page. Routing lists
lanes; it no longer lists raw metrics at all. *Why:* the analyser produces thirteen signals per
stem and almost nobody wants thirteen — four stems meant **sixty-four rows** of things nobody was
going to wire, with the two that mattered buried in the middle of it. TouchDesigner arrives at the
same shape with the Select CHOP: single out the channels you want before anything downstream sees
them. Choosing a signal and shaping it are now the same object seen from two pages, because the
lane a metric becomes is also what clips are placed on.

**Deselecting destroys the lane, its clips and its wires.** That is the honest reading of "I do
not want this source"; keeping an orphan lane so the wires survived would mean Routing still
listing something the stems page says is gone.

**D-89 · A stem row shows its automation; the waveform is a view of it.**
Curves by default, one row per selected signal, and a single control switches the strip to the
waveform. Not a second disclosure button — the same strip, two views. *Why:* a stem here **is** a
set of automation sources. The waveform is genuinely useful, since it is how you find the drop,
but it is not what anything downstream reads, and defaulting to it put the least actionable
picture in the most prominent place. Trim handles stay on the waveform view, because trimming is
an audio edit and its handles belong on the audio.

**D-90 · Rhythm is one group, not one per stem.**
Beat and bar phase move out of the per-stem groups into a single Rhythm group. *Why:* they derive
from the project's beat grid and `evaluateRhythm` never looked at `sourceId` — so listing them
under every stem implied four different answers to a question that has one, and multiplied the
column for nothing.

**D-91 · Old wires are migrated, not kept alive by a second code path.**
v1 connections **and triggers** whose source was `{kind: 'audio', sourceId: trackId, key: metric}`
are rewritten to point at a lane, and the lanes they need are created during load. *Why:* nothing
can create an audio field any more, and keeping a parallel way to reference a stem signal
forever is the kind of thing that quietly becomes two behaviours. Migrating instead means an old
project *gains* clips on the signals it was already using rather than merely continuing to work.

Two things this nearly got wrong, both now covered by tests:

- **Triggers hold a source too.** Migrating only `connections` would have left every onset trigger
  in every existing project pointing at a kind nothing offers.
- **The onset default stopped firing.** Dropping an onset source creates a fire-once trigger rather
  than a continuous wire, and that check read `field.key` — which silently stopped matching once
  the metric moved behind a lane. `isOnsetSource` now looks through the lane.

*`AUDIO_FIELDS` and `evaluateAudio` stay.* They define what the `audio` kind **is**, `fieldLabel`
reads them, and a resolver for a kind in the type union is not dead code just because no UI offers
it — it is what stops a hand-edited or unmigrated file evaluating to silence.

**D-92 · Camera keyframing IS the clip system. There is no second keyframe engine.**
*Animate* on a camera parameter creates a lane, wires it to that parameter, and hands you the clip
editor the stems use. *Why:* a camera move is a curve over time, and the product already has curves
over time. Reusing them means keyframes (points in a pattern), smooth motion (interpolation,
including `step` for a snap), reuse (one pattern placed three times, edited once) and **modulation
by the music** — the parameter is an ordinary routing target (D-64), so a stem can drive it *as
well*, and the two sum through the normal weighted N:1. A dedicated keyframe editor would have had
to agree with all of that and would eventually not have.
*Consequence:* `cameraAnimationRange()` exists because a descriptor's `min`/`max` is a **slider
bound**, not an animation range — position runs ±500 m so you can leave the scene and come back,
and mapping a 0–1 curve onto that would fling the camera into the void on its first keyframe. A
move lives in ±10 m and ±45°, centred on zero because the chain's output is *added* to the authored
value.

**D-93 · A camera path is geometry; its timing is automation.**
Waypoints say *where*; the Follow Path behaviour's `progress` parameter says *where along it*, and
progress is an ordinary parameter, so it can be typed, drawn as a clip, or driven by a stem. *Why:*
baking times into waypoints is what makes camera paths miserable elsewhere — retiming a move means
editing every point, and the shape and the schedule cannot be edited independently. Blender's
Follow Path constraint splits them the same way, for the same reason. Waypoints are **captured from
the preview camera** rather than typed: flying somewhere and pressing a button is how anyone
actually decides where a camera should be.

Three specifics worth keeping:

- **`centripetal` Catmull-Rom.** Uniform parameterisation overshoots and loops when control points
  are unevenly spaced, which on a camera path reads as the camera lurching sideways between two
  waypoints that looked fine.
- **`getPointAt`, not `getPoint`.** Arc length, so progress moves the camera at a constant speed.
  Otherwise it speeds up wherever waypoints are far apart — the opposite of what changing their
  spacing should mean.
- **Progress wraps rather than clamps**, so a repeating clip loops the move, and negative progress
  from a bipolar range still resolves.

**D-94 · The rig gained a *placement*, because a path places rather than nudges.**
`CameraRig` carries `hasPlacement` + `placeX/Y/Z` and `hasAim` + `aimX/Y/Z` alongside its additive
offsets. A placing behaviour replaces the authored position; offsets and orbit then apply on top, so
a handheld shake still shakes a camera travelling along a path. Aiming along the path wins over the
Look-At target — a camera told to look where it is going has been given the more specific
instruction. Flat numbers and flags rather than nullable vectors, so `resetRig` stays
allocation-free: it runs every frame.

**D-95 · Shared processors are what a node graph is *for*, so they came first.**
`ModulationProcessor` — Quantise, Sample & Hold, Delay — are objects with ids that **several wires
reference**. One "quantise to 8 steps" driving six parameters is one thing to edit, not six copies
that drift.

*Why this and not a canvas.* D-34 rejected a node canvas because 8 stems × 13 metrics was 104
potential nodes and spaghetti is a known failure mode. **Pass C deleted that objection** — sources
are now the handful of lanes you selected (D-88) — so it was genuinely reconsiderable. But with
computed layout a patchbay *is* a two-column node graph, and the only thing a canvas adds is a
middle column. So the middle column is what got built; drawing it as free-floating nodes would add
positions to save and a way to make a tangle, and buy nothing the rack does not already show.

**Nothing here duplicates the chain.** Gain, curve and rise/fall are the *wire's* private trim; a
second way to smooth a signal would be a second thing to get wrong. Stepping, holding and delaying
are all new capability, and a test asserts the two vocabularies stay disjoint.

**D-96 · Delay and Sample & Hold change WHEN the source is read, not what comes back.**
Both are expressed as a time offset — `processorTimeOffset` composes them and the caller samples the
source at the resulting moment. Neither has an `apply`. *Why:* every source in this system is
already a pure function of `t`, so asking for `t - d` is exact and free; a buffer of past values
would be state, and state in the render path cannot survive an out-of-order offline render (HC-3).
It also means delay works while scrubbing backwards, which a buffer never could. The offset floors
at zero, because every source is silent before the start and a delayed wire should hold its first
value rather than dropping out for its delay length.

**D-97 · The preview reads the source exactly the way the matrix does.**
`previewConnection` resolves and applies the wire's processors. *Why:* without it the modulation
graph draws a smooth line for a quantised wire, and **a preview that disagrees with the render is
worse than no preview, because it is believed.** Same reasoning as D-85 for curves: one code path
for "what does this signal do", used by everything that claims to show it.

**D-98 · A State owns its scene. HC-7 is rewritten, not extended.**
`VisualState` holds `objects`, `connections`, `post`. Switching loads; switching away saves. *Why:*
the previous model — a state as a *selection* of ids over one project-global pool — was defensible
on paper and unusable in fact. Every state's objects lived in one pool, so **the layer stack showed
all of them at once**: a five-state project presented thirty shapes and switching states only changed
which were hidden. You cannot author against a scene you cannot see.

Ownership costs the propagation that selection bought — editing a shape in one state no longer
changes the copy in another. That is the right trade, and it is the same property that makes a state
importable, exportable and sellable, which is where the user wants this to go.

*What it deleted:* `isVisible`, `isConnectionActive`, `isPostActive`, `withOverride`,
`connectionOverrides`, the D-58 question of which authority wins, `StatePanel`. `resolveTimeline`
returns one state id where it returned three sets. **The correct model was also the smaller one** —
worth noticing, because the complexity was load-bearing for the wrong idea.

*Automation stays project-global* (HC-8 rewritten). A stem lane derives from project audio, and
patterns are referenced by clips on stem lanes — a pattern owned by a state would break the moment
you switched away. Export therefore becomes a **bundling** problem: collect the patterns and drawn
lanes a state's wires reach, leave stem lanes as inputs the importer maps. That is how asset packages
work everywhere.

**D-99 · Document-level controls live in the top bar; the left dock has one job.**
The state selector moved from a side dock into the top bar, next to the project name. *Why:* which
state you are editing is a property of the *document*, like Blender's Scene picker — putting it in
the left dock gave one 280px column two unrelated jobs, and put it on one page when it applies to
all seven. The left dock is for bringing visual elements in. Nothing else.

*Also removed:* the **Load** and **Save** buttons on each state. Picking a state loads it; leaving it
saves it. Two buttons asking the user to manage that by hand were the tell that the model underneath
was wrong — and they survived the model, which is how you find out.

**D-100 · A control with no handler is a lie, not a placeholder.**
REC deleted. It sat in the top bar from Phase 1 wired to nothing, styled like a live feature. Third
instance of the same class after `add-marker` and `forgetHandle`, so it is now a rule:
**ship the control with the behaviour or do not ship the control.**

**D-101 · Gizmo visibility is per-page, and it is the page's declaration.**
Two layers — `GIZMO_LAYER` for authoring furniture, `CAMERA_GIZMO_LAYER` for the path, frustum and
trail — and `ViewportSlotOptions` says which a page shows. *Why:* the camera path was on the general
gizmo layer, so it was drawn on **every** page including the export monitor. Deliver now shows
neither: it is a proof of the file, so anything that will not be in the file has no business in it.
The exporter disables both regardless, which is belt and braces on purpose.

**D-102 · The Scene Camera draws itself, and where it is going.**
A frustum at its resolved transform, plus a dashed motion trail along its path — both in preview,
both on the camera layer. *Why:* Blender always draws the camera object and offers a motion path, for
the reason that while you fly the preview around, the camera that actually renders is invisible. You
were composing a shot whose edges you could not see. The trail samples the *path*, deliberately not
the per-frame sum: behaviour noise and audio wobble are not a trajectory, and drawing them would be
a scribble.

**D-103 · Instructional prose is a design failure with a workaround attached.**
Every explanatory paragraph removed from the UI. *Why:* a sentence telling you how a control works is
the control failing to say it — and several of ours appeared in two places, which is one sentence
maintained twice. `title` attributes stay: hover help is on demand and costs no space. Empty states
that say what a panel is *for* stay: with nothing in a list there is nothing else to read. Narrating
a gesture goes.

That I had written so many of them was the useful signal. It is recorded in
[05-DESIGN-SYSTEM.md](05-DESIGN-SYSTEM.md) §"Where this system is still not honest" alongside the
rest of the interaction debt.

**D-104 · Range before polish, and range before more of the same.**
The next phase is widening the medium — colour authoring, a points backend, non-lattice structure,
lines, SDF, text — and **not** interaction craft, and **not** more post effects.

*Why not polish:* it is genuinely the reason this reads as a prototype next to Notch and
TouchDesigner. Every control here is a slider, a number field or a list row, so you manipulate
descriptions of things rather than things. But fixing it yields a *narrow tool that is pleasant to
operate*, and narrowness is what decides whether the tool is worth operating at all.

*Why not more effects:* they add permutations inside the single image family that already exists.
They feel like progress and move nothing.

The bar is the **ten-project test** — ten projects from one stem, fifteen minutes each; a stranger
must tell all ten apart from one frame, none embarrassing, at least four distinct image families.
Falsifiable, cheap to run, and the thing that will say when to stop widening.
Full reasoning: **[17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md)**.

**D-105 · Colour is a scene-level palette, and objects bind to a slot.**
A state owns a `Palette` — an ordered colour list plus two background stops. An object holds
`paletteSlot: number | null` rather than a baked hex, so re-picking the palette recolours the whole
scene at once. Slots wrap, so a four-colour palette driving nine objects cycles rather than running
out, and shortening a palette cannot leave objects pointing at nothing. `null` is the escape hatch
for the one object that has to differ.

*Why:* every new object used to take the next entry from a rotating stem palette, over a near-black
background, under one fixed rig. So a user who made **no colour decision** — most users, because
nothing invited one — got the same colours as everyone else. "An accent colour on dark" was not a
style, it was the absence of a control, and it is a large part of why ten users produced eight
similar outputs.

Six starter palettes rather than one, including a greyscale one so the control does not read as
"pick a hue". These are not the pre-baked presets the docs reject — those decided *musical
structure*. A palette decides nothing about structure; it is a starting point for a decision that
was not being made at all, and one default cannot fix everyone landing on the same colours.

**The background is written once, not bound live.** The environment section stays the only render
path for it, so picking a palette *writes* `background.topColor` / `bottomColor` and then leaves
them alone. That way you can tweak the background afterwards without the palette fighting you — a
palette is a starting point, not a lock — and there is no second source of truth for the largest
area of every frame.

*Verified:* four palettes over identical geometry produce four visibly different pieces, sky
included, measured on a geometry-free strip of the frame rather than by eye.

**D-106 · A test that asserts the bug is worse than no test.**
The first version of the palette suite asserted every background had mean luminance **below 60** —
"dark enough to sit behind lit geometry". Both stops were therefore near-black, which reproduced
*exactly* the problem the palette exists to fix, and the test locked it in. Driving the app showed
the sky visibly changing and still reading as a void.

Replaced with the property that actually matters: the horizon stays dark enough for geometry to sit
against (`< 40`) **and the upper stop lifts the frame off the void** (`> horizon + 25`). Worth
recording as a class of mistake, not just a fix — a test written from the implementation's
assumptions will happily certify them.

**D-107 · Setting a colour by hand releases the palette slot.**
`writeParam`'s material branch clears `paletteSlot` when `material.color` is written. *Why:* the
render path resolves a bound slot **over** the stored colour, and every new object gets a slot — so
the per-object colour picker wrote a value that was immediately overridden and appeared to do nothing
at all. Reported as "the colour param seems to not be working now of any shape", which it was not.

Two things worth recording beyond the fix:

- **I patched the wrong function first.** `setMaterial` is a bulk write; the inspector goes through
  `writeParam`. The first attempt typechecked, read correctly, and changed nothing observable. *Fix
  the path the UI actually uses* — and verify by driving it, which is how the second attempt was
  caught.
- **Releasing needs a way back.** Clicking a swatch in the palette panel now binds the selected
  object to that slot. Without it an object could leave the palette and never rejoin, which is a
  one-way door built by a bug fix.

**D-108 · Clones carry an absolute colour channel, separate from the brightness multiplier.**
`CloneBuffers` gained `color` (absolute RGB, seeded from the object's resolved material colour)
alongside `tint` (a brightness multiplier effectors add to). Final instance colour is
`color × tint`, and the material is set to **white** on an instanced mesh because Three multiplies
material colour by `instanceColor` — without that, every clone would be tinted twice.

*Why a second channel rather than reinterpreting `tint`:* every existing effector *adds* a weighted
delta to it and it is labelled "Brightness", so it can only lighten or darken what is already there.
A palette ramp has to be able to say "this one is teal and that one is chartreuse", which is a value,
not a scaling. Folding them together would have broken four working effectors to add one.

**D-109 · The Palette Ramp effector is why the colour channel exists.**
Spreads the scene palette across a clone array — ends landing exactly on palette entries, with
spread, offset, bias, reverse and ping-pong. *Why it matters:* a cloner produces N objects of the
same shape *and* the same colour arranged regularly, which reads as an array of copies rather than
as a form. That is the loudest "made in a toy" signal in the current output. Ping-pong exists so a
closed array — a ring — meets itself at the seam instead of jumping from the last palette entry back
to the first.

The sRGB→linear conversion is deliberate and easy to get wrong in both directions: a material colour
goes through it when Three parses the hex, but `instanceColor` does **not** get converted, and the
shader multiplies it against a linear value. Skipping it washes every ramp out.

*Verified in the browser:* eight clones in a ring, each a different palette colour. Worth a second
look under a darker rig — under the default key of 2.2 a pastel palette reads paler than the swatches
suggest, and it is not yet established whether that is the lighting or the conversion.

**D-110 · Any mesh can be drawn as a cloud of its own vertices, from one switch.**
`SceneObject.backend` was already a field, copied from the brick and never changed. It is now
user-controllable: a Surface/Points segmented control in the inspector, backed by
`useSceneStore.setBackend` and the shared `withBackend()` helper.

*Why this and not more point bricks:* [17-EXPRESSIVE-RANGE §Pass 2](17-EXPRESSIVE-RANGE.md) promises
"any geometry becomes a cloud", and five scatter bricks do not deliver that — they add five shapes to
a library of ten. The switch multiplies it: every mesh brick, at every parameter setting, with every
deformer already stacked on it, has a second image for one click. A vertex *is* a point, so it costs
nothing but the switch.

**One-way on purpose.** A point buffer has no faces, so drawing it as a mesh joins unrelated scattered
vertices into shards. `canRenderAsPoints()` is the single authority and a point brick simply has no
switch.

*The two things that had to change with it:*
- **The material moves with the backend.** A `PointsMaterial` on a mesh draws nothing and a mesh
  material on `THREE.Points` draws unshaded squares — both read as "the object vanished". `withBackend`
  changes them together and never separately. This also fixed a latent bug in `setBrick`: swapping a
  point brick to a sphere kept the point material and the sphere rendered as nothing.
- **Cloners are refused on a cloud.** Cloning draws an `InstancedMesh`, a cloud draws
  `THREE.Points`, so a cloner stacked on one sat in the list looking active and changed nothing.

*Two defaults that a fixed value could not serve:*
- **Occluding dots, not additive.** The scatter bricks are sparse by construction and want
  accumulation. A mesh packs thousands of vertices along a thin surface, and additive light there
  saturates to a white smear with colour surviving only at the edges. Verified on a torus knot.
- **Dot size comes from vertex spacing**, not a constant: `√(4πr²/count)·0.8`. An icosahedron's few
  hundred spread vertices read cleanly at 0.6; a torus knot's thousands merge into a blocky mass at
  the same value.

**D-111 · A deformer resting at zero says so, rather than looking dead.**
Every `DeformerBrick` now declares `driver` — the parameter whose zero makes `apply` a no-op — and the
effect stack shows an **at rest** badge when that parameter is zero and no wire is driving it.

*Why not simply give deformers a visible default:* modulation is `base + Σ offsets`, so the stored
value is the **rest position**. A bass-driven bulge whose Amount defaults to 4 is permanently inflated
and can only get worse on the kick. Zero is correct.

*Why the badge is not optional:* the cost of a correct zero is that adding a deformer changes nothing,
which is indistinguishable from a broken feature. That is not hypothetical — a browser check here
added a Twist at its default `angle: 0`, saw no pixels move, and concluded the deformer stack did not
reach point clouds at all. It does. A test now asserts each declared driver is inert at zero and
*moves geometry when non-zero*, so the badge cannot lie in either direction.

**D-112 · The preview renders at device resolution (`dpr={[1, 2]}`).**
React Three Fiber renders one device pixel per CSS pixel unless told otherwise. On any HiDPI screen
that made the viewport the single soft, aliased panel in an otherwise crisp interface, and thin
geometry paid for it most. Capped at 2: the fourth pixel of a 4× display buys nothing visible and
costs sixteen times the fragments.

**Open, and not resolvable in the test harness:** below roughly eight device pixels, point sprites
render as hard squares under headless SwiftShader while the same material at size 3 renders as clean
circles. Nothing in the material varies with size, and the sprite's corner alpha is zero by
construction, so the remaining explanations are all in the software rasteriser's point path. To be
confirmed on real hardware before any further change — three fixes were attempted for this and two of
them (mipmapping the sprite, then `alphaTest`) made it worse.

**D-113 · Two layouts that are not lattices, and a flow field that composes with all five.**
Pass 3 of [17-EXPRESSIVE-RANGE](17-EXPRESSIVE-RANGE.md). Line, ring and box are all lattices, and an
array on a lattice reads as *an array of copies* rather than as a form — the loudest "made in a toy"
signal in the output. Three additions close it:

- **Scatter Cloner** — a count and a volume, positions from a hash of the clone index. Spherical
  morphs the box into a ball with a cube-root radius so density stays even instead of piling up at the
  centre.
- **Surface Cloner** — copies on the object's **own deformed vertices**, aligned to the normal.
  `ClonerContext` gained `sourcePositions`/`sourceNormals` for it, taken from the instanced mesh's live
  geometry, so a stem-driven deformer carries the whole array with it.
- **Flow Effector** — the curl of a noise-derived potential, sampled at each clone's position.

*Why a Random effector was not already enough:* jitter displaces copies **from** lattice points, so the
lattice still sets the density — at low amounts a wobbly grid, at high amounts noise — and the count
stays locked to `nx·ny·nz`. Neither new layout has a lattice at all. Measured rather than asserted: a
grid of 512 has **8** distinct x coordinates, a scatter of 256 has **over 200**.

*Why curl and not a plain noise offset:* a plain offset pushes every copy towards wherever the field
happens to point, so the array bunches into blobs and leaves holes. `curl(F)` is divergence-free by
construction and therefore cannot compress, so copies slide past each other in streams and the density
the layout established survives. A test asserts exactly that — spread after the field stays within
0.75–1.6× of spread before it — because that property *is* the reason for the extra six noise samples.

*Two things the invariants caught, and both were right:*
- The catalogue requires an effector to be **inert at its defaults**, which is D-111's rule arriving
  from the other direction. Flow's Strength therefore defaults to 0 and it declares `driver`, so the
  stack shows **at rest** instead of looking dead. `EffectorBrick.driver` is optional because most
  effectors have no single gate — their zero state is all of Move, Rotate, Scale and Brightness at
  zero, and naming one would make the badge wrong the moment another was raised.
- The catalogue also required every layout to start at **unit** scale. The surface layout cannot: an
  instanced mesh draws the same geometry at every clone, so unit-scale studs are the size of the thing
  they stud and the object arrives as a solid ball of copies of itself. The invariant was asserting the
  wrong property — what an effector needs is a baseline with no *per-clone variation*, not the number
  1 — so it now asserts uniformity across clones and the surface layout owns a `Clone Size` default of
  0.15.

*Verified in the browser.* A grid of 256 icosahedra reads as radiating rows; the same object under
Scatter + Flow reads as a field with depth and no rows. A sphere under Surface Cloner is a ball of 500
small spheres. Stacking a Spike deformer on that does **two** things, both wanted: the array follows
the deformed silhouette, and every stud spikes in its own local frame, because one geometry is shared
by every instance. Worth knowing rather than fixing — Cinema 4D separates the two because its cloner
children are separate objects, and ours are instances of one.

**D-114 · Lines are a render backend; ribbons are meshes. Two bricks, not one with a width slider.**
Pass 4 of [17-EXPRESSIVE-RANGE](17-EXPRESSIVE-RANGE.md). `RenderBackend` gains `lines`, so three of
the four declared paths are now implemented and only `sdf` is unbuilt. Five line bricks — Lissajous,
Spiral, Rosette, Flow Lines, Web — plus two stroke materials and two ribbon bricks.

*Why a stroke is a third family and not a thin mesh:* it has no area, so nothing about it is shaded
and what you see is pure trajectory. A Lissajous figure and a lit sphere are not two settings of one
image, and the ten-project test counts *kinds* of image, not permutations.

**Indexed segments, always.** Every line brick emits one `BufferGeometry` with an index of vertex
pairs, drawn as `THREE.LineSegments`. Two things fall out of that and both are load-bearing:
- **Every deformer works unmodified**, exactly as on a point cloud. A deformer displaces positions
  and never touches the index, so a strand stays connected however far its vertices move. Fifteen
  operators arrive with the backend.
- **Connectivity is the brick's business, not the draw call's.** A polyline and a web of links
  between scattered nodes are the same buffer with a different index, which is why one backend draws
  both instead of needing two.

**Ribbons are separate bricks, deliberately.** A one-pixel stroke and a lit twisting band are lit,
occluded and composited differently — one is a drawing and the other is an object. They are also
different backends, and a *parameter* that silently changed an object's backend would be exactly the
hidden coupling this codebase has removed twice. As ordinary meshes they arrive with all seven
materials, shadows, reflections and cloners for free. `sides` and `flatten` span the family from a
round cable to a flat band, because the difference genuinely is the section.

**Width is not a control.** WebGL rasterises every line at one pixel and ignores
`LineBasicMaterial.linewidth`. A Width slider that did nothing would be the fourth instance of the
control-with-no-handler failure (D-100). Weight comes from the ribbon bricks.

*Three things this pass also fixed, each found by looking rather than by a test:*
- **Parallel transport, not Frenet frames.** A Frenet normal is undefined where a path runs
  momentarily straight and flips through an inflection — visible as a band that snaps 180° mid-stroke,
  on exactly the straight runs a flow line is full of.
- **`DeformRuntime` no longer computes normals for geometry that never had any.** On an indexed line
  it would read vertex *pairs* as triangles; on a forty-thousand-point cloud it was a wasted pass
  every frame writing an attribute nothing shades from. Meshes are unaffected — they always have
  normals.
- **Flow defaults ran out of frame.** Step × Resolution is the length of a strand, and 0.6 × 220 from
  a 14-unit spawn travels 130 units in every direction. Chosen together now, and only a screenshot
  says which pair is right.

*One shared field.* `curl3` moved from the Flow effector into `effects/noise.ts`, so a flow line and
a flowed array follow the same current and compose in one scene.

*Verified in the browser and in the file:* all five strokes and both ribbons render, four backends
coexist in one scene taking their own palette slots, and a twisted Lissajous with Bloom and a camera
orbit exports at 720p — mean luma 12.5, max 197, 15 % lit, 25 % of pixels changing per frame.

**D-115 · The shape library folds, because it is now seven groups.**
Four groups fitted the panel; seven do not, and the one that fell below the fold was **Lights** — a
whole element family reachable only by finding the scrollbar of an inner container. Each group is a
disclosure with its brick count in the header, and the grouping itself now lives in
`brickGroups.ts` because the inspector's swap dropdown needs the same one. Those two had already
drifted apart once: the library filtered by backend and the dropdown by `meshKind`, so a point brick
appeared under "Morphable" in one of them and promised a morph it cannot do.

**D-116 · Hue shift belongs to the object, not to the shading model.**
The last open item in Pass 1: colour was authorable but *static*. The palette decides the scene's
colours and nothing could change them during the piece, so a drop could change a shape's size, its
brightness and its post treatment — but not its colour, which is the change an audience reads
fastest.

`hueShift` is a degrees parameter appended to **every** material brick by `MaterialRegistry.register`
and implemented by **none** of them. The rotation happens in the render path, on the colours the
model and the palette already resolved. That placement is the decision:

- One control moves the Gradient's *two* stops together. A per-brick implementation would have
  needed each model to decide what "shift my colours" meant, and the Gradient's answer would have
  been wrong in a different way from the Fresnel's.
- It survives a change of shading model, because `migrateParams` carries shared keys across.
- It is an ordinary `material.` address, so it is wireable, curve-shapeable and clip-automatable
  with no new machinery — which is the entire argument for the parameter registry.

*Rotate, not replace.* Shifting an Ember scene by 40° is still an Ember scene; writing an absolute
hue would discard the decision the palette records. It wraps rather than clamping, so a signal that
overshoots lands somewhere sensible instead of parking on magenta.

*A grey is unchanged at any angle.* Correct, and worth knowing rather than fixing: a Mono palette
cannot be driven this way and no amount of signal will make it move.

*Verified in the browser:* a Standard sphere at 120° goes indigo to salmon, and
`…//material.hueShift` appears as a patchbay target on a fresh project.
