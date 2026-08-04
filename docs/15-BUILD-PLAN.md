# 15 — Build Plan

> Everything currently outstanding, organised. Raised 2026-08-04 from a single review
> session; this document is the queue, [06-ROADMAP.md](06-ROADMAP.md) remains the only
> place *phase status* is tracked.

The review produced four different kinds of item, and mixing them is how a queue becomes
a wish list. They are separated here because they have different costs and different
owners:

| Kind | What it is | Rule |
|---|---|---|
| **Defect** | Something is wrong | Fix on sight, no scheduling |
| **Structure** | Something is in the wrong place | Fix before building more on top of it |
| **Craft** | Something works but is unpleasant | Batch into a dedicated pass |
| **Feature** | Something does not exist | Ranked below, by leverage |

---

## 0 · Blocking everything: nothing has been run

**No browser has been driven in this workspace.** Fifteen modules built, verified by 315
structural tests, a typechecker and a linter — and by zero pixels.

Specifically unverified: every post-processing shader (GLSL fails at runtime, not at build
time), the instanced cloner render path, the light gizmo layer, the automation lane's
pointer handling, and the entire export loop (WebCodecs, frame-capture timing, muxing).

A short smoke test surfaces almost all of it. Until it runs, every further module is built
on an assumption.

**Smoke test, in order — each step fails loudly if the one before it broke:**

1. `npm run dev`. Console clean on load?
2. Scene & Shapes → add a Sphere. It renders?
3. Look → Post → add **Bloom**. *This is the big one: a GLSL failure shows here.*
4. Add **Kaleidoscope**, then **Feedback Trails** — the two hand-written passes.
5. Inspector → material → **Fresnel Rim**, then **Gradient**. Two more custom shaders.
6. Scene → Effects → **Radial Cloner**. Select and deselect twice — clones must survive.
7. Library → Lights → **Spot**. A gizmo appears and is clickable?
8. Camera → *Align to this view* → add **Orbit**. The Scene Camera moves?
9. Media & Stems → drop stems → expand a stem's **Automation** row and reshape its curve.
10. Routing → wire the lane, and a kick onset → the Spot's Intensity.
11. Top bar → **Save**, reload, **Open** — audio should come back on its own, or in one click on **Restore**.
12. Ctrl+Z a few times.
13. Deliver → **Export MP4** at 720p/30 over a short project. Plays in VLC?

---

## 1 · Defects

| # | Symptom | Cause | State |
|---|---|---|---|
| D1 | Marketing copy in the UI ("Bloom alone changes the perceived quality…") | Doc prose pasted into an empty state | ✅ fixed |
| D2 | Four playheads in the stem rack, all at different positions | Every waveform stretched its **own** buffer duration across the full row, so a 30 s stem and a 60 s stem drew the same width, and each row drew its own playhead | ✅ fixed |
| D3 | Flying away turns everything black | `FogExp2` default density 0.008 reaches ~92 % opacity at 200 m; fog was on by default | ✅ fixed |
| D4 | Grid colour disliked, hard to switch off | Section colour was the indigo accent; the toggle existed but was buried | ✅ fixed |
| D5 | Cloned objects vanished after selecting once | Selection outline shared the `instanceMatrix` attribute; unmounting it freed the buffer the visible mesh drew from | ✅ fixed |
| D6 | Left dock panels drew over each other | `max-height` on a wrapper does not constrain a `shrink-0` child | ✅ fixed |
| D7 | **Routed range readout is wrong** — "0 → 16" and "−98 → −1°" do not match what the visual does | The readout mapped the *declared* signal range 0–1 onto the parameter, but a real stem's envelope occupies only part of 0–1. Honest about the mapping, dishonest about the outcome | 🟡 `reachableRange()` now measures the real signal; the underlying **authoring** gap remains — see §4.1 |
| D10 | **Reopened project had no audio** | `canRelinkByPath: false` was too pessimistic — a `FileSystemFileHandle` persists in IndexedDB even though a path cannot, so the stems can reopen themselves (D-56) | ✅ fixed |
| D11 | **Lights appeared to do nothing** | Three is physically correct since r165: intensity 60 with `decay: 2` at the 22-unit spawn distance arrives as 0.12. Defaults are now derived from d² (D-57) | ✅ fixed |
| D12 | **Deleting a stem orphaned its file handle** | `forgetHandle` was written and never called — dead code and a storage leak at once | ✅ fixed |
| D9 | **Routing page crashed with "Maximum update depth exceeded"** | A Zustand selector returned `s.lanes.filter(...)` — a NEW array every call, so the equality check could never pass. React re-rendered, the selector ran again, forever. Taking down the tree also destroyed the one WebGL context, which reported as `Context Lost` and hid the real cause | ✅ fixed |
| **D8** | Distant geometry pops out | Camera far plane, grid fade and fog interact; needs one coherent depth budget | ⬜ open |

