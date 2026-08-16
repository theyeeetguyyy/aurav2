# 09 — Brick Registry

Catalogue of atomic operators and the libraries behind them. Per Principle 12, AURA is
built from these; a "preset" is only a named, editable combination of them.

Every brick declares `ParamDescriptor[]` (HC-5). Registration is data — a new brick is
added to a registry, never to a `switch` in core engine code.

---

## 1. Library dependencies

| Domain | Library | Role |
|---|---|---|
| SDF / raymarch shaders | **LYGIA** + `hg_sdf` | Granular GLSL/WGSL function library — `math/`, `space/`, `color/`, `generative/`, `sdf/`, `lighting/`, `distort/`. |
| JS SDF authoring | **`shader-park-core`** | JS-level SDF composition — `sphere`, `box`, `union`, `blend`, `mirrorX`, `displace`. |
| Post-processing | **`@react-three/postprocessing`** + `pmndrs/postprocessing` | Selective bloom, chromatic aberration, glitch, tone mapping. |
| Feedback loops | `react-three-shader-passes` | Frame-buffer ping-ponging for optical trails. |
| GPGPU particles | Three.js `GPUComputationRenderer` + `three.quarks` | Texture-driven particle physics past 100k. |
| CPU noise | `simplex-noise` | 2D/3D/4D simplex on the JS side. |
| GPU noise | `glsl-noise` / LYGIA `generative/` | In-shader Perlin/simplex FBM. |
| Node graph UI | `@xyflow/react` | Routing canvas. |
| Audio features | own FFT worker + `meyda` | Offline MIR (HC-3, D-32) + live tap for future mic input. |
| Video export | WebCodecs `VideoEncoder` + `mp4-muxer` | Hardware-accelerated MP4. |
| Camera splines | Three.js `CatmullRomCurve3` | Native, zero dependency. |

> Not installed yet. Currently present: `three`, `@react-three/fiber`, `@react-three/drei`,
> `zustand`, `meyda`, `lucide-react`, `tailwindcss`. Add libraries at the phase that needs
> them, not upfront.

## 2. Geometry bricks — `mesh/primitive`

Native Three.js classes. Correct topology and UVs, **swap-only** (no vertex morph, HC-4).

| Brick | Class | Parameters |
|---|---|---|
| `geo-box` | `BoxGeometry` | width, height, depth, ×Segments |
| `geo-sphere` | `SphereGeometry` / `IcosahedronGeometry` | radius, detail (0–5) |
| `geo-dodecahedron` | `DodecahedronGeometry` | radius, detail |
| `geo-octahedron` | `OctahedronGeometry` | radius, detail |
| `geo-tetrahedron` | `TetrahedronGeometry` | radius, detail |
| `geo-cylinder` | `CylinderGeometry` | radiusTop, radiusBottom, height, radialSegments, openEnded |
| `geo-cone` | `ConeGeometry` | radius, height, radialSegments |
| `geo-torus` | `TorusGeometry` | radius, tube, radialSegments, tubularSegments |
| `geo-torus-knot` | `TorusKnotGeometry` | radius, tube, tubularSegments, radialSegments, p, q |
| `geo-plane` | `PlaneGeometry` | width, height, ×Segments |
| `geo-ring` | `RingGeometry` | innerRadius, outerRadius, thetaSegments |
| `geo-lathe` | `LatheGeometry` | points, segments, phiStart, phiLength |
| `geo-extrude` | `ExtrudeGeometry` | shapes, depth, bevelEnabled, bevelSegments |

## 3. Geometry bricks — `mesh/procedural`

All generated from **one welded icosphere** with a fixed vertex count, displaced per
type. Any↔any vertex morphing within this family. ✅ Implemented.

| Brick | Displacement | Extra params |
|---|---|---|
| `proc-sphere` | identity | — |
| `proc-cube` | project onto 3 axis planes | roundness |
| `proc-octahedron` | project onto 4 diagonal planes | roundness |
| `proc-icosahedron` | project onto 10 face planes | roundness |
| `proc-torus` | azimuth → major angle, polar → minor angle | tube |
| `proc-cylinder` | min(side wall, cap plane) | height, roundness |
| `proc-cone` | linear radial taper over height | height |

