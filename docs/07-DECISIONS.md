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