**D7 is the important one** and it is not a display bug. It is the same root cause as the
"main_bass barely moves" observation: percentile normalisation makes each stem use the
full 0–1 range *across the whole file*, but within any given bar the envelope may only
span 0.3–0.6. Three fixes, in order of how much they help:

1. ✅ **Show the reachable range, not the declared one** — `reachableRange()` runs the real
   shaper over the real feature timeline and reports what the parameter actually reaches.
   Immediately honest, and it makes the *second* problem visible rather than hiding it.
2. ⬜ **Auto-gain / normalise on a connection** — "make this stem use the whole range",
   computed from its own distribution.
3. ✅ **The automation-lane editor** (§4.1) — built. Honest numbers tell you the parameter
   only moves 5 → 10; the window stretches what is there; the lane lets you say what it
   should do instead. All three shipped, and none substitutes for the others.

---

## 2 · Structure

Stated as: *"every place should feel theirs — organised is what it's called. Everything
should not be put on one single section."*

The left dock of Scene & Shapes had become the dumping ground: layer stack, shape
library, world settings and the post chain all in one 280 px column.

| # | Move | State |
|---|---|---|
| S1 | **New `Look` workspace page** — World + Lighting on the left, Post chain on the right, viewport in the middle | ✅ done |
| S2 | Scene & Shapes returns to what it is for: layer stack ∣ viewport ∣ inspector | ✅ done |
| S3 | The object stack is **Effects**, with classes under it: Deformers · Cloners · Effectors | ✅ done |
| S4 | **Lights become real `SceneObject`s** — addable, layered, deletable, each with its own transform and routable intensity. The fixed three-point rig becomes the *default* rig, not the only one | ✅ done (D-48) |
| **S5** | Routing page needs its own reorganisation — see §4.2 | ⬜ |

---

## 2b · Standing: audit built code against upstream

**Pinned for every pass.** Before extending a module, check whether a maintained library
already does it better, and whether what exists should be replaced rather than grown.
Assessments live in [16-LIBRARIES.md](16-LIBRARIES.md) — including the rejections, which
are the more useful half, because each records a constraint that would otherwise be
rediscovered.

Flagged so far, not yet actioned:

| Built | Compare against | Note |
|---|---|---|
| `OrbitControls` on the preview camera | `CameraControls` — already in the tree via drei | Gains `fitToSphere`, smooth transitions, truck/dolly. Preview only (HC-10) |
| Hand-rolled FFT in `analysis.worker.ts` | essentia.js | Only if beat tracking needs to beat inter-onset histogramming (D-32) |
| `ScrubField`, panels, buttons | Radix primitives · `react-resizable-panels` | Part of the §3 craft pass, not before |
| `WaveformCanvas` | wavesurfer.js | Rejected for the renderer; its Regions *interaction* is the reference for §4.3 |
| `MultiTrackRack` imports `useAudioStore` | — | **The one live violation of the engine boundary.** Fix is the `FieldContext` shape: pass a track snapshot into `play()` and `applySoloMuteState()` rather than reading a store. Recorded in 03-ARCHITECTURE rather than hidden |

### Standing rule from D9

**A store selector must never build a new object or array.** `s.items.filter(...)`,
`s.items.map(...)` and `({ a: s.a, b: s.b })` all allocate on every call, and every one of
them is an infinite render loop. Select the raw value; narrow it in a `useMemo` outside
the selector. Audited: one instance existed, and it is gone.

Each page and the viewport now sit behind separate error boundaries, so the next crash of
any kind shows a message in one panel instead of destroying the renderer.

## 3 · Craft

Batched deliberately rather than fixed piecemeal (02-PRINCIPLES: doing it before the
feature set stops moving means doing it twice — but the set is now large enough that the
pass is worth scheduling).

- **Controls are too small and undifferentiated.** 3×3 px icon buttons with no hit area,
  no hover affordance, no grouping. Everything is the same weight, so nothing reads as
  primary. Needs a real control vocabulary: button sizes, icon-vs-label rules, a
  consistent 24 px minimum touch target, and visual separation between destructive,
  toggle and action buttons.
- **No empty-state or first-run guidance** that is not prose.
- **Density is uniform** — the inspector treats a colour picker, a slider and an enum as
  the same visual weight.

---

## 4 · Features, ranked by leverage

### 4.1 Signal authoring — the biggest single gap

