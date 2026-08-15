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

## 0 · ~~Blocking everything: nothing has been run~~ — resolved

**Historical.** This section blocked the queue when no browser had ever been driven here. It is now
driven every pass by the `run-aura` skill, which screenshots each page, imports a stem, builds a
look, exports an MP4 and decodes its frames. The smoke list below is kept because it is still the
right order to check things in by hand.

> **No browser has been driven in this workspace.** Fifteen modules built, verified by 315
> structural tests, a typechecker and a linter — and by zero pixels.

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
> **Steps 1–17 below are now driven automatically.** See the `run-aura` skill — it launches
> the dev server, screenshots every page, imports a generated stem, builds a look, exports an
> MP4 and measures the decoded frames for brightness and motion. What it cannot judge is
> whether the result looks *good*; that is still a human sitting in front of it.

13. Deliver → **+** under *States* twice, with a different look each time. **Place** both,
    drag one so they butt up, then play through the join. Does the picture change on the cut?
14. Press **M** during playback, then drag a strip edge near the marker — does it snap?
15. Camera → type into **Position Z**. Does the monitor move? Then **Align to this view**
    — do the fields update to match?
16. Routing → wire a stem to the camera's **Position Y**. Play. Does the camera bob?
17. Deliver → **Export MP4** at 720p/30 over a short project with **Bloom on**. Plays in VLC,
    and is it as sharp as the monitor?

---

## 0b · The queue has changed

*2026-08-07.* Everything below this section is the old queue — defects, structure, craft, features.
It is still accurate as an inventory and it is **no longer the priority order**.

The priority is now one thing: **widen the medium**. Ten users produce eight similar outputs, and no
amount of defect-fixing or UI craft changes that. The argument, the bar and the sequence are in
**[17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md)**; the phase breakdown is 10A–10F in
[06-ROADMAP.md](06-ROADMAP.md).

Two things in the lists below are explicitly deferred rather than dropped:

- **The craft pass** (gizmos, drag-to-scrub, hover, easing). Diagnosed in
  [05-DESIGN-SYSTEM.md](05-DESIGN-SYSTEM.md) §"Where this system is still not honest". Real, and it
  makes a narrow tool pleasant — see D-104.
- **More post effects and more primitives.** Permutations inside the one image family that exists.

Defects still get fixed as found. That has not changed and does not need a queue.

*2026-08-13 · where the widening got to.* Passes 1, 2 and 4 have landed and 3 is most of the way:
palette, ramps and a routable hue shift; the points backend and any-mesh-as-a-cloud; scatter and
surface layouts with a curl-flow effector; and the lines backend with its ribbons. Three of four
render backends, six of eight element families.

