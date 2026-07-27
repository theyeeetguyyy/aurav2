# 06 — Roadmap

**The only place phase status is tracked.** Do not restate status in other documents.

> **Renumbered 2026-07-27.** The audit found that several foundational systems
> (time authority, parameter registry, scene store, platform adapter) were assumed by
> later phases but never scheduled — Phase 3 would have had to invent all of them
> ad hoc. They are now an explicit phase. Old numbering is mapped at the bottom.

Rule: every sub-phase produces a working, testable build. No big-bang steps.

---

## Phase 1 — Shell & viewport ✅

| | | |
|---|---|---|
| 1A | Vite + React 19 + TS scaffold | ✅ |
| 1B | Tailwind v4 `@theme` tokens | ✅ |
| 1C | Zustand stores + type system | ✅ |
| 1D | DaVinci workspace shell, 5 pages | ✅ |
| 1E | R3F canvas, scene camera, lighting, grid | ✅ |
| 1F | Preview camera, WASD fly | ✅ |
| 1G | Remappable shortcuts + settings modal | ✅ |
| **1H** | **Audit remediation** — true dual camera (HC-10), modifier-aware shortcuts, input guards, immersive-view state restore, design-token compliance | ✅ 2026-07-27 |

## Phase 2 — Audio engine

| | | |
|---|---|---|
| 2A | `MultiTrackRack` — decode, sync, seek, loop | ✅ |
| 2B | Stem rack UI — waveforms, import, drag-drop | ✅ |
| 2C | Solo/mute with visual isolation | ✅ |
| 2D | Trim handles, trim-aware playback | ✅ |
| 2E | Live analysis → `AudioDataBus` | ✅ |
| **2F** | **Audit remediation** — pre-fader tap (HC-11), correct spectral-centroid scaling, power/dB band normalisation, bus aliasing fix, transport clock off React (HC-1) | ✅ 2026-07-27 |
| **2G** | **Feature timelines** (HC-3) — essentia.js worker, offline MIR on import, `AudioFeatures.sample(track, metric, t)`, BPM + beat grid + onsets, analysis cache | ⬜ next |

**2G test:** import a stem → progress → BPM shown, beat grid overlays the waveform, onsets marked. `AudioFeatures.sample()` returns identical values for the same `t` on every call, whether playing, paused, or scrubbing.

## Phase 3 — Engine foundations

> Nothing downstream is buildable without these. Small, unglamorous, load-bearing.

| | | |
|---|---|---|
| 3A | **Time authority** (HC-2) — `Clock` interface, `SteppedClock` / `FrameClock`, `TransportClock` singleton with throttled store mirror | ✅ |
| 3B | **Parameter registry** (HC-5) — `ParamAddress`, `ParamDescriptor`, `FieldRef`, transform/material descriptors, address resolution, exposed-param filtering | ✅ |
| 3C | **`useSceneStore`** — the SceneObject layer stack; add / remove / duplicate / reorder / rename / select / lock / hide, param writes by address | ✅ |
| 3D | **Persistent scene** (HC-9) — one engine-owned `SceneGraph` + one shell-level canvas; pages contribute overlays | ⬜ |
| 3E | **Platform adapter** (§1) — interface + web implementation; move all file I/O behind it | ⬜ |
| 3F | **Command history** — `{do, undo}` pairs, coalescing, `Ctrl+Z`/`Ctrl+Y` | ⬜ |

**3D test:** switch tabs repeatedly → WebGL context count stays at 1, GPU memory flat.
**3F test:** add and undo 50 operations; a slider drag is one undo step, not two hundred.

## Phase 4 — Scene objects & render backends

| | | |
|---|---|---|
| 4A | Layer stack UI — Figma/Blender outliner with visibility, lock, reorder, rename, duplicate | ✅ |
| 4B | `GeometryBrick` interface + `BrickRegistry` with geometry caching (HC-4) | ✅ |
| 4C | `mesh/procedural` — shared-topology icosphere factory, 6 shapes, **invariant test** | ✅ |
| 4D | `mesh/primitive` — 10 native Three geometries, swap-only | ✅ |
| 4E | Inspector — fully descriptor-driven, `ScrubField` with pointer lock | ✅ |
| 4F | Morph engine — vertex lerp within the procedural family | ⬜ next |
| 4G | Deformers — explode, gun-stretch, perlin wave, twist/pulse | ⬜ |
| 4H | Cloner + Effectors — linear/radial/grid, Step/Delay/Random | ⬜ |
| 4I | Post-processing — bloom, tone mapping, chromatic aberration, glitch | ⬜ |
| 4J | `mesh/imported` — GLTF loading, swap-only | ⬜ |
| 4K | `sdf` backend — Shader Park / LYGIA raymarch, `smooth-min` morphing | ⬜ |

**4C test:** ✅ passing — `proceduralMesh.test.ts` asserts every procedural brick builds exactly `BASE_VERTEX_COUNT` (642) vertices at default *and* extreme parameters, that all share one morph group, that `baseDirection` stays unit-length, and that no primitive ever claims morph compatibility.

> This test earned its keep immediately: it caught that Three.js `PolyhedronGeometry`
> subdivides each face into `(detail+1)²` triangles, not `4^detail` as the original plan
> assumed, and that `mergeVertices()` refuses to weld across a UV seam. The base mesh was
> silently producing 183 vertices instead of 642 — which would have surfaced as corrupted
> morphing in Phase 4F, far from the cause.

