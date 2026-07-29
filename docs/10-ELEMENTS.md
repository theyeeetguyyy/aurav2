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

> The grid is currently hardcoded in `DefaultScene`. It should become a real element with
> parameters, so it can be modulated and turned off. Same for background colour, which
> the brief explicitly asked to be routable.

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
| **Bloom** | already in v1 stack | **4I** |
| **Kaleidoscope** | `kaleidoscope` | **high** — cheap, transforms any scene |
| **Feedback trails** | — | high — frame ping-pong, huge character |
| **Chromatic aberration · glitch · RGB shift** | `fractalShader` | 4I |
| **Film grain · vignette · scanlines · VHS** | — | medium |
| **Pixelate / dither / posterise** | — | medium |
| **Motion blur** | — | low, expensive |

> Kaleidoscope is the highest leverage single effect in the whole list: it turns any
> scene, however plain, into something that reads as designed. One shader, applied to
> everything.

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