> *"the lfo of stems, it should be editable where i can draw in like in FL"*

This is the answer to D7, to "main_bass barely moves", and to *"I don't know what will
look good"*. Right now a stem's envelope is whatever the analyser produced, and the only
tools are gain and a response curve.

| Item | Why |
|---|---|
| ✅ **Per-stem automation** — the analysed curve under each stem's waveform, editable | Built (D-55). The waveform IS the time reference, which a detached lane never had |
| ✅ **Signal normalise / input window** | Built (D-51). `Normalise` measures the source's p2/p98 and stretches it to fill |
| ✅ **Reachable-range readout** | Built. `reachableRange()` measures the real signal |
| ⬜ **Curve preview against the waveform** in the stems page | The lane editor shows the curve; the waveform behind it is still to come |

### 4.2 Routing overhaul

> *"a lot lot of work needs to be done in the routing system, it's not great right now.
> Neither the UI."*

- Range readout honesty (D7)
- Per-connection normalise, invert, and a visible "what this does" preview
- Better wire legibility at 20+ connections — grouping, filtering, soloing a wire
- Object-to-object routing (5E) and the node graph (5C) still unbuilt

### 4.3 Stems page as a real editor

> *"the trim and shortener and move around like proper editor like FL and Ableton"*

- Shared timeline ruler with bars/beats, not just seconds
- Drag to move a stem in time (offset, not just trim)
- Split, duplicate, fade in/out handles
- Zoom and scroll
- The automation lanes from §4.1 live here

### 4.4 Scene structure

- **Parenting / linking objects** — *"what if we have a feature to link some shapes"*.
  Scene-graph parent-child, so a group moves together and a child inherits modulation.
  Q1 in [08-OPEN-QUESTIONS.md](08-OPEN-QUESTIONS.md) anticipated exactly this and said
  the answer is scene-graph parenting, not a shape type.
- Groups / folders in the layer stack
- Multi-select and bulk edit

### 4.5 More visual elements

> *"we need to ideate a lot lot more on crazy effects; currently we need more effects
> like explode"*

Full catalogue in [14-VISUAL-IDEAS.md](14-VISUAL-IDEAS.md). Ranked next:

1. **GPU particles** — the largest remaining density jump
2. **More deformers** — FFT/spectrum, curl noise, cull/dissolve, voronoi shatter, taper,
   spline deform, jelly/inertia
3. **Tunnel / raymarched fields** — also solves "the camera needs somewhere to go"
4. **Spectrum bars, waveform, Lissajous** — instant musical legibility
5. **Extruded 3D text** — the audience's clearest unmet need
6. **Trails / ribbons**

### 4.6 Camera

> *"the post effects look great in preview when we move around, but in scene not — I
> guess that will be when we modulate camera"*

Correct diagnosis. Feedback trails, zoom blur and kaleidoscope all key off *movement*,
and the Scene Camera currently never moves. Phase 7:

- Spline paths + waypoint gizmos
- Keyframes with easing
- Look-At / Follow-Path constraints
- **Procedural shake and orbit as modulation targets** — the cheapest way to get motion
  before keyframing exists, and it makes the whole post chain come alive
- Align-to-view ("put the Scene Camera where I am looking") — currently there is no way
  to aim the render camera at all

### 4.7 States & timeline (Phase 6)

The brief's core structural idea, still unbuilt. Needs 4.6 underneath it for the camera
track to mean anything.

### 4.8 Export (Phase 8)

The product still has no output. Unblocked by `activeClock()` (D-45); nothing else stands
in the way.

---

## 5 · Recommended order

Grouped so each block leaves the app coherent rather than half-migrated.

| Block | Contents | Why here |
|---|---|---|
| **A** ✅ | Defects D1–D6, structure S1–S3 | Nothing else should be built on a broken layout |
| **B1** ✅ | S4 lights as objects | Resolved Q2, one of the five blocking decisions in the original research checklist |
| **B2** ✅ | Camera behaviours — Orbit/Sway/Shake/Dolly/Lens + Look-At + align-to-view (D-50) | Makes the whole post chain read in the Scene Camera, which is what an export would show |
| **C** | §4.1 signal authoring + §4.2 routing honesty | Fixes the single most-felt limitation, and it is a prerequisite for judging anything else |
| **D** | §4.5 GPU particles + the next deformer batch | Visual ceiling |
| **E** | §4.3 stems editor | Quality of life, large |
| **F** | Phase 6 states & timeline → Phase 7 camera authoring → Phase 8 export | The remaining product shape |
| **G** | §3 craft pass on the UI | Once the feature set stops moving |
