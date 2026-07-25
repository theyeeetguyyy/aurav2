# 🧱 AURA STUDIO v2 — LEGO BRICK REGISTRY & TECH STACK LIBRARIES

> **Core Philosophy**: AURA Studio v2 is NOT a visualizer preset player. It is a professional creative tool built on **atomic Lego Bricks** powered by industry-standard open-source WebGL/Three.js libraries.

---

## 1. EXTERNAL ENGINE LIBRARIES & DEPENDENCIES

| Domain | Library / Package | Role & Function in Engine |
|---|---|---|
| **SDF / Raymarching Shaders** | **LYGIA** (`patriciogonzalezvivo/lygia`) + **`hg_sdf`** | Granular shader function library (`math/`, `space/`, `color/`, `generative/`, `sdf/`, `lighting/`, `distort/`). GLSL/WGSL compatible. Used by Synesthesia. |
| **JS SDF Authoring API** | **Shader Park** (`shader-park-core`) | JS-level API wrapping SDF composition (`sphere`, `box`, `union`, `blend`, `mirrorX`, `displace`). |
| **Post-Processing Pipeline** | **`@react-three/postprocessing`** + **`pmndrs/postprocessing`** | Production R3F post-processing pipeline (Selective Bloom, Chromatic Aberration, Glitch, Tone Mapping). |
| **Feedback Loop Pass** | **`react-three-shader-passes`** | R3F-native shader pass chaining & frame-buffer texture ping-ponging for optical feedback trails. |
| **GPGPU Particles** | Three.js **`GPUComputationRenderer`** + **`three.quarks`** | GPU texture-driven particle physics scaling past 100k+ particles. |
| **CPU Noise & Math** | **`simplex-noise`** (npm) | High-performance 2D/3D/4D Simplex noise evaluation on JS/CPU side. |
| **GPU Noise** | **`glsl-noise`** / Lygia `generative/` | In-shader Perlin & Simplex FBM noise routines. |
| **Node Graph UI** | **`@xyflow/react`** (React Flow) | Node graph routing canvas for the `routing` workspace page. |
| **Audio Feature Extraction** | **`essentia.js`** + **`meyda`** | Real-time Web Audio analysis (Meyda) & offline MIR feature extraction (Essentia). |
| **Video Exporter** | WebCodecs `VideoEncoder` + **`mp4-muxer`** / **`webm-muxer`** | Hardware-accelerated 1080p/4K MP4 video rendering in browser. |
| **State Undo/Redo** | **`zundo`** (Zustand Temporal Middleware) | Time-travel state management with `partialize` filtering to exclude WebGL/Audio refs. |
| **3D Camera Paths** | Three.js **`CatmullRomCurve3`** | Native 3D spline curve interpolation for camera paths (zero external dependency). |

---

## 2. THREE.JS NATIVE GEOMETRY BRICKS

Built-in Three.js geometry classes used as atomic mesh primitives:

| Brick ID | Three.js Class | Default Parameters |
|---|---|---|
| `geo-box` | `THREE.BoxGeometry` | `width`, `height`, `depth`, `widthSegments`, `heightSegments`, `depthSegments` |
| `geo-sphere` | `THREE.SphereGeometry` / `IcosahedronGeometry` | `radius`, `detail` (0–5) |
| `geo-dodecahedron` | `THREE.DodecahedronGeometry` | `radius`, `detail` |
| `geo-octahedron` | `THREE.OctahedronGeometry` | `radius`, `detail` |
| `geo-tetrahedron` | `THREE.TetrahedronGeometry` | `radius`, `detail` |
| `geo-cylinder` | `THREE.CylinderGeometry` | `radiusTop`, `radiusBottom`, `height`, `radialSegments`, `heightSegments`, `openEnded` |
| `geo-cone` | `THREE.ConeGeometry` | `radius`, `height`, `radialSegments` |
| `geo-torus` | `THREE.TorusGeometry` | `radius`, `tube`, `radialSegments`, `tubularSegments` |
| `geo-torus-knot` | `THREE.TorusKnotGeometry` | `radius`, `tube`, `tubularSegments`, `radialSegments`, `p`, `q` |
| `geo-plane` | `THREE.PlaneGeometry` | `width`, `height`, `widthSegments`, `heightSegments` |
| `geo-ring` | `THREE.RingGeometry` | `innerRadius`, `outerRadius`, `thetaSegments` |
| `geo-lathe` | `THREE.LatheGeometry` | `points`, `segments`, `phiStart`, `phiLength` |
| `geo-extrude` | `THREE.ExtrudeGeometry` | `shapes`, `depth`, `bevelEnabled`, `bevelSegments` |
| `geo-gltf` | `GLTFLoader` | `url` (Custom 3D mesh import) |

---

## 3. SHADER PARK & LYGIA SDF RAYMARCH COMBINATORS

Continuous volume raymarching and metaball sculpting primitives based on Shader Park & `hg_sdf` operators:

