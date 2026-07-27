# AURA Studio — Feature Checklist & Open Questions

> Every feature from the original note dump, cross-referenced against what's
> been resolved through research and discussion, plus what's still an open
> decision. Use this as the master requirements checklist.

Legend: ✅ resolved/designed · 🟡 identified, not yet designed · ❓ open question,
needs a decision before building

---

## Audio / Tracks

- ✅ Multi-track import (unlimited stems: drums, hats, guns, fakeout, atmosphere,
  sub, extra layers) — each stem is an independent Track object
- ✅ Tracks are separate mp3 files, DAW-style rack (not a single mixed file) —
  deliberately sidesteps the source-separation problem for v1
- ✅ Trim, cut, move, solo/mute per track (FL Studio style)
- ✅ Solo isolates **both** playback and the visual modulation driven by that
  track — explicit requirement, must be wired through the modulation matrix,
  not just the audio graph
- ✅ Tracks need to be the same length / arrangeable (person exports groups,
  arranges like FL Studio)
- 🟡 Onset/transient detection per stem (not just raw loudness/RMS) — needed
  for "explode within hit time of kick/snare" to actually land on-beat.
  Essentia.js covers this (see tech stack doc).
- 🟡 Frequency-band energy (sub/low/mid/high) extraction per track
- 🟡 Beat/tempo grid detection, for timeline snap-to-beat (see rhythm game
  editor research)

## Modulation Matrix (track → parameter routing)

- ✅ Weighted N:1 routing (50% guns + 25% drums + 25% atmosphere → one
  parameter) — the architectural core of the whole product
- ✅ Signal chain per connection: Gain → Rise/Fall (attack/release smoothing) →
  Min/Max (range) → Weight (Ableton Envelope Follower pattern)
- ✅ Two modulation types needed: **continuous** (weighted blend, for smooth
  changes) and **discrete events** (trigger/response, for percussive hits) —
  originally only continuous was specified; discrete events identified as a
  gap via Niagara research
