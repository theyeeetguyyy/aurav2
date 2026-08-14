# 14 — Visual Idea Bank

> Research pass across TouchDesigner, Notch, Resolume and the creative-coding /
> shader-art world, plus original ideas. Ordered by **what is worth building**, not by
> what exists elsewhere.
>
> Companion to [10-ELEMENTS.md](10-ELEMENTS.md) (the element families) and
> [12-DEFORMERS.md](12-DEFORMERS.md) (the fifteen built).

## Benchmark

Notch ships **70+ deformer nodes** and **20+ cloner nodes**. AURA has 15 deformers, 14 post effects,
9 materials, 5 cloners and 6 effectors, across three render backends. That gap is a roadmap, not a
verdict — Notch is a decade old, and about half of its list is things AURA should never build (face
tracking, MDD import, fertilizer times). The half worth taking is below.

**Read [20-OPPORTUNITIES.md](20-OPPORTUNITIES.md) alongside this.** This document is the visual
vocabulary; that one is what the 2026-08 market and technology scan says is worth building, and its
top three entries are not on this list at all.

---

## Part 1 — Things AURA can do that Notch and TouchDesigner structurally cannot

This is the part worth caring about most. It follows from one property: **features are
timelines sampled by `t`, per stem** (HC-3). Every other tool taps a live signal, which
means it only knows the present, and only for the whole mix.

### 1.1 Look-ahead — the shape *braces* before the hit

A deformer or field reads `sample(t + lookahead)`. The object anticipates: it tenses a
sixteenth before the kick lands and releases into it.

No live-tap architecture can do this at all — the future has not happened yet. It is the
single most distinctive thing available to us, it costs almost nothing to implement, and
it reads instantly as "choreographed" rather than "reacting".

### 1.2 Time-smear across space — geometry that *holds* the last second

Vertex or clone index maps to a time offset: `sample(t − index × delay)`.

- On a cloner array: clone 0 is now, clone 7 is half a second ago. The ring becomes a
  physical waveform of the recent past, and every hit visibly travels outward.
- On a mesh axis: the shape's left side is older than its right. A drum fill draws itself
  across the surface.

### 1.3 Per-stem geometry — the mesh *is* one stem's spectrum

An **FFT deformer** where vertex angle maps to frequency bin and displacement to that
bin's energy — but sourced from **one stem**, not the mix. The sphere becomes the drums'
spectrum while a second object becomes the atmosphere's.

Notch has an FFT deformer; it reads the master output. Ours reads whichever stem you wire,
which is the entire product thesis made geometric.

### 1.4 One clone per stem

A cloner whose index maps to a *stem*, not just an offset. Eight stems, eight objects,
each driven by its own. The mix becomes visibly decomposed — literally what the original
brief described and what no competitor can express.

### 1.5 Section-aware behaviour

Elements that read `is-buildup` / `drop-decay` / section markers and change *what they do*,
not just how much. Kaleidoscope only in the drop. Particles only in the breakdown.
(Needs Phase 6.)

---

## Part 2 — Deformer backlog

Ranked. Cross-referenced against Notch's node list where relevant.

