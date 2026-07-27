# AURA Studio — Tool Research Deep Dive

> What we studied in other software, and the specific takeaway for AURA from
> each. Organized by tool. Use this as a reference when designing any subsystem
> before building it — check if a mature tool already solved the problem.

---

## TouchDesigner

### Architecture
- Fully native. Rendering has run on **Vulkan** since 2022 (OpenGL fully
  removed for lower driver overhead); on macOS, **MoltenVK** translates Vulkan
  calls to Metal.
- Custom operators are built in **C++**, with multi-threading to fully separate
  processes. Third-party C++ custom operators are GPU-accelerated with no
  external processes and no network calls — about as close to the metal as
  creative software gets.
- Built native specifically because its target users need protocol/hardware
  access a browser sandbox can't reach: DMX/Art-Net lighting, NDI/Spout video
  routing between apps, multi-projector spanning, depth cameras.

### Node/Operator model — directly relevant to AURA's node graph
Operators are organized into **color-coded families**; only operators of the
same family (color) can be wired directly together:
- **TOPs** (Texture Operators) — 2D image operations, run on GPU
- **CHOPs** (Channel Operators) — motion, audio, animation, **control signals**
- **SOPs** (Surface Operators) — procedural 3D geometry (points, polygons)
- **POPs** (Point Operators) — 3D points/particles, GPU-based data ops
- **DATs** (Data Operators) — text, scripts, tables, Python
- **MATs** (Material Operators) — materials/shaders
- **COMPs** (Components) — containers; Object Components (3D objects), Panel
  Components (2D UI), can contain other operators (this is how TD builds
  hierarchy/nesting)

**Critical pattern — "Exporting":** CHOPs (control signals) are the one family
allowed to break the same-family-only wiring rule: CHOP channels can be
**exported directly onto parameters of any other operator family.** This is
precisely AURA's "route an audio track to any shape parameter" requirement,
already solved: audio/control data is a distinct typed signal family that's
allowed to bind onto anything, while everything else stays type-constrained.

**Takeaway for AURA:** don't make the node graph a free-for-all where any node
connects to any node. Adopt TouchDesigner's model — typed/color-coded
categories (e.g. "Signal" = audio/control data, "Geometry," "Camera,"
"Material") with same-type wiring by default, but let the **Signal** type be
the one exception that can bind onto a parameter of any other type. This gives
"anything can be linked to anything" (your stated goal) real structure instead
of chaos, and gives users visual color-coding to understand the graph at a
glance.

### Known weakness (why "simpler than TouchDesigner" is a real opportunity)
Consistent complaint across sources: TouchDesigner is one of the hardest
creative tools to learn — fully node-based, feels like backend coding, no
cohesive learning path.

---

## Resolume Arena
Wins the live-VJ market almost entirely on ease of use vs. TouchDesigner's raw
power: drag-and-drop, no patching required. **Takeaway:** onboarding philosophy
to copy — approachable surface, even if real depth exists underneath.

## Notch
Parametric deformers exposed as simple sliders on top of a node graph
underneath — best of both approachability and depth. Has real camera
keyframing (Follow Spline nodes, curve editor) but it's buried inside a general
node graph rather than being a first-class, dedicated cinematography timeline —
a gap AURA should not repeat.

## NeuralFrames (AI music video generator)
Closest existing product to AURA's core loop: separates a song into
drums/bass/vocals/melody, lets you map each stem to visual movement/effects.
**Takeaway:** validates the stem→parameter mapping concept and its UI
simplicity (drag a stem onto a visual property) — but it's AI-generate-and-see,
not hands-on scene-building. AURA differentiates by making this manual and
persistent (an actual editable scene/timeline), not a regenerate-and-pray loop.

---

## Blender

### Graph Editor / F-Curves / Dope Sheet — the missing middle layer
Blender has three connected views of the same animation data:
- **Timeline** — coarse scrubbing/playback
- **Dope Sheet** — overview of all keyframes across all objects, spreadsheet-style
- **Graph Editor** — shapes the actual motion curve via F-curves; each animated
  channel is a curve with handles (tangents) controlling slope entering/leaving
  each keyframe. Steep slope = fast change, flat = easing/stop. Without this,
  motion is either robotic (linear) or floaty/overshooting (uncontrolled
  auto-smoothing).

**Takeaway for AURA:** a Graph-Editor equivalent (interpolation curve type +
handle offsets per keyframe) is what separates a "flying cinematographer" feel
from a slideshow. Cheap to build, expensive to feel right without. Should be
in v1, not a later polish pass.

### NLA Editor (Non-Linear Animation) — directly answers AURA's states/camera architecture
- An **Action** is the raw, reusable, named animation data container — the
  source of truth.
