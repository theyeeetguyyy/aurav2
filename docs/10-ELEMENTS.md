# 10 — Element Taxonomy

> **The concern that produced this doc:** *"currently I can see that at the end we will
> just be having shapes to play around with."* Correct, and it would be a dead end.
> This is the map out of it.

## Modes vs. elements — the reframe

v1 had 24 **modes**. A mode is a whole screen: pick "Kaleidoscope" and you get
kaleidoscope, exclusively. Modes do not combine. Twenty-four modes is twenty-four things.

AURA has **elements**. An element is a `SceneObject` type that shares the layer stack,
the transform, the parameter registry and the modulation matrix with every other element.
Elements combine. That is the entire reason for the brick architecture (Principle 12).

```
7 shapes × 6 deformers × 3 cloner modes × N elements × M post effects
```

Adding a 25th shape adds one thing. Adding a **new element family** multiplies.

Every legacy mode below is therefore mined for *what kind of thing it is*, not ported as
itself (D-18).

---

## A · Geometry elements — things with a surface

Have transform, material, deformers, cloners. Live in 3D space.

| Element | What it is | Legacy source | Priority |
|---|---|---|---|
| **Shape** ✅ | Procedural + primitive meshes | `geometryShapes2`, `polyhedronExplode` | built |
| **Cloner / Array** | One shape repeated linear/radial/grid, each clone individually addressable | `rhythmicGeometry` | **4H — next** |
| **Text / Logo** | Extruded 3D type | — | **high** |
| **Ribbon / Trail** | A swept tube along a path; leaves a streak behind a moving point | `dnaHelix` | high |
| **Parametric Curve** | Lissajous, spirals, knots — a line defined by an equation | `lissajous`, `mathMode`, `mobiusRings` | medium |
| **Terrain / Heightfield** | Displaced plane, height from noise *or from a spectrum* | `terrainMesh` | medium |
| **Fractal / L-System** | Recursive branching structure | `fractalTree` | medium |
| **Imported Mesh** | GLTF, swap-only | — | 4J |

> **Text is the sleeper.** The target audience is producers uploading weekly to YouTube.
> A 3D beat name, producer tag or channel logo that reacts to the mix is the single most
> requested thing in that market, and no shape combination substitutes for it.

## B · Data elements — the geometry *is* the audio

The shape is generated from the audio each frame. Not modulated by audio — **made of** it.
This family is what makes a video read as "music visualiser" instantly.

| Element | What it is | Legacy source | Priority |
|---|---|---|---|
| **Spectrum Bars** | Classic FFT bars. Linear, radial, or wrapped around any curve | `frequencyBars` | **high** |
| **Waveform Line** | Oscilloscope trace of the actual sample data | `waveformScope` | **high** |
| **Spectrogram** | Scrolling time×frequency texture | `spectrogram` | medium |
| **Level Rings** | Concentric rings, radius per band | `radialBloom` | medium |
| **Beat Grid** | Visible pulse markers on the detected grid | — | low |

> These need a per-frame FFT sampled **by time**, not a live analyser (HC-3). The feature
> timelines already store band energies; a raw spectrum column per frame is a small
> extension of the analysis worker.

## C · Particle elements

| Element | What it is | Legacy source | Priority |
|---|---|---|---|
| **GPU Emitter** | 100k+ points, GPGPU-simulated, forces and attractors | `gpgpuParticles`, `particleStorm` | **high** |
| **Surface Scatter** | Particles bound to another object's surface — dust off an exploding shape | `particleManipulation` | high |
| **Starfield** | Depth-parallax point cloud, cheap and effective | `starfield` | low |

> Particles are the biggest visual-density-per-effort win after deformers, and the
> `points` backend already exists as a declared render path (HC-4).

## D · Field elements — raymarched volume

No mesh. A distance or density function evaluated per pixel. Different render path,
different aesthetic — the "impossible geometry" family.

