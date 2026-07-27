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

**D-29 · Section awareness is restored and is the answer to "musical narrative."**
The section-aware intensity engine shipped in v1 (`js/markers.js`) and was dropped from
the v2 design by accident. Combined with memory-carrying Fields (`drop-decay`,
`is-buildup`) and object-to-object routing, it is the concrete mechanism behind the brief's
"story, tension, call and response" — which had sat as an open philosophical question
through every prior document. *Why it matters:* frame-local metrics like RMS structurally
cannot express "tension building over eight bars."