| Deformer | Class | Why |
|---|---|---|
| **FFT / Spectrum** | audio-native | §1.3. The most on-brand deformer possible. |
| **Curl Noise** | divergence-free field | Fluid swirl with no sources or sinks — reads as smoke, not as wobble. Categorically better-looking than plain noise. |
| **Look-ahead wrapper** | temporal | §1.1. Arguably a Field modifier rather than a deformer. |
| **Echo / Time-smear** | temporal | §1.2. |
| **Cull / Dissolve** | subtractive | Hide vertices past a threshold. The shape *disintegrates*. Nothing currently removes geometry, only moves it. |
| **Smooth / Relax** | inverse | The anti-deformer. Stack it after chaos to regain control — makes the whole stack more usable. |
| **Ocean Wave (Gerstner)** | periodic | Layered sine + noise with peaked crests. Real water, not a sine ripple. |
| **Displacement Map** | image-driven | Push a logo or texture into geometry. Also the bridge to importing any image as form. |
| **Voronoi Shatter** | cellular | True cells rather than the grid cells `Fracture` uses. Glass, not blocks. |
| **Mirror / Symmetry** | reflective | 3D kaleidoscope. Cheap, transforms silhouettes. |
| **Taper** | axial | Linear cross-section scaling. Trivial, and pairs with everything. |
| **Spline Deform** | path | Bend geometry along a curve — also how text-on-path works later. |
| **Inflate / Pressure** | volumetric | Volume-preserving swell. Breathing. |
| **Jelly / Inertia** | temporal | Overshoot and settle. Implemented as a *convolution over past samples* rather than an accumulator, so it stays pure (D-36). |
| **Vertex Colour by displacement** | shading | Colour where the mesh is stretched. Makes every other deformer legible. |

---

## Part 3 — Particles

The largest single jump in visual density available.

| System | Notes |
|---|---|
| **Curl-noise advection** | The default good-looking particle motion. Smoke, ink, ribbons. |
| **Surface emission** | Particles born off another object's surface — dust off an exploding shape. |
| **Strange attractors** | Lorenz, Thomas, Aizawa, Halvorsen. Deterministic, stateless from a seed, and stunning. Attractor parameters are modulation targets — the *shape of the attractor* changes with the music. |
| **Flocking / boids** | Emergent, organic, feels alive. |
| **SPH fluid** | Expensive but unmistakable. |
| **Gravity wells** | Scene objects act as attractors/repellers on the particle field. |
| **Per-particle trails** | Ribbons. Doubles the perceived density for little cost. |
| **Particles → metaballs** | Particles as SDF sources, smooth-min'd into liquid metal. |

---

## Part 4 — Raymarched fields

Different render path, "impossible geometry" aesthetic.

| Field | Notes |
|---|---|
| **SDF metaballs** | `smooth-min` blending. Clay that melts and separates with the music. |
| **Domain warping** | Inigo Quilez's technique — noise offsets the sample point of more noise. Each layer adds swirls, folds and tendrils. Enormous complexity from very little code. |
| **Reaction–diffusion** | Turing patterns. Organic growth, coral, fingerprints. Feed/kill rates as modulation targets. |
| **Fractals** | Mandelbulb, Menger sponge, Apollonian gaskets, Kaliset. Infinite zoom, and fractal parameters are extraordinary modulation targets. |
| **Volumetric clouds / nebula** | Depth and atmosphere. |
| **Tunnel** | Solves "the camera needs somewhere to go" better than any object. |
| **Gravitational lens** | Screen-space warp — a black hole bending the scene behind it. |

---

## Part 5 — Post-processing

Cheapest quality-per-hour in the entire document.

**Tier 1 — build these first**
- **Bloom** — the single largest perceived-quality jump available.
- **Feedback trails** — previous frame transformed (zoom / rotate / offset) and blended. Zoom-feedback alone creates infinite tunnels from any content.
- **Kaleidoscope** — turns any scene, however plain, into something that reads as designed.
- **Chromatic aberration + RGB delay** — per-channel *time* offset, not just spatial. Colour fringing that lags with the music.

**Tier 2**
- **Slit-scan** — one column of the screen sampled per moment in time. With feature timelines this becomes literal time-as-space, and it is a genuinely striking look.
- **Pixel sort** · **datamosh** — glitch, currently very much in fashion.
- **Optical-flow displacement** — the frame drags itself along its own motion.
- **Edge detect / contour** — instant line-art or toon rendering.
- **Halftone · ASCII · dither · posterise** — print and terminal aesthetics.
- **CRT / VHS / scanlines** — analogue nostalgia.
- **Anamorphic streaks · god rays · lens dirt** — cinematic.
- **Cosine palettes** — recolour the entire frame from four vectors. Palette cycling on the beat.

---

## Part 6 — Data elements

The parts that make a video read instantly as *music* rather than as abstract 3D.