**4F test:** sphere → torus morphs without self-intersection; a cross-family transition presents as a crossfade and is labelled as such.
**4K test:** `sdf` and `mesh` objects coexist in one scene so the two looks can be judged side by side.

## Phase 5 — Modulation ⬜

| | | |
|---|---|---|
| 5A | `ModulationMatrix` + `SignalShaper` — Gain→Rise/Fall→Min/Max→Weight, envelope reset on clock jump | ⬜ |
| 5B | Stacked list UI (the default view — Principle 2) | ⬜ |
| 5C | React Flow node graph (advanced toggle), typed connections | ⬜ |
| 5D | Discrete event triggers — interval-queried, clock-driven | ⬜ |
| 5E | Object-to-object routing + dependency ordering with cycle detection (§4.5) | ⬜ |
| 5F | Automation lane visualisation | ⬜ |

**5 test:** wire drums-RMS → sphere scale at 50% + guns-onset → explode. Play → continuous scaling plus discrete bursts on hits. Scrub backwards → identical values. Zero React re-renders in the profiler during playback.

## Phase 6 — Timeline & states ⬜

| | | |
|---|---|---|
| 6A | State library + Strip references (HC-7), per-state connection activation (HC-8) | ⬜ |
| 6B | NLE timeline canvas — tracks, playhead, zoom, pan | ⬜ |
| 6C | Section markers + **section-aware intensity engine** (restored from v1) | ⬜ |
| 6D | Beat-grid snap + grid confirmation step | ⬜ |
| 6E | Transitions — cut / crossfade / morph on overlap | ⬜ |
| 6F | Camera track lane on the timeline | ⬜ |

**6 test:** one state placed three times, edited once → all three update. Overlap two strips → crossfade. Drop a `drop` marker → intensity multiplier visibly rises.

## Phase 7 — Camera ⬜

| | | |
|---|---|---|
| 7A | Catmull-Rom spline + draggable 3D waypoint gizmo | ⬜ |
| 7B | F-curve easing editor with tangent handles | ⬜ |
| 7C | Constraints — Follow Path, Look-At, Child-Of with blendable influence | ⬜ |
| 7D | Procedural noise/shake, amplitude as a modulation target | ⬜ |
| 7E | Motion trail with speed-indicating dot spacing | ⬜ |
| 7F | Saveable camera-move presets | ⬜ |

**7 test:** Look-At tracks a moving shape with no roll. Follow Path travels the spline. Easing change is visible in motion. Trail dots bunch on slow sections.

## Phase 8 — Export & project ⬜

| | | |
|---|---|---|
| 8A | `FrameRenderer` — worker + OffscreenCanvas + `FrameClock` | ⬜ |
| 8B | WebCodecs encoder + `mp4-muxer` | ⬜ |
| 8C | Horizontal + vertical from one pass | ⬜ |
| 8D | Batch queue (capability-gated) | ⬜ |
| 8E | `.aura.json` save/load with feature-timeline cache | ⬜ |
| 8F | `.aura-rig.json` portable rigs (needs Q10) | ⬜ |
| 8G | Autosave | ⬜ |

**8 test:** export 1080p → frame count equals `duration × fps`, plays in VLC, audio-synced. **Render the same project twice → byte-identical output.** Save, reload → identical project.

## Phase 9 — Bricks & polish ⬜

| | | |
|---|---|---|
| 9A | Mine `legacy/aura-v1` for bricks (see below) | ⬜ |
| 9B | Recipe library built from those bricks | ⬜ |
| 9C | Performance audit | ⬜ |

### Mining the v1 codebase

Per the 2026-07-27 decision, the 24 v1 modes are **not ported as modes** — a ported
monolithic mode is a black box, and black boxes are what Principle 12 exists to prevent.
Extract the maths, discard the packaging:

| Source | Extract |
|---|---|
| `js/markers.js` | Section-aware intensity engine → Phase 6C |
| `js/engine/keyframeEngine.js` | Easing set + Catmull-Rom interpolation → Phase 7B |
| `js/engine/mathLib.js` | Noise, easing, interpolation helpers |
| `js/engine/colorLib.js` | HSL / gradient / palette utilities |
| `js/modes/geometryShapes2.js` (1215 ln) | Deformer and geometry maths |
| `js/modes/hyperforge3.js` (918 ln) | Geometry generation |
| `js/modes/titanforge.js` (801 ln) | Geometry generation |
| `js/modes/gpgpuParticles.js` | GPU particle technique → `points` backend |
| `js/modes/kaleidoscope.js`, `shaderTunnel.js`, `neonPlasma.js` | GLSL worth adapting as post-process bricks |
| `js/project/` | Schema and serialisation approach |

**Performance audit checklist:** 60fps with 4 stems + modulation + post-processing ·
zero React re-renders from audio (profiler-verified) · GPU resource count stable across
50 tab switches · timeline smooth with 10+ strips · deterministic export verified by
double render.

---

## Numbering map (old → new)

| Old | New |
|---|---|
| 2F essentia pre-analysis | **2G** feature timelines (scope expanded per HC-3) |
| 3A–3F shapes | **4A–4J** (backends added) |
| 4A–4E modulation | **5A–5F** (object-to-object added) |
| 5A–5F timeline | **6A–6F** |
| 6A–6D camera | **7A–7F** |
| 7A–7C export/project/undo | **8A–8G**; undo moved earlier to **3F** |
| 7D–7E mode migration | **9A** brick mining — scope changed from port to mine |
| — | **Phase 3** engine foundations — new, was never scheduled |
