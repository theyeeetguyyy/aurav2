# 16 — Library Assessment

> What to buy instead of build, and — more usefully — **what looks buyable and is not**.
> Researched 2026-08-04.

The default should be to reuse. AURA has three properties that make some otherwise
excellent libraries unusable, and they are the reason each rejection below is a
*constraint*, not a preference:

1. **HC-2 — one time authority.** A library that owns its own playhead is a second clock.
2. **HC-3 — everything is a pure function of `t`.** The exporter renders frames out of
   order and faster than real time. Anything that integrates state frame-by-frame cannot
   be exported.
3. **05-DESIGN-SYSTEM §2 — docked, non-overlapping UI.** A library that ships a floating
   editor overlay cannot live in the shell.

---

## Adopt

### `camera-controls` (via `@react-three/drei`) — **adopted**

Already in the dependency tree; drei re-exports it as `<CameraControls>`. **Zero new
dependency.**

A strict upgrade over `OrbitControls` for the *preview* camera:

| Gives us | Serves |
|---|---|
| `fitToSphere` / `fitToBox` | "Frame the selected object" — currently impossible |
| `setLookAt(…, enableTransition)` | Smooth "go to Scene Camera", not a snap |
| Damping with `rest` / `sleep` events | Knowing when a move has settled |
| Truck / dolly / pedestal as first-class actions | Real camera vocabulary instead of orbit-only |
| `saveState` / `reset` | Cheap view bookmarks |

**Constraint:** preview only. HC-10 says the Scene Camera is driven by the camera track
and nothing else may write to it. Mounting any interactive control on the Scene Camera
would be the exact inversion this project already fixed once (D-26).

### `troika-three-text` — **planned**, for the Text element

Parses `.ttf`/`.otf`/`.woff` directly and generates the SDF atlas on the fly in a worker —
no pre-baked atlas, no build step, any font the user drops in. That last property is what
makes it the right call for an audience whose whole point is channel identity.

Noted for later: the Slug algorithm entered the public domain in March 2026, and
`three-text` produces real geometry rather than SDF quads (sharper at extreme close-up).
Neither changes the recommendation today; both are worth revisiting if text becomes a
headline feature.

### LYGIA — **planned**, for the SDF backend (4K) and further post effects

An include-based GLSL library. Adds no runtime, only shader source, so it composes with
the hand-written effects already in `engine/post/bricks/shaders.ts` rather than replacing
them. Needs a bundler resolver plugin.

---

## Reject — with reasons worth keeping

### Theatre.js — **rejected as a dependency, adopted as a UX reference**

The closest thing on the market to Phases 6 and 7: a real sequencer with a keyframe track,
a curve editor with tangent handles, and snapping. Genuinely excellent.

It cannot be the engine here, for three reasons that are all structural:

- **It owns a playhead.** `sheet.sequence.position` is a second time authority (HC-2).
  Driving it from `TransportClock` is possible but leaves two clocks that must agree.
- **It owns the values.** Theatre's model is "keyframed props win". AURA's thesis is the
  opposite: values come from *modulation of audio*, and keyframes are the base that
  modulation offsets. Inverting that is the product.
- **Its editor is a floating overlay.** Banned by 05-DESIGN-SYSTEM §2, which exists
  because a popup over the viewport is the thing this UI is designed to never do.

**What to steal:** the sequence-editor interaction design — keyframe track ergonomics,
tangent-handle curve editing, snapping behaviour. That is the reference for 6B and 7B.

### `wavesurfer.js` — **rejected for the rack, adopted as an interaction reference**

v7 is a good TypeScript rewrite, and its Regions plugin (drag, resize, drag-to-create) is
precisely the interaction the stems page lacks.

But the rack already has a renderer that is *better suited*: two static canvases plus a
clip-path, so it never repaints during playback (HC-1). WaveSurfer repaints, and expects
to own the media element and the playhead — a second transport next to `MultiTrackRack`,
which is sample-accurate and trim-aware. Adopting it for one plugin means running two
audio engines and syncing them.

**What to steal:** the Regions interaction model for §4.3 of the build plan.

### `three.quarks`, `three-nebula` — **rejected on determinism (D-49)**

This is the finding worth writing down, because it is not obvious and someone will
otherwise reach for one of these.

Every general-purpose particle library integrates state frame by frame:

```
position += velocity * dt
velocity += force * dt
```

That is an accumulator. Under HC-3 the exporter renders frame 5000 before frame 12 and
scrubbing backwards must reproduce exactly — and an accumulator cannot. The same project
would export differently every run, which is the one guarantee this architecture exists to
provide.

**AURA's particle system must be stateless**: every particle's position is a pure function
of `(seed, birthTime, t)`. That is achievable — curl-noise advection integrated over a
fixed step count from birth, closed-form strange attractors, surface scatter with a
deterministic hash — but it rules out the libraries, all of them, and it needs designing
in rather than discovering at Phase 8.

(`three-nebula` is also unmaintained. `three.quarks` is active and simulates on the CPU,
which caps density well below the 100k the element docs assume.)

### `zundo` / store snapshotting — **already rejected** (03-ARCHITECTURE)

Undo is the command pattern. Snapshotting stores that reference `AudioBuffer`s and GPU
resources is a memory disaster.

---

## Already decided elsewhere

| Library | Where |
|---|---|
| `postprocessing` (pmndrs) | Adopted — 4I |
| `@xyflow/react` | Planned — 5C node graph |
| `mp4-muxer` + WebCodecs | Planned — 8B |
| Meyda | Live tap only; modulation reads the offline worker (HC-3) |
| essentia.js | Still an option if beat tracking needs to beat inter-onset histogramming (D-32) |

---

## Sources

- [Theatre.js](https://www.theatrejs.com/) · [sequences manual](https://www.theatrejs.com/docs/latest/manual/sequences)
- [yomotsu/camera-controls](https://github.com/yomotsu/camera-controls) · [drei CameraControls](https://drei.docs.pmnd.rs/controls/camera-controls)
- [wavesurfer.js Regions plugin](https://wavesurfer.xyz/plugins/regions) · [v7 release notes](https://github.com/katspaugh/wavesurfer.js/releases/tag/7.0.0)
- [three.quarks](https://github.com/Alchemist0823/three.quarks) · [three-nebula](https://three-nebula.org/)
- [troika-three-text](https://www.npmjs.com/package/troika-three-text) · [Slug algorithm in the public domain](https://github.com/mrdoob/three.js/issues/33215) · [countertype/three-text](https://github.com/countertype/three-text)