Cube, octahedron and icosahedron share one primitive: `n / max_i(n · Nᵢ)`, projection
onto a convex polyhedron's face planes. Three shapes, one function.

`roundness` blends between the projected form and the pure sphere — free, and a useful
modulation target on its own.

**Base topology.** Three.js `PolyhedronGeometry` splits each face into `(detail+1)²`
triangles — *not* `4^detail`, which earlier notes assumed. Faces are `20·(detail+1)²`,
and by Euler's formula the welded vertex count is `10·(detail+1)² + 2`.
`detail = 7` → 1280 faces → **642 vertices**.

Welding must drop `uv` and `normal` first: `mergeVertices()` compares all attributes, so
a UV seam keeps coincident vertices apart and leaves a ring of duplicates. Position is
the only attribute that defines topology here.

Every built geometry also carries a **`baseDirection`** attribute — the undisplaced unit
sphere directions. Deformers that push "along the original normal" and the morph engine
both need that shared reference frame.

**Invariant:** `position.count === BASE_VERTEX_COUNT` for every member, at every
parameter value. Enforced by `proceduralMesh.test.ts`. ✅

## 3b. Geometry bricks — `mesh/primitive`

Native Three.js classes, correct topology and UVs, `morphGroup: null`. ✅ Implemented:
`geo-box` · `geo-sphere` · `geo-torus` · `geo-torus-knot` · `geo-cylinder` · `geo-cone` ·
`geo-plane` · `geo-ring` · `geo-dodecahedron` · `geo-icosahedron`

Segment/resolution parameters are declared `exposed: false` — rebuilding geometry every
frame because a knob wiggled is a performance trap. Continuous shape change belongs to
deformers, not to topology.

## 3c. Geometry bricks — `lines` backend and the ribbons that share its paths

✅ Implemented (D-114). Strokes, drawn as indexed `THREE.LineSegments`:
`line-lissajous` · `line-spiral` · `line-rose` · `line-flow` · `line-web`

The first four are paths from `backends/curves.ts`, each drawing `strands` copies of itself spread by
phase or seed. `line-web` is not a path at all — nodes scattered in a ball, linked to whichever
neighbours fall inside a radius — and it is the reason the backend indexes its segments rather than
assuming polylines.

Ribbons sweep a section along the same paths and are ordinary `mesh/primitive` bricks:
`geo-ribbon-spiral` · `geo-ribbon-flow`. `sides` × `flatten` spans a round cable to a flat band.

Materials: `mat-lines` · `mat-lines-additive`. **No width parameter** — WebGL rasterises every line
at one pixel and ignores `linewidth`, so weight comes from the ribbons.

## 4. SDF bricks — `sdf` backend

**Primitives:** `sdf-sphere` · `sdf-box` · `sdf-torus` · `sdf-cylinder` · `sdf-capsule`

**Combinators:**

| Brick | Formula | Meaning |
|---|---|---|
| `sdf-union` | `min(d1, d2)` | boolean OR |
| `sdf-subtract` | `max(d1, -d2)` | boolean difference |
| `sdf-intersect` | `max(d1, d2)` | boolean AND |
| `sdf-smooth-min` | `min(d1,d2) - h²k/4`, `h = max(k-|d1-d2|, 0)/k` | **clay blend** — shapes melt into each other. Wire `k` to a Field and they pulse, merge and separate with the music. This is the SDF backend's whole reason to exist. |

**Space modifiers** (LYGIA `space/`): `sdf-mirror` (`abs(p)`) · `sdf-rotate` ·
`sdf-repeat` (infinite 3D tiling) · `sdf-shell` (`abs(d) - thickness`)

## 5. Deformer bricks — `geometry` family

✅ **Fifteen**, each a structurally distinct class of vertex operation. The catalogue and the argument
for each are in [12-DEFORMERS.md](12-DEFORMERS.md) — the single home, so this list cannot drift.