| Element | What it is | Legacy source | Priority |
|---|---|---|---|
| **SDF Cluster** | Metaballs melting into each other via `smooth-min` | `sdfRaymarcher` | 4K |
| **Tunnel** | Infinite corridor, camera flies through | `shaderTunnel`, `dimensionalRift` | **high** |
| **Plasma / Nebula** | Volumetric noise clouds | `neonPlasma`, `nebula`, `noiseRealm`, `aurora` | medium |
| **Voronoi Field** | Cellular partition, cells pulse individually | `voronoiField` | medium |
| **Gravitational Lens** | Screen-space warp around a point — a black hole | `voidEngine` | medium |

> Tunnels are worth calling out: they solve "the camera has somewhere to go" better than
> any object does, and they are cheap — one fullscreen shader.

## E · Environment elements

| Element | What it is | Legacy source | Priority |
|---|---|---|---|
| **Grid** | Infinite floor/wall grid, distortable | `cyberGrid`, `gridDistortion` | **high** |
| **Background** | Solid, gradient, or an audio-routable colour | — | **high** |
| **Fog / Atmosphere** | Depth haze; makes any scene read as deep | — | high |
| **Environment Map** | HDRI reflections — the cheapest way to make metal look real | — | medium |

> ✅ **Built as `engine/environment/`.** Background (solid or gradient), fog, a three-point
> lighting rig and the grid are now parameterised sections addressed under `@env`, so
> background intensity, fog density and light angle are all wires in the patchbay — which
> is what the brief asked for. Environment reflections are generated procedurally from
> `RoomEnvironment`, so there is no HDRI to ship. Modelled as a fixed set of sections
> rather than an open stack: a scene has exactly one background (D-44).

## F · Light elements — Q2

Point, spot, directional, area. Plus **strobe** (a light whose intensity is an onset
trigger) and **volumetric shafts** (`godRays`, `laserShow`).

**Lasers**, named once in the original brief, belong here: a volumetric beam is a light
with a visible cone, not a mesh.

## G · Overlay elements — Q3, screen space

2D, drawn over the 3D render, in screen coordinates.

| Element | Why it matters |
|---|---|
| **Vector shapes** — arrows, lines, circles, squares | Named in the original brief |
| **Text overlay** | Track title, BPM, lower-thirds, channel handle |
| **Image / logo** | Branding, watermark |
| **Waveform strip** | The whole track's waveform with a playhead — a "you are here" bar |
| **Letterbox / safe area** | Framing guides for vertical export |

## H · Post-process elements — whole frame

Applied after render, in order. Stack per project, not per object.

| Effect | Legacy source | Priority |
|---|---|---|
| **Bloom** | already in v1 stack | ✅ built |
| **Kaleidoscope** | `kaleidoscope` | ✅ built — plus a separate axis Mirror |
| **Feedback trails** | — | ✅ built — zoom, spin, drift, hue shift |
| **Chromatic aberration** | `fractalShader` | ✅ built |
| **Film grain · vignette · scanlines** | — | ✅ built |
| **Pixelate · halftone** | — | ✅ built |
| **Colour grade · cosine palette · zoom blur · lens distortion** | — | ✅ built |
| **RGB delay · slit-scan · pixel sort · datamosh** | — | next tier |
| **Motion blur** | — | low, expensive |

> Kaleidoscope is the highest leverage single effect in the whole list: it turns any
> scene, however plain, into something that reads as designed. One shader, applied to
> everything.

---

## What a finished frame actually looks like

> *"how will the visuals look after the product is complete, will we only have basic
> shapes?"* — No. But the honest answer has two halves.

**Today, yes — it is shapes.** One or more meshes with deformers, on a grid, lit by three
lights. That is a real limitation right now, not a misreading.

**What the ceiling is set by, though, is not shapes.** In order of how much they change
the look of a frame:

1. **Post-processing** (4I). Bloom, feedback trails, kaleidoscope, chromatic aberration,
   grain. This is the single largest jump available and it is three or four shaders.
   The same untouched sphere with bloom + feedback reads as a finished product; without
   them it reads as a viewport.
2. **Particles** (C). Density. A hundred thousand points reacting is a different medium
   from one mesh reacting.