### Distance Functions (Primitives)
- `sdf-sphere`: `length(p) - radius`
- `sdf-box`: `length(max(abs(p) - b, 0.0))`
- `sdf-torus`: `length(vec2(length(p.xz) - t.x, p.y)) - t.y`
- `sdf-cylinder`: `length(p.xz) - h.x`
- `sdf-capsule`: Distance to 3D line segment

### Composition Operators (Combinators)
- `sdf-union`: `min(d1, d2)` — Boolean OR
- `sdf-subtract`: `max(d1, -d2)` — Boolean difference
- `sdf-intersect`: `max(d1, d2)` — Boolean AND
- **`sdf-smooth-min(d1, d2, k)` (Smooth Blend / Clay Union)**:
  - Blend formula: `max(k - abs(d1 - d2), 0.0) / k`
  - Allows 3D shapes to melt into each other like clay. Parameter `k` is modulated by audio Fields for organic pulsing.

### Space Modifiers (LYGIA `space/`)
- `sdf-mirror`: `abs(p)` across X/Y/Z
- `sdf-rotate`: `mat2` rotation in 3D planes
- `sdf-repeat`: `mod(p + 0.5 * spacing, spacing) - 0.5 * spacing` (Infinite 3D repetition)
- `sdf-shell`: `abs(d) - thickness` (Hollow surface shell)

---

## 4. UNIFIED FIELD SIGNAL SYSTEM (EURORACK CV MODEL)

All signals in AURA Studio are unified **Fields** differing only in update rate. Any Field can modulate ANY Brick parameter in the Modulation Matrix (`routing` tab):

| Signal Category | Field Keys | Update Rate | Description |
|---|---|---|---|
| **Audio Loudness** | `rms`, `peak`, `loudness`, `crest-factor` | 60 FPS (`AudioDataBus`) | Track volume, peak amplitude, punchiness ratio. |
| **Stem Frequency** | `band-sub`, `band-bass`, `band-low-mid`, `band-mid`, `band-upper-mid`, `band-presence`, `band-brilliance` | 60 FPS (`AudioDataBus`) | 7-band frequency energy breakdown (~20Hz–20kHz). |
| **Audio Transients** | `onset`, `attack-phase`, `envelope` | Event / 60 FPS | Transient attack spikes & ADSR-style envelope follower. |
| **Spectral Motion** | `spectral-centroid`, `spectral-tilt`, `spectral-flux` | 60 FPS (`AudioDataBus`) | Brightness center of mass, spectral slope, rate of spectral change. |
| **Rhythm & Tension** | `beat-phase`, `bar-phase`, `wobble-lfo`, `drop-decay`, `is-buildup` | 60 FPS / Event | Beat grid phase (0–1), 4-beat bar phase, dubstep LFO speed, drop tension decay. |
| **Generative Fields** | `simplex-noise-field`, `lfo-sine`, `random-walk` | 60 FPS | Generative noise (`simplex-noise`) & LFO oscillators. |

---

## 5. THREE.JS LIGHTING & HELPER BRICKS

| Brick ID | Three.js Class | Default Parameters |
|---|---|---|
| `light-ambient` | `THREE.AmbientLight` | `color`, `intensity` |
| `light-directional` | `THREE.DirectionalLight` | `color`, `intensity`, `position`, `castShadow` |
| `light-point` | `THREE.PointLight` | `color`, `intensity`, `distance`, `decay` |
| `light-spot` | `THREE.SpotLight` | `color`, `intensity`, `distance`, `angle`, `penumbra` |
| `light-hemisphere` | `THREE.HemisphereLight` | `skyColor`, `groundColor`, `intensity` |
| `helper-grid` | `THREE.GridHelper` / Drei `<Grid>` | `size`, `divisions`, `cellColor`, `sectionColor`, `fadeDistance` |
| `helper-transform` | `TransformControls` | Gizmos for translation, rotation, and scaling |

---

## 6. POST-PROCESSING FX BRICKS (`@react-three/postprocessing`)

- `post-bloom`: `@react-three/postprocessing` `<Bloom>` (`intensity`, `luminanceThreshold`, `luminanceSmoothing`).
- `post-kaleidoscope`: Custom Glsl `ShaderPass` using LYGIA GLSL (2–32 segments, 4 mirror types, recursion 1–5, mandala mode).
- `post-chromatic`: `<ChromaticAberration>` (`offset`).
- `post-glitch`: `<Glitch>` (`delay`, `duration`).
- `post-feedback`: `react-three-shader-passes` optical frame-buffer feedback loop.

---

## 7. RECIPES LAYER (BLENDER GEOMETRY NODES MODEL)

> Presets are NOT locked black boxes. A "Recipe" is simply a named, saved, editable/remixable combination of generic Bricks.

- **Clay Metaball Pulse**: `geo-sphere` + `sdf-smooth-min` (blend factor driven by `band-sub` Field).
- **Radial Kaleidoscope Mandala**: `geo-torus-knot` + `cloner-radial` + `post-kaleidoscope` (segments=8, mandala=true).
- **Cyberpunk Perspective Grid**: `geo-plane` + `deformer-waveform` + `post-bloom`.
