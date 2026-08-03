# 04 — Engine Specs

Per-module specifications. Read [03-ARCHITECTURE.md](03-ARCHITECTURE.md) first — the
hard constraints referenced here (HC-n) are binding.

---

## 4.1 Audio engine

**Capacity.** Unlimited discrete stems. Trap-beat vocabulary is the reference case:
`Drums`, `Hats`, `Guns`, `Fakeout`, `Sub`, `Atmosphere`, `Extra Gun Layers`.

**Editing.** Trim, cut, move, align, mute, solo — FL Studio rack ergonomics.

**Sync.** All `AudioBufferSourceNode`s anchored to one master clock (HC-2). Seek, pause,
and resume are computed from `AudioContext.currentTime` deltas, never from wall clock.

**Signal path per track:**

```
BufferSource ──┬── analysisTap (pre-fader)      ← HC-11
               └── gainNode (volume/solo/mute) ── masterGain ── destination
```

**Solo semantics.** Solo isolates *both* audio and visual modulation. Audio isolation is
gain-based. Visual isolation is `isTrackVisuallyActive(id)`, consumed by the modulation
matrix. Volume and mute must **not** affect visuals (HC-11).

### Feature extraction (HC-3)

Two tiers, deliberately:

| Tier | Implementation | When | Output |
|---|---|---|---|
| Offline MIR | `analysis.worker.ts` — own radix-2 FFT (D-32) | once on import | 13 metric timelines + onsets + BPM + beat grid |
| Live | Meyda → `AudioDataBus` | retained for future mic input only | current-frame values |

> **Modulation reads the offline tier, never the live one.** `AudioDataBus` still exists
> and still works, but nothing in the modulation path consumes it. That is deliberate:
> a live analyser cannot answer "what was the RMS at frame 5000" (HC-3).

**Metrics per track**, normalised 0–1, sampled at `FEATURE_RATE` = 200 Hz:

`rms` · `peak` · `envelope` (fast attack / slow release) · `onset` (decaying impulse) ·
`spectral-centroid` · `spectral-flux` · seven bands: `sub` (20–60 Hz), `bass` (60–250),
`low-mid` (250–500), `mid` (500–2k), `upper-mid` (2k–4k), `presence` (4k–6k),
`brilliance` (6k–20k).

Plus `onsetTimes[]` (discrete), `bpm` (nullable), `beatGrid[]`.

> **Band normalisation is not optional, and only works offline.** Naively averaging
> linear FFT magnitudes across bands is wrong: `sub` spans ~1 bin, `brilliance` spans
> ~150. The result is a sub band pinned high and a brilliance band pinned at zero — the
> failure mode reads to a user as *"nothing reacts to my hats."*
>
> Implemented as: sum **power**, take the per-bin mean, then scale each metric against
> the **98th percentile of its own distribution across the whole file**. Percentile
> rather than max, so one clipped transient cannot squash the rest of the track into the
> bottom of the range. Seeing every frame before deciding the scale is precisely what a
> live analyser cannot do.

**Tempo** comes from a histogram of inter-onset intervals, folded into 60–180 BPM by
octave doubling/halving so a kick pattern and its double-time hats reinforce rather than
split the histogram. Returns `null` below 6 agreeing intervals — reporting a
confident-looking wrong tempo is worse than reporting none, because the whole beat grid
would be built on it.

**Derived rhythm fields** (from beat grid): `beat-phase` (0–1 within a beat) ✅,
`bar-phase` (0–1 within 4 beats) ✅. Narrative fields `is-buildup` and `drop-decay`
are Phase 6C. All are Fields like any other (HC-5).

---

## 4.2 Modulation matrix

The architectural core of the product.

**Continuous.** Per connection, in order (Principle 8):

```
Gain → Rise/Fall (attack/release smoothing) → Min/Max (range clamp) → Weight
```

Final value for a parameter, evaluated per frame:

```
final = base + Σᵢ weightᵢ · shapedᵢ(field(sourceᵢ, clock.time))
```

`shaped()` is stateful (the Rise/Fall envelope has memory), so **it must be reset when
the clock jumps** — on seek, on loop wrap, and at the start of an export. Otherwise a
scrub leaves stale envelope state and preview diverges from export, violating HC-3's
guarantee.

**Discrete events.** An `EventTrigger` adds `amount` to any `ParamAddress`, decaying
with time constant `decay`. Generic by design (D-30) — enumerating fixed actions
(`explode`, `color-flash`, …) repeats the mistake the closed `TargetParam` union made.
"Explode" is an impulse into a deformer's strength; "flash" is an impulse into emissive
intensity.

Evaluated as a **pure function of time**: the value derives from the age of the most
recent onset at or before `t` (`AudioFeatures.lastOnsetAtOrBefore`, binary search), never
accumulated frame to frame. The exporter steps frames at irregular wall-clock intervals
and may render out of order, so anything fired from a tick or a callback would diverge.

**Weighted N:1.** Multiple sources summing into one parameter is the headline feature
(*"50% guns + 25% drums + 25% atmosphere"*). Sum, then clamp to the descriptor's range.