- 🟡 Cross-track modulation (sidechain-style — one track's *signal* driving
  through another track's envelope settings) — mentioned as possible via
  Ableton research, not yet scoped as a required v1 feature
- ❓ Expression/formula-based parameter driving (Blender Drivers-style) beyond
  simple weighted sums — worth deciding if v1 needs arbitrary expressions or
  just the weighted-sum model

## Shapes & Deformers

- ✅ Multiple shape types, any number addable
- ✅ Any-to-any morphing between shapes — **constrained**: requires shared base
  topology (see tech stack doc 3.2); custom imported meshes (GLTF/OBJ) likely
  need to be "swap-only," not morph-compatible, unless a harder
  volumetric/4D morphing technique is built later
- ❓ **Primary vs. secondary shape relationship — still undefined.** Does
  secondary orbit primary? Sit behind it as background layer? Get driven by a
  different track than primary? This changes the data model and needs a
  decision before `ShapeFactory.ts` is built.
- ✅ Transform + rotation params on everything (explicit original requirement)
- 🟡 Deformers: Explode/reform (kick/snare), Gun Protrusion/stretch
  (transients), Perlin noise wave (sub-bass), Twist/pulse — named in notes,
  need individual implementation specs
- ✅ Replicate shape + symmetrical offset — **resolved as a feature, richer
  than originally scoped**: should be a Cloner-style array (linear/radial/grid)
  + Effector layer (Random/Step/Delay), itself drivable by the modulation
  matrix (see Cinema 4D research). Not a flat symmetry toggle.
- ❓ Fields-style generalized influence masks (Cinema 4D pattern) — worth
  deciding if this generalizes usefully to AURA's modulation system beyond
  just the Cloner/Effector feature, or stays scoped to that one feature

## Camera

- ✅ Dual camera system: Scene Camera (drives recording/final render, default
  at `(0,0,50)` facing origin) vs. Preview Camera (free-fly, WASD + Shift/Ctrl
  for 6-direction movement, click-drag look-around)
- ✅ Camera path visible and editable during NLE timeline (spline waypoints in
  3D space)
- ✅ Manual keyframe animation — explicitly **not** AI-driven, not generative,
  not predictive; this is a stated product principle, not just a v1 limitation
- ✅ Camera lives on its **own independent track**, parallel to state/visual
  tracks, not nested inside each State — resolved via Blender NLA +
  Unreal Sequencer Camera Cut Track convergence (see tool research + tech
  stack docs)
- 🟡 Easing/interpolation curves per keyframe (Graph Editor / F-curve
  equivalent) — identified as a real gap, recommended for v1 not a later pass
- 🟡 Constraint layer: Follow Path (auto-travel along spline), Look-At/Damped
  Track (auto-face a target), Child-Of with animatable influence (smooth
  target handoff) — currently camera is "keyframe everything by hand," this
  would add declarative behaviors on top
- 🟡 Motion trail visualization on the spline gizmo (dotted path + spacing
  shows speed at a glance)
- 🟡 Snap-to-beat-grid when placing camera keyframes
- 🟡 Procedural noise/shake module for organic camera imperfection (Cinemachine
  pattern) — without hand-keyframing shake
- 🟡 Virtual-camera-per-state + Brain-style auto-blending on state cuts, as an
  alternative/complement to one continuously-keyframed camera (Cinemachine
  pattern) — worth deciding if this replaces or supplements the single-track
  camera model
- ❓ Extrapolation mode for camera-track gaps: hold last value / hold-forward
  (continue moving) / nothing — needs an explicit per-section choice (Blender
  NLA pattern)

## NLE Timeline & States

- ✅ States package a complete visual configuration (shapes + params + node
  wiring) as a discrete unit
- ✅ States act like video clips — arrangeable, cuttable, like an NLE
- ✅ States should **reference**, not copy, their source definition (Blender
  Action/Strip pattern) — editing a State updates every placement of it on the
  timeline. This must be the data model from the start.
- 🟡 Transitions between states: cuts, crossfades, morphs — named as a goal,
  not yet spec'd in detail
- 🟡 Blending/influence between overlapping tracks (Blender NLA pattern) —
  relevant if more than one track (e.g. camera + visual state) can affect the
  same property simultaneously
- ❓ Subsequences/nesting — should a complex State be able to contain its own
  mini-timeline (Unreal Sequencer pattern)? Not required for v1 but worth
  flagging for when projects get complex.
- 🟡 Snap-to-beat-grid for placing state cuts (rhythm game editor pattern)

## Node Graph

- ✅ Node view for linking tracks to parameters — explicit requirement:
  "simpler than TouchDesigner," "intuitive," "anything can be linked to
  anything"
- ✅ **Resolved via TouchDesigner + Niagara research:**
  - Typed/color-coded node categories (Signal/Geometry/Camera/Material),
    same-type wiring by default, Signal type as the exception that can bind
    onto any parameter (TouchDesigner's CHOP-export pattern)
  - Default UI is a **simplified stacked list view** ("Drums → Radius: 50%"),
    full node graph is an opt-in "advanced" toggle (Niagara's stack-vs-graph
    duality) — this is the concrete mechanism for "simpler than TouchDesigner"
- 🟡 **User Parameters concept** (Niagara pattern) — explicit exposed-parameter
  list per shape/system, rather than every internal value being globally
  linkable by default

## Particles, Lighting, Background Elements — the most underspecified area

- 🟡 Particle systems — named as a requirement, no detailed spec yet. Consider
  a dedicated `ParticleSystem.ts` rather than folding into generic deformers.
- 🟡 Lighting effects — named alongside particles in original notes, **not yet
  designed at all**. Needs its own module/store (dynamic lights, shadows, rim
  light, strobe-on-hit).
- 🟡 Background elements (arrows, lines, circles, squares) — a 2D overlay
  layer distinct from the 3D scene. Not yet addressed as a compositing system.
- 🟡 Lasers — named once in the "Things" parameter list, never elaborated.
- 🟡 Images + effects to manipulate them (displacement, glitch) — named once,
  not elaborated.
- ❓ Background color as its own explicitly-routable parameter, separate from
  general shape/scene color — worth confirming (e.g. should "atmosphere" track
  be routable directly to background hue as a first-class target?)

## "Code so new components work together" (extensibility requirement)

- ✅ Engine/UI separation (non-React `engine/` layer, React only for
  presentation) is the right foundational call
- ✅ Typed node graph (see Node Graph section) is the concrete mechanism for
  "anything can work with anything"
- ❓ Formal module/plugin interface for adding new deformers, effectors, or
  shape types without touching core engine code — named as a goal in original
  notes ("code in such a way that as new components are added, they can work
  together") but no concrete interface designed yet

## Story/Tension/Call-and-Response (musical narrative requirement)

- ❓ **Still only philosophy, not a concrete feature.** Original notes: "the
  software is like, musicians show story, tensions, calls and responses, ups
  and downs thru music... they should also be able to simulate them in the
  visuals." Open question: is this satisfied entirely by the state-timeline +
  modulation matrix (i.e. it emerges from good authoring), or does it need a
  dedicated feature — e.g. two shapes "answering" each other when two tracks
  alternate? Not yet resolved.

## Rendering & Export

- ✅ Frame-accurate offline rendering (not screen recording) via WebCodecs
  `VideoEncoder` + `mp4-muxer`
- ✅ Highest FPS / quality output as the explicit goal of the Deliver stage
- 🟡 Horizontal + vertical simultaneous export — identified as important for
  the type-beat producer target audience specifically, not in original notes
- 🟡 Batch rendering (queue multiple tracks, render overnight) — same audience
  rationale, not in original notes
- ❓ Resolution/quality presets, target bitrate defaults — not yet specified

## Project System

- ✅ Project-based save/load, proper file format, mp3s referenced for
  playback (not re-embedded)
- 🟡 Undo/redo — not mentioned anywhere in original notes or KB; standard NLE
  expectation, easy to bolt on early with Zustand temporal middleware, painful
  to retrofit later
- 🟡 Reusable "rig" presets — a saved unit smaller than a full project
  (camera path + shape + routing table + color scheme), reusable across many
  tracks. Identified as a likely **business model feature** for the type-beat
  audience ("one visual system, many beats"), not just a nice-to-have.
- ❓ Collaboration/hand-off — exporting a "rig" separately from audio so an
  artist and a visual designer could work asynchronously. Named as a
  possibility during market research, not scoped.

## UI/UX

- ✅ DaVinci Resolve-style bottom panel switcher, 5 workspace pages (Audio
  Tracks, Scene & Shapes, Node View, Camera, Deliver)
- ✅ Non-overlapping CSS Grid docking workspace (no panel collisions/z-index wars)
- ✅ Remappable keyboard shortcuts settings window
- ❓ Whether Camera deserves its own spatial-authoring panel *and* appears as
  a track in the Deliver/NLE panel (two views of one data store) — resolved in
  principle (see Camera section) but not yet reflected in the UI component
  tree / panel structure

---

## Summary of the highest-priority open decisions

These block downstream implementation work and should be resolved first:

1. **Primary/secondary shape relationship** — changes `ShapeFactory.ts`'s data model
2. **Camera constraint layer scope for v1** — Follow Path / Look-At / handoff
   blending, or defer to a later phase
3. **Lighting module** — currently has zero design, needs at least a v1 scope
4. **Background 2D overlay system** — currently has zero design
5. **Extrapolation mode default** for state/camera track gaps
6. **Whether "story/tension/call-and-response" needs a dedicated feature** or
   is left as an emergent property of good timeline + modulation authoring