- Pushed into the NLA editor, an Action becomes a **Strip** — a *reference* to
  the Action, not a copy. Editing the source Action updates every Strip that
  uses it.
- Strips sit on **Tracks**, which work like image-editor layers: higher tracks
  take precedence, or you can choose to **blend** them.
- **Action Blending** governs behavior when two tracks simultaneously affect
  the same property.
- **Action Extrapolation** governs what happens in the gaps past a strip's
  extents: hold last value, hold forward (continue), or nothing.

**Direct mapping to AURA:**
- AURA's **States** = Blender's **Actions** (named, reusable, edit-once-updates-everywhere)
- What sits on the AURA NLE timeline = **Strips referencing States**, not copies
- This resolves the "does editing a reused state update all instances of it?"
  question the team hadn't answered — Blender's answer (yes, strips reference
  actions) is the correct pattern to copy.
- **Camera-across-cuts problem, resolved:** camera should be its own Track,
  with **extrapolation** (hold / continue / none) as an explicit per-strip
  choice — not an accident of architecture.

### Constraints — a whole missing feature category
Declarative behaviors, distinct from manual keyframing:
- **Follow Path** — parents an object (e.g. camera) to a curve so it
  automatically travels along it. Should replace hand-keyframing position at
  every waypoint on AURA's camera spline.
- **Damped Track** ("Look At") — points an object toward a target using pure
  swing rotation, minimizing unwanted roll. Toggle "look at: [shape]" instead
  of hand-keyframing rotation to track a moving object.
- **Child Of with animated influence** — smoothly hands off tracking between
  two targets by animating the blend/influence between two constraints. Solves
  "camera looks at Shape A, then hands off to Shape B" without a jarring snap.

**Takeaway for AURA:** camera should not be pure manual keyframes. Add a
constraint layer (Look-At, Follow-Path, with blendable influence) as a
first-class concept in the camera engine.

### Drivers — validates the modulation matrix
Any parameter can be controlled by an **expression** referencing another
property, instead of manual keyframing. This is Blender's generalized version
of AURA's weighted modulation matrix. Confirms the core mechanic is sound
industry practice, not an invented pattern. Blender's driver panel UI
(expression + variable list) is a reasonable reference for exposing editable
formulas without it feeling like raw code.

### Motion trails
A visible dotted path along an object's actual trajectory, with frame-number
markers — spacing communicates speed at a glance (bunched dots = slow, spread
dots = fast) without scrubbing. **Takeaway:** apply to AURA's camera spline
gizmo.

---

## Cinema 4D — MoGraph (Cloner + Effectors)

Directly solves AURA's "replicate shape and symmetrically offset it" feature,
and it's richer than a flat symmetry toggle:
- **Cloner** duplicates objects in linear, radial, or grid arrangements. Radial
  mode exposes radius, plane, start/end angle.
- **Effectors** (Random, Step, Delay, Shader, Fields) apply dynamic
  transformations — scale, rotation, position — driven by math functions,
  falloff, or other parameters.
- Every clone carries internal **U/V/W coordinates** (0–1 range) that Effectors
  use to assign each clone an individual value — enabling per-clone variation,
  not just uniform repetition.
- **Step Effector** offsets a parameter sequentially across clones.
- **Delay Effector** adds springy, staggered easing to how a transformation
  propagates across the set (cascading effect).
- **Fields** generalize falloff/influence — a spatial or procedural mask that
  can limit/shape which clones an effector affects.

**Takeaway for AURA:** "replicate + symmetrically offset" should be a
**Cloner-style array node** (linear/radial/grid) plus an **Effector layer**
that can itself be driven by the audio modulation matrix — e.g. "guns" track
drives a Step Effector's rotation offset, so each cloned shape reacts a beat
later than the last, cascading outward. This reuses the existing modulation
architecture instead of needing a separate system, and is more "musical" than
flat symmetry.

---

## Unity — Cinemachine

Resolves the camera-across-state-cuts problem with a proven, shipped pattern:
- Define **unlimited virtual cameras**; a **Brain** component monitors all of
  them and blends automatically, outputting through one real camera (Unity
  itself only supports one truly active camera at a time — blending would
  otherwise be impossible).
- Only one virtual camera is "live" at a time, except during a blend, when both
  are live simultaneously and interpolated.
- Which camera takes over is decided by **priority** — equal/higher-priority
  cameras override the current one, enabling state/trigger-driven camera
  switching.
- **Noise module** procedurally adds handheld-camera-style shake for cinematic
  feel.