**Automation lanes** (Principle 10). Because features are timelines and shaping is
deterministic, the full modulation curve for any parameter over the whole song can be
evaluated ahead of playback and drawn. This is only possible because of HC-3.

**Sidechain / cross-track** (v2): one track's signal driven through another's envelope
settings. The architecture already permits it — `sourceTrackId` and the envelope config
are independent fields.

---

## 4.3 Scene objects & render backends

One open layer stack (Figma/Blender outliner model), not fixed shape slots.

```ts
type SceneObjectType = 'shape' | 'light' | 'particleEmitter' | 'backgroundElement' | 'image'
```

Every object carries `transform` (position/rotation/scale — the explicit original
requirement that *everything* has transform and rotation), a `backend` (HC-4), an
ordered `effects[]` stack, and `visible`/`locked`/`order`.

### Effect families

| Family | Runs on | Examples |
|---|---|---|
| `geometry` | vertices / SDF field | explode, gun-stretch, perlin-wave, twist, pulse |
| `instancing` | object count | cloner (linear/radial/grid), Step/Delay/Random effectors |
| `post-process` | framebuffer | bloom, chromatic aberration, glitch, kaleidoscope, feedback |

**Deformer specs (v1):**

- **Explode & reform** — displace vertices along normals by `amount`, decay over `decayTime`. Driven by kick/snare onset as a *discrete event*, not continuous.
- **Gun stretch** — directional elongation along an axis on transient spikes.
- **Perlin wave** — noise-field vertex displacement, amplitude from `band-sub`.
- **Twist & pulse** — rotation shear + scale oscillation.

**Cloner + Effectors** (Principle 7). Cloner modes linear/radial/grid; radial exposes
radius, plane, start/end angle. Every clone carries U/V/W coordinates in 0–1 so effectors
can assign per-clone values. Step offsets a parameter sequentially across clones; Delay
adds springy staggered propagation. **Effector parameters are ordinary modulation targets**
(HC-5) — that is what makes "guns drives a cascading rotation offset" free.

### Lights (D-48)

A light is a `SceneObject` with `type: 'light'` whose `brickId` names a `LightBrick`.

| Brick | Shadows | Distinct because |
|---|---|---|
| **Point** | yes | Falls off in every direction — shapes a single object |
| **Spot** | yes | A beam with a cone; aims along the object's rotation |
| **Sun** | yes | Parallel rays; position sets direction only |
| **Area** | no | A soft panel — the most flattering light, and visible in reflections |
| **Ambient** | no | Unshaped fill; lifts blacks, creates no form |

Descriptors follow HC-5, so `intensity` is a modulation target on every light and
`position`/`rotation` come from the shared transform. Consequently:

- **Strobe is an onset trigger into `intensity`** (D-30) — no strobe type exists.
- A light describes **placement + its own knobs only**: no material, no scale, no effect
  stack. Offering roughness on a light is offering a control that does nothing.
- Shadows are **per light and off by default** — one depth pass per casting light, per
  frame. The Sun additionally exposes `shadowRadius`, because a directional shadow is an
  orthographic box and geometry outside it silently has none.
- Lights render an **authoring gizmo on `GIZMO_LAYER`**, displayed by both cameras while
  authoring and disabled on the Scene Camera by the exporter.

**Morph rules.** `morphTargets()` on each backend is authoritative. The UI must never
offer a morph the backend cannot perform; cross-family transitions present as a
crossfade, and are labelled as such.

---

## 4.4 Camera

**Dual camera** per HC-10. Scene Camera renders; Preview Camera authors. Preview has Fly
and Orbit sub-modes — Orbit is preserved from v1 because it is genuinely better for
composing a static shot.

**Keyframes** live on an independent track (Principle 6), with:

- **Easing per keyframe** — linear / smooth / bezier with tangent handles / step.
  Blender's Graph Editor is the reference. **This is v1, not polish.** Linear motion
  reads robotic; uncontrolled smoothing overshoots and drifts. Easing is the difference
  between a cinematographer and a slideshow, and it is cheap to build.
- **Extrapolation per section** — `hold` / `continue` / `none` for gaps past a strip's
  extents (Blender NLA). Default `hold`.
- **Magnetic snap** to state boundaries and to the beat grid, both toggleable.

**Constraints** (declarative behaviour layer, Principle 1):

- **Follow Path** — parent to a Catmull-Rom spline; auto-travel replaces hand-keyframing every waypoint.
- **Look-At / Damped Track** — face a target with minimal roll. Toggle instead of keyframing rotation.
- **Child-Of with animated influence** — blend between two constraints to hand off tracking from Shape A to Shape B without a snap.

Each constraint has an `influence` 0–1 which is itself a modulation target.

**Procedural noise** — Cinemachine-style handheld shake layered *on top* of keyframes.
Amplitude and frequency are modulation targets, so shake can rise with the drop.

**Motion trail** — dotted path along the trajectory; dot spacing communicates speed at a
glance (bunched = slow, spread = fast). Blender's pattern; directly useful on the spline
gizmo.

