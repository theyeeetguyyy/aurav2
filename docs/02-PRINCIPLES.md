# 02 — Design Principles

Twelve standing rules distilled from deep research into TouchDesigner, Blender,
Cinema 4D, Unity Cinemachine, Unreal Sequencer/Niagara, Ableton Live, and rhythm-game
beatmap editors. **Check every new subsystem against these before implementing it.**

---

### 1 — Raw data + behaviour layer. Never hand-author everything.

Every tool that is genuinely good at this separates **raw data** (keyframes, audio
signal, base clone) from a **behaviour layer** on top (constraints, drivers, effectors,
camera-blend brains, envelope shaping). None of them ask the user to author every frame
or every clone individually.

When adding any subsystem, ask: *what is the raw data, and what declarative layer sits
on top of it?* If the answer is "the user types every value," the design isn't finished.

### 2 — Dual view: stack by default, graph on demand.

From Unreal Niagara. Build the real logic as a graph internally; default the user into a
**stacked list** ("Drums → Radius 50%, Guns → Explode 30%") with the node graph behind an
"Advanced" toggle. Same data, two skins.

This is the concrete mechanism for *"simpler than TouchDesigner."* Not a slogan — a
UI architecture.

### 3 — Typed node categories, not a free-for-all.

From TouchDesigner's operator families. Nodes are typed and colour-coded
(`Signal`, `Geometry`, `Camera`, `Material`), same-type wiring by default — with
**`Signal` as the single exception that can bind onto any parameter of any type**
(TouchDesigner's CHOP "export" mechanism).

This is what makes "anything can link to anything" structured instead of chaotic, and
lets the UI colour-code meaningfully.

### 4 — Two modulation mechanisms, not one.

- **Continuous** — weighted blend of ongoing signals. For smooth things: atmosphere → slow colour drift.
- **Discrete events** — trigger/response, fire-once. For percussive things: kick onset → one explosion burst.

Forcing a kick hit through a continuous blend is why amateur audio-reactive work looks
mushy. Percussion needs a trigger model.

### 5 — States reference, they do not copy.

From Blender's NLA. A **State** is a named, reusable definition (the source of truth).
What sits on the timeline is a **Strip referencing** it. Editing the State updates every
placement.

Must be the data model from the start — retrofitting reference semantics onto a
copy-based system is a rewrite.

### 6 — Camera is an independent track.

From Blender NLA and Unreal's Camera Cut Track, converging independently. Camera
keyframes live on their **own track**, parallel to the visual track, never nested inside
a State — otherwise the camera hard-resets at every cut and the "flying cinematographer"
feel dies.

One keyframe store, two views: spatial (3D authoring panel) and temporal (timeline
track). Not two systems.

### 7 — Replication is a Cloner + Effectors, not a symmetry toggle.

From Cinema 4D MoGraph. "Replicate and offset" should be a **Cloner** (linear/radial/grid)
plus an **Effector layer** (Random/Step/Delay) that is itself drivable by the modulation
matrix.

Then "guns drives a Step Effector's rotation offset" makes each clone react a beat later
than the last, cascading outward. More musical than mirroring, and it reuses the
modulation architecture instead of needing a new one.

### 8 — Envelope shaping on every connection.

From Ableton's Envelope Follower. Per-connection signal chain is
**Gain → Rise/Fall → Min/Max → Weight**, in that order. Never a flat percentage.

Raw audio mapped straight to a parameter looks jittery and amateurish. Rise/Fall
(attack/release smoothing) is the single most-missed feature by people prototyping this
kind of tool.

### 9 — Drag-and-drop onboarding. Patching is the advanced path.

From Resolume, which wins the live-VJ market almost entirely on ease of use over
TouchDesigner's power. Every workflow needs a zero-learning-curve surface: drag a stem
onto a property, drag a state onto the timeline, drag a shape into the scene.
Node-wiring is never the default path.

### 10 — Automation lanes. Show what is driving what.

From DAW automation. A visible curve of the actual modulation output at any timeline
point, hand-editable. Modulation must be *legible and debuggable*, not a knob you set
and pray about.

### 11 — Deformers are sliders. The graph is underneath.

From Notch. Expose complex behaviour as simple labelled sliders; keep the real graph
below. Converges with Principle 2 — sliders and stacked lists are the surface, the graph
is the engine.

### 12 — Lego bricks, not cookie cutters.

From Blender Geometry Nodes, Eurorack, Shader Park, LYGIA, Cables.gl.

**AURA is built from atomic, generic operator bricks that patch together.** Users are
never locked into fixed canned templates.

- **Bricks** — small single-purpose operators: a primitive, a twist, a smooth-min, a radial cloner, a bloom.
- **Recipes** — a preset is *only* a named, saved, editable combination of bricks. Every
  recipe can be opened, inspected, rewired, and re-saved. There are no black boxes.
- **Fields** — every signal (audio metric, LFO, noise, beat phase, drop tension) is one
  unified type differing only in update rate. Any Field can modulate any brick parameter.

> This principle is why the 24 monolithic modes from v1 are **mined for bricks, not
> ported as modes**. A ported mode is a black box, and black boxes are the thing AURA
> exists to replace.

---

### Standing caution: raw RMS is a chaotic mess

A TouchDesigner artist's warning, and it generalises: syncing to whole-song loudness
makes everything move all the time with no intent. Syncing to **specifically extracted**
data — onset timing, frequency bands, beat grid — reads as deliberate and musical.

This is why deep MIR analysis is load-bearing infrastructure, not a nice-to-have.

---

*Source material: `research/02-tool-research-deep-dive.md`.*