- **Spectrum bars** — linear, radial, or wrapped around an arbitrary curve
- **Waveform / oscilloscope trace**
- **Lissajous / vectorscope** — stereo X vs Y. Audio-native, genuinely beautiful, nearly free
- **Spectrogram** — scrolling time × frequency
- **Onset sparks** — a visible mark at each detected hit
- **Beat-grid rings** — pulses on the detected grid, so the visual proves it is in time

---

## Part 7 — Type and structure

- **Extruded 3D text** — producer tag, beat name. The audience's most concrete unmet need.
- **Kinetic typography** — a documented 2026 motion-design trend; letters that stretch, flow and respond.
- **Variable-font weight driven by loudness** — the typography *breathes*. Modern and almost nobody does it audio-reactively.
- **Per-character deformation by band** — each letter driven by a different frequency.
- **Text on path**, **text as cloner source** (a ring of your logo).
- **L-systems / fractal trees**, **space colonisation growth**, **Truchet tiles**,
  **Delaunay / Voronoi wireframes**.
- **Render modes as a property**: wireframe, point cloud, contour lines. One toggle, three
  completely different products from the same geometry.

---

## Part 7b — What the timeline and the camera-as-parameter just unlocked

Written after driving the app end to end for the first time. Everything below is cheap
*because of* what already shipped, not in spite of it — these are ideas the architecture is
now shaped to accept, which is a different list from the one written before it existed.

### The camera is a routing target, so these are wires and not features

The Scene Camera's `position`, `rotation` and `fov` are ordinary parameters (D-64). That
retires a whole category of "camera feature" into things a user assembles:

| Look | How | Why it matters |
|---|---|---|
| **Kick-punch dolly** | kick onset → `position.z`, short decay | The single most recognisable music-video camera move, and it is now one wire |
| **Breathing lens** | slow LFO → `fov`, ±3° | Reads as film rather than as a game engine. Nearly free |
| **Snap-zoom on the drop** | a lane drawn against `fov`, stepped interpolation | Needs the *stepped* lane mode to be worth using — see the gap below |
| **Dutch roll on the build** | build-up intensity → `rotation.z` | Waiting on 6C's intensity engine, and a good argument for it |

**The gap this exposes:** a drawn lane interpolates smoothly, so a *snap* — the hardest cut in
the visual language of this genre — cannot be drawn. `LaneInterpolation` already exists as a
type. A `step` mode is a small change with a large payoff, and it is the missing half of
"keyframing" as this product means it.

### States are selections, so a state can be a *variation* and not just a look

A state owns its scene (D-98). Two ideas fall straight out:

1. ~~**Auto-variations.**~~ ✅ built (D-74). Two rules were not obvious until the naive version
   existed: lights must be in every variation (or a "variation" is a black frame), and wires
   must stay live (or a section goes static, which reads as broken rather than restrained).
   **Next along this line:** vary the *material* rather than the object set — the same three
   shapes in emissive for the drop and matte for the breakdown is a bigger visual change than
   showing fewer of them, and materials are already bricks (D-43).
2. **A-B compare.** Two states, one key, alternate between them. Trivial given the resolver,
   and the fastest way to judge whether an edit helped — which is currently a matter of memory.

### Cuts are hard, and hard cuts are worth more with a strobe — ✅ built

Shipped as `Cut Flash` (D-75), keyed off `cutTime` rather than `activeStripIds` — the boundary
*time* is what an envelope needs, and publishing it keeps the effect a pure function of the
clock. **What it opened up:** any effect can now key off the edit rather than the music. Worth
following with a **cut-triggered RGB split**, a **one-bar zoom punch** on a boundary, and a
**hold-frame** that freezes the outgoing picture for a beat before the incoming one arrives —
the last one is the cheapest way to get something that reads as a deliberate edit rather than
a switch.

### The monitor made one thing obvious

A three-lane timeline under a live monitor invites **a strip that is a camera**, not a look —
6F. Watching the picture while dragging a camera strip is the whole reason NLEs put the monitor
above the track, and the layout is now correct for it.