**Takeaway for AURA:** define a **virtual camera per State** (or reusable
across states), each with its own position/behavior/spline, and let a
Brain-equivalent handle blending on state cuts — rather than hand-managing one
literal camera object across every transition.

---

## Unreal Engine — Sequencer

Structurally almost identical to what AURA is building: a non-linear editing
suite for offline cinematic sequences.
- **Camera Cut Track** — a dedicated track controlling *which camera is
  currently active* during playback, separate from the tracks that animate the
  cameras themselves. Drag the corner of a camera-cut section to blend in/out —
  no hand-keyframed crossfade needed.
- **Subsequences** — sequences nest inside larger sequences, so a big
  cinematic can be organized into smaller, independently-editable pieces (and
  let multiple people work on different sub-scenes independently).
- **Shots** — reusable, reorderable, trimmable units, non-destructive, exactly
  like clips in a normal video editor.

**Takeaway for AURA:** confirms the Camera Track (separate "which camera is
live" track vs. the tracks that animate cameras) as the correct architecture —
converges with the Cinemachine finding from a different tool. Also validates
States = clips directly. Subsequences suggest States themselves could later be
nested mini-timelines, not just flat blocks, once projects get complex.

## Unreal Engine — Niagara (particle system)

- Offers **two parallel views of the same system**: a full **node graph** for
  power users, and a **stack** (linear list of stacked modules) for
  less-technical users — same underlying data, two skins. Explicitly built
  because graphs are flexible but require technical knowledge, while stacks
  give an easier at-a-glance overview.
- **User Parameters** — values explicitly exposed by a system to the outside
  world, so external tools can drive them without opening the internal graph.
- **Event Handlers** — one emitter generates an event; a separate emitter
  listens and reacts. Distinct from continuous modulation — discrete
  trigger/response rather than an ongoing blended signal.

**Takeaway for AURA — this is the concrete answer to "simpler than
TouchDesigner":** build the real logic as a graph internally, but default users
into a **stacked list view** ("Drums → Radius: 50%, Guns → Explode Strength:
30%...") with the raw node graph only exposed via an "advanced" toggle. Also:
- Adopt **User Parameters** as an explicit exposed-parameter list per
  shape/system — not "everything is always linkable" by default.
- Adopt **discrete Event triggers** as a second modulation mechanism alongside
  the continuous weighted matrix: continuous modulation for smooth things
  (atmosphere → slow color drift), discrete events for percussive things (kick
  → one explosion burst fired once, not continuously blended).

---

## Ableton Live / Max for Live — Envelope Follower

The shipped, decades-refined version of "route track loudness to a parameter":
- **Rise** controls how much the attack of the envelope is smoothed; **Fall**
  controls how much the release is smoothed. (This is literally the
  attack/release/smoothing gap identified early in AURA's design.)
- **Gain** sets how much the incoming signal is amplified before tracking.
- **Min/Max sliders** scale the output modulation range (clamping, not just a
  flat weight).
- Defaults to following the track's own input, but **sidechain routing** lets
  it follow a *different* track's signal — the mechanism for cross-track
  modulation (e.g. "atmosphere" visually reacting to "drums").

**Takeaway for AURA:** the modulation matrix's per-connection signal chain
should be **Gain → Rise/Fall (attack/release) → Min/Max range → Weight**, in
that order — a proven signal chain, not a single flat percentage.

---

## Rhythm game beatmap editors (osu!, Beat Saber/ChroMapper)

Their core problem is AAURA's problem in miniature: placing timed events
precisely against a music waveform.
- **Beat-snap grid** — placed events snap to musical subdivisions (1/4, 1/8
  notes, etc.) of the detected BPM, rather than free timeline position.
- First workflow step for mappers: verify the waveform display actually lines
  up with the editor's beat grid before placing anything — a basic sync
  sanity-check.

**Takeaway for AURA:** offer **snap-to-beat-grid** (derived from onset/BPM
detection) when placing keyframes, state cuts, or triggers on the NLE
timeline — the same way video editors snap to frames. Also worth a basic
"confirm detected BPM/grid looks right" sanity step before someone builds a
whole scene against a misaligned grid.

---

## Cross-tool pattern (the throughline)

Every tool that's actually good at this — Blender, Cinema 4D, Cinemachine,
Unreal Sequencer/Niagara, Ableton — separates **raw data** (keyframes, audio
signal, base clone) from a **modulation/behavior layer** sitting on top
(constraints/drivers, effectors, camera-blend brain, envelope shaping, stack
view). None of them ask the user to hand-author every frame or every clone
individually. Treat "add a behavior/modulation layer on top of raw data" as a
standing design principle for every new AURA subsystem, rather than
discovering the gap feature-by-feature after the fact.