They apply to *every* backend that has vertices: a mesh, a cloud and a stroke alike, with no
backend-specific code, because a deformer displaces positions and a point and a line vertex are
positions.

## 6. Instancing bricks — `instancing` family

Layouts: `cloner-linear` · `cloner-radial` · `cloner-grid` · **`cloner-scatter`** ·
**`cloner-surface`** — the last two are the ones that are not lattices (D-113).

Effectors: `eff-step` · `eff-random` · `eff-wave` · `eff-delay` (reads a stem's timeline at
`t − i·delay`, so the array is a physical waveform of the recent past) · **`eff-flow`** (curl noise) ·
**`eff-palette-ramp`** (the one effector writing absolute colour rather than a weighted delta).

Not available on the `points` or `lines` backends: cloning draws an `InstancedMesh`, and both of
those already carry their own multiplicity — point count, and strand count.

Every clone carries U/V/W in 0–1 so effectors can assign per-clone values.
**Effector parameters are ordinary modulation targets** — that is what makes
"guns drives a cascading rotation offset across 8 clones" free rather than a feature.

## 7. Light bricks

`light-ambient` · `light-directional` (castShadow) · `light-point` (distance, decay) ·
`light-spot` (angle, penumbra) · `light-hemisphere` (skyColor, groundColor)

Helpers: `helper-grid` · `helper-transform` (translate/rotate/scale gizmos)

> Behaviour beyond raw Three.js parameters is unspecified — see Q2.

## 7b. The 1-bit family — `Texture` group (D-121)

`post-dither` · `post-halftone` · `post-ascii`. The three effects that **reduce** the frame instead
of smoothing it, and the only additions to this catalogue that are a different *kind* of image rather
than another glow. All three sample away from their own pixel, so all three are `standalone`.

## 8. Post-process bricks

`post-bloom` (intensity, luminanceThreshold, luminanceSmoothing) ·
`post-chromatic` (offset) · `post-glitch` (delay, duration) ·
`post-kaleidoscope` (2–32 segments, 4 mirror types, recursion 1–5, mandala mode) ·
`post-feedback` (frame-buffer ping-pong trails) · `post-tone-mapping`

## 9. Fields — the unified signal type

Every signal is a Field (HC-5, Principle 12). They differ only in update rate, and any
Field can modulate any brick parameter.

| Category | Keys | Source |
|---|---|---|
| Loudness | `rms`, `peak`, `crest` | feature timeline |
| Bands | `band-sub`, `band-bass`, `band-low-mid`, `band-mid`, `band-upper-mid`, `band-presence`, `band-brilliance` | feature timeline |
| Transient | `onset`, `attack-phase`, `envelope` | feature timeline / event |
| Spectral | `spectral-centroid`, `spectral-tilt`, `spectral-flux` | feature timeline |
| Rhythm | `beat-phase`, `bar-phase` | derived from beat grid |
| **Narrative** | `is-buildup`, `drop-decay`, `section-intensity` | derived from markers + memory — see §4.5 |
| Generative | `simplex-noise`, `lfo-sine`, `lfo-tri`, `random-walk` | evaluated from `clock.time` |
| **Object** | any evaluated `ParamAddress` | the modulation graph itself (call-and-response) |

> Generative fields must be **pure functions of `clock.time`**, never accumulators driven
> by frame delta. An accumulator cannot be evaluated at an arbitrary `t`, which breaks
> scrubbing and export (HC-2, HC-3).

## 10. Recipes

A Recipe is a named, saved, **fully editable** combination of bricks. Opening one shows
its real graph. There are no black boxes.

| Recipe | Composition |
|---|---|
| Clay Metaball Pulse | `sdf-sphere` ×N + `sdf-smooth-min`, `k` ← `band-sub` |
| Radial Kaleidoscope Mandala | `proc-torus-knot` + `cloner-radial` + `post-kaleidoscope` (8 segments, mandala) |
| Cyberpunk Perspective Grid | `geo-plane` + `def-perlin-wave` + `post-bloom` |
| Cascading Gun Wall | `proc-cube` + `cloner-linear` + `eff-step`, rotation ← `guns:onset` |