**Saveable camera moves** — a keyframed move ("Slow Orbit", "Push-In", "Crane") saved
independently and applied anywhere. Solves the repetition problem without nesting the
camera inside states.

---

## 4.5 Timeline, states & musical narrative

**State = Blender Action.** Named, reusable, edit-once-updates-everywhere. Holds scene
objects, active connections, per-state overrides, post-processing, camera snapshot.

**Strip = reference** (HC-7). Strips carry `startTime`, `duration`, `lane`, and a
`transition` (cut / crossfade / morph) with its own duration and easing.

**Transitions.** Overlapping strips crossfade. Where both states' objects share a
backend and a morph target, the crossfade becomes a real morph.

**Section markers.** `intro` · `build-up` · `fakeout` · `drop` · `fill` · `breakdown` ·
`verse` · `chorus` · `bridge` · `outro`. Placed at the playhead with `M`.

> **The engine is section-aware.** Section type drives an intensity multiplier consumed
> by deformers, shake, flash, and bloom. This was fully implemented in v1
> (`legacy/aura-v1/js/markers.js`) and was dropped from the v2 design by accident. It is
> restored here because it is the concrete mechanism behind the product's stated
> purpose — see below.

**Snap to beat grid.** Derived from detected BPM. Strips, keyframes, markers, and
triggers all snap to musical subdivisions (1/4, 1/8, 1/16). Offer a "does the detected
grid line up with the waveform?" confirmation step on import, before the user builds a
whole project against a misaligned grid.

### Story, tension, call-and-response

The original brief: *"musicians show story, tensions, calls and responses, ups and downs
through music… they should also be able to simulate them in the visuals."* This sat as an
open philosophical question through every previous doc. It is not one feature, and it is
not purely emergent either. Three concrete mechanisms deliver it:

1. **Section awareness** (above) gives visuals a sense of *where in the song we are*, not
   just what the current frame sounds like. This is what makes a build-up feel like a
   build-up.
2. **Persistent musical state** — `drop-decay` and `is-buildup` are Fields with memory
   that accumulate over bars, so tension can visibly build over eight bars and release.
   Frame-local metrics like RMS structurally cannot express this.
3. **Object-to-object routing** — a Field may source from *another object's evaluated
   parameter*, so Shape B can answer Shape A. Combined with per-track routing, "the
   guns answer the drums" becomes a two-connection patch rather than a special feature.

Mechanism 3 requires that the modulation graph be evaluated in dependency order with
cycle detection. Design for it now; it is nearly free at graph-build time and expensive
to add later.

---

## 4.6 Export

Frame-accurate offline rendering. **Not** screen capture.

```
FrameClock steps → engine evaluates at t → render to OffscreenCanvas
  → VideoFrame(timestamp = frameIndex * 1e6 / fps) → VideoEncoder → mp4-muxer
  → encoder.flush() → muxer.finalize() → bytes → PlatformAdapter.writeVideo()
```

- Runs in a worker with `OffscreenCanvas` — avoids UI freeze and tab throttling.
- Timestamps are **manual and integer-derived**, never wall clock.
- Keyframe every 60–120 encoded frames for seekability.
- `flush()` before `finalize()`, always. Skipping it produces an unplayable file.
- Faster than real time. It is a render, not a recording.

**Horizontal + vertical from one pass** — render the scene once at the larger frame and
derive both crops, or run two encoders off one scene evaluation. Required by the primary
audience (YouTube + Shorts). Must be designed in, not bolted on.

**Batch queue** — gated on `PlatformAdapter.supportsBatchQueue`. Real on desktop,
degraded in a browser tab.

---

## 4.7 Project & rig files

**`.aura.json`** — states, strips, markers, scene objects, modulation graph, camera data,
settings. Stems are **referenced, never embedded**. Feature timelines are cached
alongside so reopening does not re-analyse.

**`.aura-rig.json`** — a reusable unit *smaller than a project*: scene + routing table +
camera path + palette, with no audio. This is the "one visual system, many beats" unit
that the primary audience actually wants, and the seed of a preset economy. **Design the
format for portability from day one** — a rig referencing absolute object IDs from the
project it was born in is worthless.

**Undo/redo** — command pattern, `{do, undo}` pairs. Slider drags coalesce into one
command on release, not one per intermediate value.

**Autosave** — v1 had it (`legacy/aura-v1/js/project/autosave.js`). Carry it forward.

---

## 4.8 Extensibility

Every extension point is the same shape: **a module that declares its parameter
descriptors and implements a lifecycle**.

```ts
export interface BrickModule<P = Record<string, unknown>> {
  readonly id: string
  readonly family: EffectFamily
  readonly descriptors: ParamDescriptor[]
  create(ctx: BrickContext): BrickHandle<P>
  update(handle: BrickHandle<P>, params: P, clock: Clock): void
  dispose(handle: BrickHandle<P>): void
}
```

Backends, deformers, effectors, and post-process effects all implement variants of this.
Registration is data — a new brick is added to a registry, never to a `switch` statement
in core engine code. This is the concrete answer to *"code in such a way that as new
components are added, they can work together."*