3. **Cloners** (4H). One shape becomes forty, each individually offset and delayed.
4. **Fields** (D) — tunnels, plasma, metaballs. Volume rather than surface.
5. **Data elements** (B) — spectrum bars, waveform traces. The parts that read instantly
   as *music*.
6. **Environment** (E) — fog, gradient backgrounds, reflections. Depth and mood.
7. **Text** (A) — the producer tag, the beat name.

Shapes are the *skeleton*. Everything above is what makes a frame look like something
someone made on purpose.

### A concrete eight-second clip

```
  BACKGROUND   deep gradient, hue ← atmosphere brightness
  FOG          density ← sub-bass
  TUNNEL       flying toward camera, speed ← bar phase
  GRID         floor, distortion ← kick envelope

  SPHERE       procedural, metal
    Fracture     ← kick trigger        chunks burst on every hit
    Noise Wave   ← sub-bass            surface breathing underneath
    × Radial Cloner ×8
      Step effector rotation ← guns    cascade around the ring

  PARTICLES    50k, scattered off the sphere's surface,
               emission ← snare, drag ← atmosphere

  SPECTRUM     radial bars behind everything, per-band

  LOGO TEXT    extruded, scale ← master envelope

  ── post ──
  Bloom  →  Feedback trails  →  Kaleidoscope (drop only)  →  Grain
```

Every line is a `SceneObject` or an effect brick. Every arrow is a wire in the patchbay.
Nothing there needs a new architecture — the layer stack, parameter registry, modulation
matrix and effect stack already carry all of it.

**Built today:** the sphere, its deformers, its shading model, the wires, the background,
the fog, the lighting — and the whole post row.
**Still unbuilt:** the tunnel, the cloner, the particles, the spectrum and the logo text —
which is exactly the gap [13-PRODUCT-GAP.md](13-PRODUCT-GAP.md) measures.

### Why it will not look like everyone else's

Two structural reasons, not aesthetic ones:

- **No presets to fall back on.** There is no "Kaleidoscope mode" to pick, so no two
  users land on the same frame by picking the same item from a list.
- **The stack is per-project.** Element order, deformer order, routing weights and curves
  are all authored. The combinatorics are large enough that a recognisable channel
  identity is achievable — which is the stated growth loop in
  [01-VISION.md](01-VISION.md).

---

## What this buys

A scene is not "a shape". It is a **stack**:

```
Background (audio-routable colour)
  Grid              ← element E
  Tunnel            ← element D
  Sphere            ← element A
    + Explode       ← deformer, driven by kick
    + Noise Wave    ← deformer, driven by sub
    × Radial Cloner ← 8 copies, Step effector driven by guns
  Spectrum Bars     ← element B, wrapped radially
  GPU Emitter       ← element C, scattered off the sphere
  Logo Text         ← element A
—— post ——
  Bloom → Kaleidoscope → Feedback → Grain
```

Every line is independently addable, orderable, and routable. That is a *system*, not a
mode list — and no two producers' stacks look the same. Which is the actual product
promise: *"your channel becomes visually recognisable."*

---

## Build order

Ranked by **visual payoff per unit of work**, not by category tidiness.

1. **Cloner + Effectors** (4H) — multiplies everything already built. From the brief.
2. **Post-process: Bloom + Kaleidoscope + Feedback** (4I) — three shaders, transforms every scene.
3. **GPU particle emitter** — highest density-per-effort after deformers.
4. **Spectrum Bars + Waveform Line** — instant "this is music" legibility.
5. **Grid + Background + Fog as real elements** — mostly extraction from `DefaultScene`.
6. **Text / Logo** — the audience's most concrete unmet need.
7. **Tunnel** (field backend proving ground) — also validates the `sdf` render path.
8. **Trails / Ribbons**, then lights, overlays, and the rest of D.

Nothing here requires abandoning the architecture. Every row is a `SceneObject` type or
an effect brick, and all of them inherit transform, parameters, modulation and the
timeline for free — which is exactly why the architecture was built this way first.