---

## Part 7c — Craft observations from the first real run

Not effects. Things a screenshot showed that a test never would.

- **Object colour rotation changed the feel of the product more than any effect so far.** Two
  shapes in orange and yellow read as a designed scene; the same two in one indigo read as a
  bug (D-70). Worth generalising: a new light could take a warm/cool alternation, a new post
  effect could arrive at a tasteful rather than a neutral default. **Defaults are a design
  surface, and this one was being wasted.**
- **The grid is the most prominent thing in an empty frame** and it is authoring furniture
  dressed as content. Consider a `Grid` mode that is *deliberately* part of the look —
  perspective-faded, colour-routable, driven by the kick — rather than a neutral reference
  plane the user is expected to switch off.
- **Bloom on a smooth-shaded primitive is already good.** The 720p export frame with one
  torus knot, one bloom and one orbit is genuinely presentable. The ceiling is not as far away
  as the backlog implies; the gap is *authoring* — knowing which two wires to attach — more
  than it is missing element families.
- **A preset that cannot work is worse than a missing preset.** 4K sat in the dropdown failing
  every time it was chosen (D18). Audit the other enumerations the UI offers against what the
  engine can actually deliver — frame rates, material models, cloner counts.

---

## Part 7d — What the points and lines backends just made cheap

*Written 2026-08-14, after Pass 4 shipped and after the [2026-08 landscape scan](19-RESEARCH-2026.md).
Same principle as 7b: these are ideas the architecture is now shaped to accept.*

`curves.ts` established a contract that turns out to be worth more than the four paths built on it:
**a strand is written by a function that may integrate, once, at build time, deterministically from a
seed.** Anything expressible that way is now roughly a day's work and arrives with fifteen deformers,
the palette, the modulation matrix and the exporter already attached.

| Idea | What it is | Why it fits the contract exactly |
|---|---|---|
| **Strange attractors** — Lorenz, Aizawa, Thomas, Halvorsen | Integrate a chaotic system; the trajectory *is* the drawing | It is the flow line with a different `dx/dt`. Twenty lines of arithmetic each, and nothing else in the product looks remotely like them |
| **Differential growth** | Points on a closed curve repel their neighbours; the curve subdivides where it stretches. Coral, brain folds, lichen | Iterative and stateful — which is fine, because build time is where state is allowed |
| **Isolines of a spectrogram** | Marching squares over a 2D scalar field, and a spectrogram is one | Contours of the audio itself, as line art. The most literal possible answer to "the audio is never the shape" |
| **L-systems, space colonisation** | Branching structures grown by rules | Same shape again: grow once, draw the edges |
| **Trails** | A stroke whose vertices are one object's positions at successive past times | The one that does *not* fit — it needs modulation evaluated at `t − k` per vertex, so it is a pass rather than a brick |

**The blocker underneath the best of them.** A waveform, an oscilloscope trace and a spectrum are all
polylines whose *shape parameter* changes every frame, and [D-31](07-DECISIONS.md) forbids that
because rebuilding geometry at frame rate re-tessellates a mesh. A 512-point polyline is not a mesh.
The proposed relaxation — `rebuildCost: 'cheap'` — is in [20 §C1](20-OPPORTUNITIES.md), and it is
what stands between the product and its own most on-brand element family.

## Part 7e — Ideas from the 2026-08 scan that are not effects

The four below are worth more than any deformer on the list above, and three of them are barely
graphics work at all. Full reasoning, cost and risk in [20-OPPORTUNITIES.md](20-OPPORTUNITIES.md).

- **Silence as a signal.** Every visualiser reacts to loudness; nothing reacts to *absence*. The bar
  before the drop, where everything stops, is the most important visual moment in this genre, and it
  is currently inexpressible. An inverted gated envelope over a whole-file timeline costs almost
  nothing and can only be computed offline — a live tap cannot tell "silent" from "not started".