**The next action is not a build.** The ten-project test in [17 §2](17-EXPRESSIVE-RANGE.md) has not
been run since Pass 2, and it is the only thing that can say whether four kinds of image actually
produce ten distinguishable projects. Everything below — including the craft pass — stays behind it.

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
| D13 | **A post-chain cut can be one frame late in an export** | `PostChain` rebuilds through React when the live strip set changes (D-61), and the rebuild lands after `advance()` has already drawn the frame. Same lateness every time, so two exports still match — but the cut is 16 ms off at 60 fps. Fixing it properly means building the composer imperatively instead of through React | ⬜ open, low |
| D14 | **Export looked soft / wrong** | Two causes, both size-related. `PostChain` sized its render targets from R3F's `size` (the CSS box) rather than the drawing buffer, so every effect rendered at preview resolution and was upscaled into the file. And Deliver had no `ViewportSlot` at all, so the canvas measured 1×1 and that was the resolution the whole chain got (D-66, D-67) | ✅ fixed |
| D15 | **Export was not frame-deterministic** | R3F's rAF loop kept running during the export, interleaving wall-clock frames into the same `useFrame` subscribers — so feedback decay and grain read garbage `delta` values between the exporter's real frames (D-67) | ✅ fixed |
| D16 | **Aim at target did nothing** | On by default, but `CameraRigDriver` early-returned before the look-at whenever the behaviour stack was empty — so the checkbox worked only once you added an Orbit (D-65) | ✅ fixed |
| D17 | **The Scene Camera could not be positioned** | Its transform was raw vectors on `DualCameraEngine`, writable only by *Align to this view*. No numbers to type, no wires, no curve. `keyframes`/`waypoints`/`constraints` sat in the store with full CRUD actions and zero readers — a keyframe system that existed only as a type (D-64) | ✅ fixed |
| D18 | **4K and 1440p could never export** | The codec string pinned H.264 **level 4.0**, whose frame ceiling is 8192 macroblocks. 1080p is 8160 and just fits; 1440p is 14400 and 4K is 32400, so both failed at `configure()` with a coded-area error. Two of the six resolutions the UI offers were dead on arrival, and the comment above the constant claimed it "still allows 4K". Now the level is derived from resolution *and* frame rate, then confirmed with `VideoEncoder.isConfigSupported` | ✅ fixed |
| D19 | **The selection outline exported into the video** | Unlike the light gizmos it was a plain mesh, not on `GIZMO_LAYER` — so selecting a shape before pressing Export baked a purple wireframe cage into the file | ✅ fixed |
| D20 | **Two Place clicks buried one strip under the other** | Both landed at the playhead on lane 0, and the one underneath is on a losing lane, so it was invisible *and* inert. `findFreeSlot` now steps up a lane, then appends | ✅ fixed |
| D21 | **Routing hid Camera and World on an empty scene** | An early return replaced the whole target column with "No objects yet" — but the camera and the world are not things you add, and a stem driving the camera is the most useful routing in the product. It looked unavailable on every fresh project | ✅ fixed |
| D22 | **Every new object arrived the same indigo** | `MaterialRegistry.defaultParams` handed out one colour, so a three-shape scene read as one material repeated — the failure D-43 named, in a nicer colour. Colours now rotate per shape | ✅ fixed |
| D23 | **Deliver wasted ~380px under the lanes** | The timeline filled the column while its content is a fixed ~180px, and the track area ended mid-panel at whatever the content measured, which read as a rendering fault rather than the end of the song | ✅ fixed |
| D25 | **Every stem curve appeared twice** | `AutomationPanel` listed *all* lanes, so a stem's curve showed both under its own waveform and again in the bottom dock — recreating the detached, contextless track D-55 exists to avoid. Now detached lanes only, and the dock hides itself when there are none | ✅ fixed |
| D26 | **A stem curve could not be made to snap** | Interpolation was exposed only on the detached-lane panel. The stem lane is the *primary* path (D-55), so on the path anyone actually uses a curve could only ease — and the snap is the move this genre is built on. The engine had supported `step` since it was written | ✅ fixed |
| D27 | **Hiding the empty lane dock hid the only way to make a lane** | The `+` lived in the panel's own header — a door on the inside of the room. *Draw a curve* now sits beside *Add more stems* | ✅ fixed |
| D24 | **Tempo detected an octave low** | A synthetic 128 BPM kick reports 64 BPM. The beat grid still lands on beats, so snapping works — it is half as fine as it should be, and the readout is wrong | ⬜ open, low |
| D25 | **Every state's shapes appeared in the layer stack at once** | A state was a *selection* over one shared object pool, so a five-state project showed thirty objects and switching states only toggled which were hidden. Unauthorable. States own their scenes now (D-98) | ✅ fixed |
| D26 | **The camera path was drawn on every page** | It was on the general gizmo layer, so it appeared on Look, Routing, Scene — and on the export monitor, which is supposed to be a proof of the file. Camera furniture has its own layer and each page declares what it shows (D-101) | ✅ fixed |
| D27 | **The Scene Camera was invisible in preview** | Nothing drew it, so you composed a shot whose frame edges you could not see. Frustum + motion trail, as Blender does (D-102) | ✅ fixed |
| D28 | **Adding Follow Path did nothing** | `progress` sat at 0 with nothing driving it, so the camera parked at the first waypoint and the feature looked broken. Creating the behaviour now creates the ramp too | ✅ fixed |
| D29 | **"Aim Along Path" rendered as `0.00×`** | Declared as a 0–1 float, so it drew as a numeric field that said nothing about being a yes/no. It is a checkbox | ✅ fixed |
| D30 | **Two playhead systems disagreed on the stems page** | A rack-wide line measured a *different element* than the per-row clip tracks, so it sat at a visible offset. Deleted; each row draws its own inside its own container, correct by construction | ✅ fixed |
| D31 | **The scrub bar did not feel draggable** | It had the drag listeners all along — and a 6px-tall target with no handle. 24px hit area and a visible grip | ✅ fixed |
| D32 | **REC was wired to nothing** | Styled like a live feature since Phase 1. Third instance of the pattern after `add-marker` and `forgetHandle` (D-100) | ✅ fixed |
| D33 | **A new state's default object was named "Object"** | `defaultScene()` named a brick id that does not exist, so the registry lookup failed and it fell through to the generic label. Mine, introduced the same day | ✅ fixed |
| D34 | **The per-object colour picker stopped working** | Every new object gets a palette slot, and the render path resolves a bound slot *over* the stored colour — so the picker wrote a value that was overridden on the next frame. Setting a colour now releases the slot, and clicking a swatch is the way back (D-107) | ✅ fixed |
| **D35** | **Adding any post effect killed the viewport** — "The viewport stopped working. Cannot read properties of null (reading 'alpha')", after a wall of `GL_INVALID_VALUE` and `Context Lost`. Worse the larger the viewport; instant in full screen | **`EffectComposer.setSize(w, h)` resizes the *renderer*** before sizing its buffers, and it already sizes those buffers from the drawing buffer on its own. `PostChain` passed it the **drawing buffer** size — correct values, wrong door (D-66). So the renderer's CSS size was set to the drawing-buffer size, the drawing buffer became *that* × the pixel ratio, the next frame saw a changed buffer and fed it back in. A feedback loop multiplying the canvas by the pixel ratio **every frame**: measured 1338 CSS px → 8192 in three frames, a 199-megapixel buffer. The driver refused the allocation, every attachment came back zero-sized, and the context died. The `alpha` crash is the fallout — `postprocessing` reads `getContext().getContextAttributes().alpha`, which is `null` on a dead context | ✅ fixed |
| **D36** | **Every export rendered at pixel-ratio× the requested resolution** — a 1080p export drew a 3840×2160 buffer, and 4K asked for 7680×4320 | `gl.setSize(w, h)` multiplies by the pixel ratio, and the exporter's resolutions are already in real pixels. Invisible at 720p (just wasted work), fatal at 4K — the allocation lands past what a mid-range GPU gives once the post chain's half-float buffers sit on it, and the failure is a lost context rather than a slow render. `setPixelRatio(1)` for the duration, restored after | ✅ fixed |
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