- **Anticipation on any wire.** The Time Delay effector can read `t + lookahead`; nothing else can.
  Editing craft says a cut landing *just before* the beat creates tension where one landing on it
  merely confirms. A negative delay in the signal chain gives every parameter that, in two lines.
- **Colour from harmony.** A chromagram per stem — twelve bins off the FFT that already runs —
  compared against key profiles gives the chord. Wire it to the hue shift that landed in D-116 and
  *the colour changes when the chord changes*. Scriabin drew this map in 1910; nobody in the
  competitive set ships it.
- **The 1-bit family** — dither, halftone, ASCII, posterise. Four post bricks, and the one place
  where "another post effect" is a different *kind* of image rather than another glow: it is the
  fastest way for output to stop reading as smooth generated WebGL.

## Part 8 — What I would actually build, in order

1. ~~**Bloom + Feedback + Kaleidoscope** (4I)~~ — ✅ built, and fourteen effects rather than
   three. Materials (4L) and environment (4M) shipped alongside, because untreated PBR on a
   grid was as much of the problem as the missing post chain.
2. ~~**Cloners + Effectors** (4H)~~ — ✅ built, and 1.1 look-ahead plus 1.2 time-smear
   shipped with them as the Time Delay effector rather than waiting for their own phase.
3. **Curl-noise GPU particles + surface emission** — density. **Next.**
4. ~~**Look-ahead + time-smear**~~ — ✅ built into the Time Delay effector.
5. **FFT deformer** — the most on-brand deformer possible.
6. **Spectrum bars + waveform + Lissajous** — instant musical legibility.
7. **Extruded text** — the audience's clearest unmet need.
8. **Domain warping + SDF metaballs** — proves the `sdf` backend.
9. **Slit-scan + RGB delay** — signature looks that lean on the timeline architecture.
10. Everything else, as appetite dictates.

**Revised after running it, then built.** Three things jumped the queue and all three shipped:

- ~~**`step` lane interpolation**~~ — ✅ built (D-72). It was already in the engine and
  unreachable from the primary path, which is the third time that pattern has appeared.
- ~~**Auto-variations from one scene**~~ — ✅ built (D-74). Intro / Build / Drop / Breakdown
  derived as subsets and sequenced in one click. The escalation is measurable in the exported
  file, not just in the state list.
- ~~**One-frame flash on a strip boundary**~~ — ✅ built (D-75) as the `Cut Flash` post brick.

Both are authoring, not rendering. The first real export made clear that the ceiling is
further off than the *floor* is: one shape, one bloom and one orbit already looks like
something. Knowing which two wires to attach is the harder problem.

---

## Sources

- [Notch — Procedural Everything](https://www.notch.one/features/procedural-everything)
- [Notch Manual — Deformer node reference](https://manual.notch.one/1.0/en/docs/reference/nodes/deformers/)
- [Notch — Particles, Simulations & Volumetrics](https://www.notch.one/features/particles-simulations-volumetrics)
- [TouchDesigner — GPU Particles and Optical Flow](https://interactiveimmersive.io/blog/touchdesigner-lessons/touchdesigner-gpu-particles/)
- [Derivative — Raymarching & Shader Programming with RayTK](https://derivative.ca/workshop/raymarching-shader-programming-raytk/70463)
- [Domain warping technique reference](https://github.com/MiniMax-AI/skills/blob/main/skills/shader-dev/techniques/domain-warping.md)
- [Shader Art: GLSL and WebGL effects](https://lumitree.art/blog/shader-art)
- [Resolume — effects reference](https://resolume.com/support/en/effects)
- [Top effects for Resolume](https://crazyartist.net/en/top-effects-for-resolume-that-you-have-to-try-out/)
- [WebGPU compute — SPH, boids, DLA examples](https://github.com/scttfrdmn/webgpu-compute-exploration)
- [Typography & motion trends 2026](https://www.fontfabric.com/blog/10-design-trends-shaping-the-visual-typographic-landscape-in-2026/)
