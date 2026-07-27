Alright, this got interesting. Here's the full landscape, organized several ways.

## By software category (what exists, what's missing)

**Live VJ/performance tools** — TouchDesigner, Resolume, Notch, MadMapper, VDMX. Built for performing artists, not producers. Even Notch, which does have real camera keyframing (spline-follow nodes, curve editor), buries it inside a general node graph rather than exposing it as a dedicated cinematography timeline. Nobody productizes "camera as a first-class creative role" the way you're imagining.

**AI music-video generators** — Freebeat, NeuralFrames, Kaiber. These analyze song structure and auto-generate scenes. NeuralFrames is the closest existing thing to your core idea — it does stem separation → visual parameter mapping — but it's prompt-and-regenerate, not hands-on scene-building. You never get a camera, a shape, or a timeline you directly manipulate.

**Producer-side visualizer templates** — this is the one that surprised me. There's a whole cottage industry of After Effects/FL Studio templates (Trapcode Particular-based packs, "Grotesk," "TrapWix") selling for $16–$30 on Gumroad, built specifically for trap/type-beat YouTube channels. They're static templates: swap colors, drop in your track, render. No real audio-stem routing, no 3D, no camera.

**Streaming visualizers** — vizz.fm, Visuval, Serato's Twitch overlays. Browser-tab, waveform/bars-level reactivity for DJ streams and BRB screens. Shallow by design — meant to fill dead air, not be a creative statement.

**Church/worship visuals** — ProPresenter, EasyWorship, MediaShout. Entirely lyric-and-loop focused; churches literally buy prebuilt "worship motion" video loops from stores like Worship House Media. Zero audio-reactivity, zero stem-awareness. Nobody has brought generative audio-reactive visuals into this world.

## By target audience — who's actually left behind

This is the real finding. Ranked by how underserved they are:

1. **Type-beat / trap-drill producers** — a *massive*, extremely active YouTube content economy (BeatStars, Airbit, thousands of weekly uploads) currently served by static AE templates and one-click tools like TunesToTube. Your original note dump — kick/snare, hats, "guns," "fakeouts," sub, extra gun layers — is literally trap-beat stem vocabulary. You may have unconsciously designed for this exact audience. They already think in tracks/stems (that's how they build beats), they upload weekly (so they need speed + reusable templates, per that TypeBeatHouse quote about needing "one visual system, many beats"), and nothing serves them with real per-stem visual control.
2. **Church/worship AV volunteers** — different buyer (non-technical, small budget, but often has real money via church tech funds), completely unserved by generative audio-reactive tools. Big "if" — different sales motion entirely.
3. **Bedroom/live electronic producers** who want Neural-Frames-style stem control but with actual manual authorship instead of AI-generate-and-pray.
4. **Streamers/DJs doing live sets** — currently stuck with shallow waveform visualizers; a lighter/live-performance mode of your tool could serve this.

## Other lenses you're not considering

- **The AI-generation wave is actually validation, not a threat.** Freebeat/NeuralFrames/Kaiber prove big appetite for "music becomes video automatically" — but every source frames these as *shallow ceiling, fast output* vs *manual tools, high ceiling, slow output*. You're positioned as the manual, high-ceiling option for people who currently have no accessible manual option — that's a real strategic lane, not a contrarian bet.
- **Reusability/templating as a business model.** Type-beat producers explicitly want "one visual system, many beats" — this suggests your product might sell better as save-and-reuse "visual presets/routing setups" (like a preset pack economy, similar to how trap producers already buy drum kits and templates) rather than a one-off render tool.
- **The stem-separation problem you've sidestepped might become your moat or your Achilles' heel.** You assumed pre-separated mp3 stems (true for producers, since they render stems from their own DAW). But if you ever want to serve someone who only has a final mixed mp3 (a signed artist wanting a visualizer for an already-mastered single), you'd need AI stem separation (Demucs, LALAL.AI-style) — a very different, harder problem, and a reason to explicitly scope v1 to "people who own their stems," i.e., producers, not finished-song artists.
- **Camera-as-cinematographer is a genuinely rare feature even in research.** Academic virtual-cinematography research is moving toward AI-automated/text-driven camera control — meaning "manual keyframed camera, treated as a craft" is almost contrarian in 2026. That could be a differentiator worth marketing directly ("you direct it, nothing auto-generates for you") rather than downplaying.
- **Distribution/discovery lens**: type-beat producers already live inside a search-driven ecosystem (YouTube SEO, trend-finder Chrome extensions). A tool that helps your output *stand out* in that specific feed (distinct visual identity per producer/channel) has a built-in growth loop your marketing could lean on — "your channel becomes visually recognizable," not just "make a video."

Want me to dig into pricing/willingness-to-pay for the type-beat producer segment specifically, or sketch what a v1 aimed squarely at them (vs. a v1 aimed at electronic musicians) would actually look like feature-for-feature?

## What you already have that's genuinely good — keep these

- **Weighted N:1 modulation matrix** (50% guns / 25% drums / 25% atmosphere → one parameter) — this is the real architectural core, and it's sound. It's the same concept as a mixing console's send/return bus, just applied to visual params instead of audio.
- **State-based timeline** instead of one continuous automation curve — matches how music actually works (sections, drops, builds).
- **Manual camera as a craft, not AI-generated** — genuinely rare positioning right now; current research is pushing toward automated/text-driven camera control, so "you direct it" is a real differentiator, not a limitation.
- **Separate stems as input, not a single mixed file** — sidesteps the hardest unsolved problem in this space (source separation) by assuming your users already have stems from their DAW.

## Steal-from-other-software list

**From TouchDesigner** — the node/operator model (TOPs for image, CHOPs for audio/motion data, SOPs for geometry) is worth copying structurally even if you hide it behind a simpler UI: it's the cleanest existing answer to your own "new components should work together" requirement. Build your internal architecture as a typed node graph even if 90% of users never see raw nodes.

**From Notch** — parametric deformers exposed as simple sliders on top of a node graph underneath (best of both: approachable surface, real depth underneath) — and their Follow Spline pattern for camera-on-path, which you should make first-class instead of buried.

**From Resolume** — the "it just works, drag and drop, no patching required" onboarding philosophy. Resolume wins the live-VJ market almost entirely on ease of use over TouchDesigner's power. If your buyer is a producer, not a coder, this matters more than raw capability.

**From Ableton Live / DAWs generically** — session view vs arrangement view duality. You could offer a "session mode" (trigger scenes/states live, like a VJ) alongside your "arrangement mode" (linear NLE timeline) — this bridges your live-performance-capable users and your render-a-video users with one data model.

**From NeuralFrames** — the "separate into drums/bass/vocals/melody, map each to visual movement" flow is proof of concept for your core loop; steal the simplicity of their mapping UI (drag a stem onto a visual property) even though you'll do it manually instead of via AI generation.

**From type-beat AE templates (Grotesk, TrapWix)** — the *reusability* obsession: horizontal + vertical export simultaneously, saved "visual systems" reusable across dozens of tracks without rebuilding from scratch. This should be a first-class save/load unit in your product (a "rig" — camera path + shape + routing table + color scheme, saved as one reusable preset).

**From Millumin** — theatrical/narrative cue-based triggering (built for shows with a script), a useful pattern if you ever support live performance mode, not just render mode.

**From DAWs' automation lanes** — visual "automation curve" view of exactly what's driving a parameter at any timeline point, so users can see and hand-edit the modulation, not just set-and-forget the knob.

## What you've missed — feature gaps to fill

**Audio analysis depth.** Raw loudness/RMS alone gives you the "chaotic mess" outcome one TouchDesigner artist specifically warned about — syncing to the whole song read as noisy; syncing to specific extracted data read as intentional. You need:
- Onset/transient detection per stem (attack timing, not just amplitude) — this is what makes "explode on the kick hit" actually hit in time
- Frequency-band energy (sub/low/mid/high) so a track like "sub" can drive parameters differently than "hats" even without separate files
- Optional beat/tempo grid detection for snapping shape-state changes to bars

**A true parameter abstraction layer.** You need one internal signal type (normalized float, or float+curve) that every module — camera, shape morph, particle count, color — consumes identically, with per-target remapping (range, curve shape, smoothing/attack-release). Without this, "modularity" breaks the moment you add a second parameter type.

**Smoothing/envelope controls on every mapping.** Raw audio-to-parameter mapping looks jittery and amateurish without attack/release shaping (literally an ADSR envelope, borrowed from synthesis) between the audio signal and the visual parameter. This is probably the single most-missed feature by people prototyping this kind of tool.

**Preset/rig marketplace or library.** Given the type-beat producer insight, a save/reuse system for entire routing+camera+shape setups (not just single presets) is a business model, not just a feature.

**Export pipeline as a first-class citizen**, not an afterthought — horizontal + vertical simultaneous render (explicitly requested by that producer audience), plus batch rendering (queue 10 tracks overnight, come back to 10 finished videos) since weekly-upload producers need throughput, not one-off renders.

**Collaboration/hand-off** — for label or team use, being able to export/share a "rig" file separately from the audio, so an artist and a visual designer can work asynchronously.

**Undo history and non-destructive editing** — NLE-standard, easy to forget when you're prototyping the flashy parts first.

## Tech stack (grounded in current 2026 state)

- **Rendering: Three.js with its WebGPU renderer**, not Unity. As of Three.js r171+ WebGPU is production-ready with zero-config fallback to WebGL2, and it now handles compute-shader particle systems past 1M particles — plenty for your particle-system ambitions. Unity WebGL has no WebGPU path and 10–30% higher draw-call cost, and cross-platform web delivery matters a lot for a tool you want producers to just open and use.
- **App shell: Tauri or Electron**, wrapping the Three.js/web frontend into a desktop app so you get local file access (mp3 stems, batch export to disk) without users fighting browser sandboxing.
- **Audio analysis: essentia.js** (WASM port of the Essentia C++ MIR library) for onset detection, beat tracking, spectral/band-energy features, layered with **Meyda** for cheap real-time features (RMS, spectral centroid) where you don't need Essentia's heavier algorithms — this combination is a well-benchmarked, actively used pairing specifically because Essentia covers deep MIR features Meyda doesn't, while Meyda is faster for lightweight real-time needs.
- **Render/export: server-side or local ffmpeg pass** to encode the WebGL/WebGPU canvas output frame-by-frame to mp4 — needed for anything beyond a live preview, since real-time playback framerate and deterministic frame-accurate export are different problems.
- **Node graph engine (internal):** build your own lightweight typed graph (signal in → transform → parameter out) rather than adopting TouchDesigner's actual engine — you don't need their generality, you need your specific signal-routing problem solved well.

Want to go deeper on any one piece next — like designing the actual data model for a "rig" (JSON schema for routing + camera + shape state), or scoping what a buildable v1 vs. v2/v3 feature list looks like?


This is a strong plan — genuinely well-structured, and it clearly absorbed the conversation we've had (weighted modulation matrix, camera splines, NLE state blocks, radial symmetry deformer). Here's the honest technical review.

## What's right about this

- **Engine/UI separation** — keeping `engine/` (audio, graphics, camera, export) completely decoupled from `components/` (React) is the correct call. It means your core logic isn't tangled with render cycles, and it's portable if you ever need to move rendering off React.
- **Zustand over Redux** — right-sized for this; you don't need Redux's ceremony for a project like this.
- **React Flow for the state graph** — a nice addition beyond what we discussed. Worth clarifying intent though (see below).
- **WebCodecs for export** — the modern, correct choice over ffmpeg.wasm for browser-side encoding.

## The one thing that will actually hurt you if missed

**Don't let audio-reactive data flow through Zustand/React state at frame rate.** Your `AudioAnalyser` is producing values 60 times a second (rms, onset, sub, bass, mid, treble, transient) per track. If `useAudioStore` pushes those into Zustand and components subscribe via React, you'll trigger React re-renders 60x/sec across however many components read that state — this is the single most common way R3F audio-reactive projects grind to a halt. The fix: audio-reactive per-frame values should bypass React entirely — write them into refs or directly into Three.js shader uniforms inside `useFrame`, and only push to Zustand the *stuff a human actually needs to see update* (like a VU meter, at a throttled rate). Worth making this explicit in `ModulationMatrix.ts`'s design before you build the rest on top of it, since retrofitting this later means touching every consumer.

## A real 3D-math risk buried in "any-to-any shape morphing"

`MorphEngine.ts` interpolating `position → targetPosition` only works cleanly if every shape shares the same vertex count and correspondence. Sphere → Torus → "Hyperforge" as truly different mesh topologies will not lerp cleanly — you'll get exploding/self-intersecting geometry mid-morph. The standard fix: generate all your morphable shapes from one shared base topology (e.g., a subdivided UV sphere or icosphere) and *displace* its vertices differently per shape, rather than authoring genuinely different meshes. Worth confirming this is the plan before shapes get built — it constrains how "Hyperforge" etc. can be authored.

## Gaps versus what we scoped earlier

- **Lighting effects** — no `LightingEngine`/store anywhere. You explicitly listed this as a parallel system to particles early on; it's absent here.
- **Background 2D overlay elements** (arrows, lines, shapes) — not present as a layer/module.
- **Particle system** — folded into "Deformers" (noise wave) but not a dedicated system; if you want real particle count/behavior control (not just vertex noise), it probably deserves its own `engine/graphics/ParticleSystem.ts`.
- **Batch export / simultaneous horizontal+vertical render** — the type-beat-producer-specific feature from earlier isn't reflected in `MP4Recorder.ts`'s scope.
- **Reusable "rig" presets** (routing + camera + shape, saved independent of a full project) — `project.ts` covers project schema but not this narrower reusable unit.
- **Undo/redo** — not mentioned anywhere; genuinely easy to bolt on early with Zustand (temporal middleware) and painful to retrofit later.

## One thing to clarify with yourself before building

`StateNodeGraph.tsx` (React Flow) alongside `NLETimeline.tsx` with its own `VisualTrack` state blocks — that's two different mental models for the same "states" concept: linear (timeline) vs. graph (node-wire, implying non-linear transitions/branching). That's not necessarily wrong — it could be genuinely powerful (linear mode for rendering final videos, graph mode for live triggering/performance) — but if it's accidental scope creep rather than an intentional dual-mode design, it's worth cutting for v1. Which was it meant to be?
Good move making this the source-of-truth doc — it'll keep whatever's building this from drifting phase to phase. Overall fidelity to your notes is genuinely strong: the dual camera spec, `(0,0,50)` origin, solo-isolates-visuals behavior, node view philosophy ("simpler than TouchDesigner"), and the DaVinci bottom-nav panel switcher are all captured faithfully, close to your exact wording in places.

Two structural issues worth catching before more phases get built on top of this, and a couple of things still unresolved from earlier.

## The camera/timeline split contradicts your own spec — and the previous plan

Your notes are explicit: *"camera module, whose path can be seen and manipulated and controlled during the nle timeline."* That's camera-keyframing-as-a-timeline-track. The React plan you shared last turn agreed — `CameraTrack.tsx` lived nested inside `timeline/`, as one track alongside `VisualTrack` and `AudioWaveformTrack`.

This KB quietly changes that: **Panel 4 (Camera)** and **Panel 5 (Deliver/NLE Timeline)** are now separate pages entirely, and the roadmap builds them as separate phases (Phase 5 vs Phase 6). If camera keyframes live in their own standalone panel disconnected from the timeline, you lose the thing you specifically asked for — seeing and scrubbing the camera path *while* looking at your state cuts. Worth deciding explicitly: is Camera its own panel because it needs a big 3D viewport to place spline waypoints in (arguably true — you need 3D space, not just a timeline strip), with only the *keyframe timing* also mirrored into the NLE timeline as a track? That's probably the real answer — camera authoring happens in a spatial panel, but its keyframes still appear as a track on the NLE timeline, same data underneath. Right now the doc doesn't say that; it reads as two disconnected systems.

## Phase 5 depends on something Phase 6 hasn't built yet

Camera *keyframes* are inherently time-based — they need a timeline/playhead concept to interpolate against. Building "Flying Cinematographer 3D Camera spline trajectory & keyframes" (Phase 5) before "NLE Timeline State Clip sequencing" (Phase 6) means you're building the time-dependent half of a feature before the time axis itself exists. Practically: you can build the spline *curve* (waypoints in 3D space) in Phase 5 fine, but wire "keyframe at time X" into the actual timeline data model in Phase 6 once it exists — otherwise Phase 5 either invents a throwaway timeline concept it then has to reconcile with Phase 6's real one, or sits half-functional until Phase 6 lands.

## Still open from earlier, still not addressed here

- **Primary vs. secondary shape relationship** — the doc lists them as a type distinction (3.3) but still never defines what secondary *does* relative to primary (orbits it? sits behind it? driven by a different track?). Worth pinning down before `ShapeFactory.ts` gets built, since it changes the data model.
- **Morph topology risk just got bigger** — adding "Custom 3D Mesh (GLTF/OBJ)" to the shape list (3.3) is new since last time, and it's the sharpest version of the problem I flagged before: your notes demand *"Transform btwn any to any possible"* — but an arbitrary imported OBJ has arbitrary vertex topology with no correspondence to a sphere's. True any-to-any morphing needs either (a) all shapes built from one shared base topology, or (b) a real cross-topology morphing technique (much harder — think 4D interpolation or volumetric morphing). Worth explicitly deciding which shapes are "morph-compatible" (procedural, shared topology) vs. which are "swap only, no morph" (custom meshes) — and stating that distinction in the KB so it's not discovered mid-build.
- **The audio-reactive-data-through-Zustand performance issue** I flagged last time isn't encoded as a rule anywhere in Section 3.2/2.1. Given this doc's whole purpose is "reference before every decision," it's worth adding one line under the Audio Subsystem or Modulation section establishing that per-frame audio values write to refs/uniforms directly, bypassing React re-renders — otherwise whoever builds Phase 2 has no way to know this constraint exists.

Everything else (batch/dual-export, undo/redo, reusable rig presets) is still just absent — probably fine to leave for a Phase 8 rather than block on now, but worth a placeholder line in the roadmap so they don't get forgotten entirely.

Want to resolve the camera/timeline architecture question first, since it's the one that'll actually change file structure if you decide differently?

Good question to slow down on — this is a real fork, not a minor detail. Let me lay out what each choice actually costs you.

**If camera lives inside each state** (bundled with shape+params+nodes): every state becomes a fully self-contained package, which is consistent with how you've already defined states. But you lose continuous camera movement *across* a cut — if the camera is mid-orbit when State 1 ends and State 2 begins, does it snap back to State 2's own starting position? That's a hard reset every single cut, which kills the "flying cinematographer gliding through the scene" feel you specifically wanted. You'd also end up re-keyframing similar moves over and over for every state unless you build a copy-paste system on top.

**If camera is fully separate, authored after all states exist**: you get continuous, uninterrupted camera moves that glide straight through state cuts — genuinely closer to how a real camera operator works, since they don't reset just because the "scene" changed. But it decouples camera from content — if you later reorder or resize states, your camera keyframes (sitting at fixed timeline positions) may no longer line up with whatever visual happens to be there anymore.

**The actual answer is closer to your second instinct, but as a parallel track, not a separate end-of-process step:** treat Camera as its own independent track on the NLE timeline, sitting alongside the state/visual track — not nested inside states, but not something you bolt on only at the end either. This is exactly how Premiere, After Effects, and Cinema 4D handle it: camera is an independently animatable object with its own keyframe track, decoupled from whatever clip content is showing underneath. You keyframe it whenever you want — while building State 1, after State 3 exists, doesn't matter — and it just glides across however many state-cuts happen to fall underneath it.

Two things make this workable without losing the reordering safety of Option A:
- **Magnetic snapping**: let camera keyframes optionally snap to state boundaries, so "start push-in exactly when State 2 begins" stays correct even if you drag State 2 to a new position later.
- **Saveable camera moves**: let a keyframed camera move (e.g. "slow orbit") be saved as a reusable preset, so you're not hand-keyframing the same move for every state — this solves Option A's repetition problem without needing Option A's architecture.

This also directly resolves the Panel 4 / Panel 5 tension I flagged last message: **Camera panel becomes your spatial authoring tool** (you need a real 3D viewport to place spline waypoints in space — that's why it deserves its own panel), **but the keyframes it produces live as a track on the NLE timeline** underneath, same data, two views of it. Not two disconnected systems — one camera track, viewed spatially in one panel and temporally in another. Worth updating the KB to state this explicitly so `CameraSplinePath.ts` and the timeline's data model are built against the same underlying keyframe store from day one.
Genuinely useful research target — Blender has spent 20+ years solving almost exactly this problem (reusable animated blocks arranged on a timeline, camera behavior, parameter-driven values), so its answers map onto your product closely. Here's what's directly relevant.

## The 3-tier keyframe system — you're currently missing the middle layer

Blender doesn't just have "keyframes on a timeline." It has three connected views of the same data:
- **Timeline** — coarse scrubbing/playback, the top-level view
- **Dope Sheet** — an overview of all scene keyframes in spreadsheet format, letting you manage multiple keyframes across multiple objects at once
- **Graph Editor** — shapes the actual motion curve between keys via F-curves — each animated channel becomes a curve describing acceleration, deceleration, overshoot, and settle, with handles (tangents) controlling the slope entering/leaving each keyframe

Your KB has nothing equivalent to the Graph Editor. This matters more than it sounds: a steep slope means fast change, a flat slope means the object eases or stops — without control over this, camera moves either look robotic (linear) or floaty/uncontrolled (default auto-smoothing that can overshoot and cause drift). For a "flying cinematographer" feel specifically, easing is the difference between a move that feels intentional and one that feels like a slideshow. This should probably be a v1 feature, not a later polish pass — it's cheap to build (just interpolation curve types + handle offsets per keyframe) and expensive to feel-right without.

## Blender's NLA Editor basically already answers your states-vs-camera question

This is the big find. Blender's Non-Linear Animation editor is structurally almost identical to what you're building: instead of working with individual keyframes, it works with actions — named, reusable animation segments — displayed as a stack of tracks that work like layers in an image editor, where higher tracks take precedence over lower ones, though you can also choose to blend them. Critically: an Action is the raw animation data container — the source of truth — and when you push it into the NLA editor it becomes a Strip, which is a reference to the Action, not a copy of it. The NLA editor works similar to a video editor — you load strips, mix them together, layer them, make them longer or shorter — except instead of videos, you're arranging animations.

Translating this directly to your product: your **States** should be Blender's **Actions** — named, reusable, edited-once-updates-everywhere blocks — and what sits on your NLE timeline should be **Strips referencing them**, not copies. This solves a problem you haven't hit yet but will: if "State: Sphere Intro" is used at three points in a song and you tweak it, do all three update, or just one? Blender's answer (strips reference actions) is almost certainly the right one for you too.

For camera specifically, this also validates and sharpens the answer from your last question: Action Blending affects the behavior when two tracks simultaneously have a curve affecting the same property, and Action Extrapolation determines what happens in the gaps past a strip's extents — hold the last value, hold forward, or nothing. That extrapolation concept is exactly what handles your snapping question — a camera strip can "hold" its last position into the next state, or extrapolate its motion continuing, or reset, as an explicit per-strip choice rather than an accident of architecture.

## Constraints — a whole category you don't have yet

Blender separates **manual keyframing** from **declarative behaviors** called constraints, and this is probably your biggest missing feature category:
- **Follow Path** — parenting a camera to a curve so it automatically travels along it, which is what your spline-camera should probably use under the hood rather than hand-keyframing position at every waypoint
- **Damped Track** (a.k.a. Look At/Aim) — makes an object point toward a target using pure swing rotation to minimize unwanted roll around the tracking axis — this is huge for you: instead of manually keyframing rotation so the camera always faces your sphere, you'd toggle "look at: [shape]" once and it just works, even while the shape itself is moving
- **Child Of with animated influence** — used to smoothly hand off tracking between two different targets by animating the influence/blend between two constraints, which is exactly the mechanism for "camera looks at Shape A, then smoothly hands off to looking at Shape B" without a jarring snap

Right now your camera system is "keyframe everything by hand." Adding a constraint layer (Look-At, Follow-Path, with blendable influence) would make authoring dramatically faster and is a well-worn, provably-good pattern — worth adding to `CameraSplinePath.ts`/`DualCameraEngine.ts` as a first-class concept, not just raw position/rotation keyframes.

## Drivers — validates your modulation matrix, and gives you a UI reference

Blender's Drivers system lets any parameter be controlled by an expression referencing another property, rather than manually keyframing it — this is precisely your weighted modulation matrix (audio track → parameter), just generalized. Reassuring confirmation you're not inventing a weird pattern — you're building a domain-specific Drivers system, and Blender's driver panel UI (expression + variable list) is a legitimate reference point for how to expose editable formulas to non-programmers without it feeling like raw code.

## Smaller things worth stealing
- **Motion trail visualization** — Blender shows a visible dotted path with frame-number markers along an object's actual trajectory, letting you see spacing (bunched dots = slow motion, spread dots = fast) at a glance. Directly useful for your camera-path gizmo — spacing communicates speed without needing to scrub.
- **F-curve modifiers** (e.g., a "noise" modifier applied procedurally on top of keyframed motion) — relevant to your subtle idea of adding organic imperfection to camera moves without hand-keyframing shake.

The throughline across all of this: Blender's pattern is consistently *"keyframes are the raw data, but layer declarative behaviors (constraints, drivers, NLA blending) on top so users rarely hand-animate the obvious stuff."* Your current plan is closer to "keyframe everything manually," which will work but will be far more tedious to author with than it needs to be.
More gold in this pass — three tools that each solve a piece of your puzzle better than anything I'd found before.

## Cinema 4D's MoGraph (Cloner + Effectors) — this is your "symmetrical replication" feature, fully solved

This directly answers the "replicate shape and symmetrically offset it" feature from your original notes, and it's far richer than a simple mirror toggle: the Cloner duplicates objects in linear, radial, or grid arrangements — radial mode lets you manipulate radius, plane, and start/end angle for circular patterns. The real power is what sits on top: Effectors like Random, Step, or Shader apply dynamic transformations — scaling, rotating, moving clones — driven by mathematical functions, falloff, or other parameters, and every clone carries internal U/V/W coordinates ranging 0 to 1, which Effectors use to assign each clone a value so it can be transformed individually — meaning you can drive per-clone variation (not just uniform repetition) off a single parameter. Even better for you specifically: a Step Effector can offset a parameter across clones sequentially, while a Delay Effector adds a springy, staggered easing to how the transformation propagates across the set.

Direct translation to AURA: your "replicate + symmetrically offset" feature shouldn't be a single toggle, it should be a **Cloner-style array node** (linear/radial/grid) plus an **Effector layer** that can itself be driven by your audio modulation matrix — e.g., "guns" track drives a Step Effector's rotation offset, so each cloned shape reacts a beat later than the last, cascading outward. That's a genuinely more powerful and more "musical" feature than flat symmetry, and it reuses your existing modulation architecture instead of needing a separate system.

## Unity Cinemachine — the actual industry answer to your camera/state question

This is the cleanest resolution to the camera-across-states question we discussed last time, and it's a well-proven pattern from real games/cinematics, not a niche idea. Cinemachine lets you create an unlimited number of virtual cameras and blends between them automatically, presenting the result through a single real output camera — because Unity itself only supports one truly active camera at a time, which makes blending between two shots otherwise impossible. The mechanism: a Cinemachine Brain component monitors all virtual cameras in the scene; only one is "live" and driving the real camera at any moment, except during a blend, when both are live simultaneously and interpolated between. Which virtual camera takes over is decided by **priority**: equal or higher-priority cameras override the current one, enabling setups where different cameras activate based on triggers, states, or conditions, with important cameras always winning out over lower-priority ones.

Translate this directly: define a **virtual camera per State** (or reusable across states, like Blender's Actions) — each with its own position/behavior/spline — and let a "Brain" handle the actual blending when states cut, rather than hand-managing one single camera object across every transition yourself. This is strictly better than what's in your KB now, and it's a proven pattern specifically for the exact problem you have (camera continuity across content cuts). Also worth stealing: Cinemachine's noise module procedurally adds handheld-camera-style shake for cinematic effect — an easy way to make your "flying cinematographer" feel less like a locked robotic dolly.

## Ableton's Envelope Follower (Max for Live) — concrete vocabulary and UI pattern for your modulation matrix

This is the actual, shipped, decades-refined version of your "route track loudness to a parameter" idea, and it gives you exact parameter names to copy: the Envelope Follower tracks changes in the volume of an incoming audio signal and uses that to modulate any mapped parameter, with Rise controlling how much the attack of the envelope is smoothed and Fall controlling how much the release is smoothed — this is your attack/release smoothing gap from a few turns ago, already named and solved. It also has: Gain to set how much the incoming signal is amplified before tracking, and Min/Max sliders to scale the output modulation range — i.e., exactly the "how strongly does this track affect this parameter" knob from your original notes, plus range clamping you hadn't specified yet. And critically: by default it follows the track's own input, but sidechain routing lets it follow a completely different track's signal instead — the mechanism that would let "atmosphere" visually react to "drums" if you ever wanted cross-track modulation.

Direct translation: your weighted-knob-per-track idea should really be **Gain → Rise/Fall (attack/release) → Min/Max range → weight**, in that order, per connection in the modulation matrix — that's a proven, well-understood signal chain rather than a single flat percentage.

## The pattern across all of it

Every tool that's actually good at this (Blender, Cinema 4D, Cinemachine, Ableton) separates **raw data** (keyframes, audio signal, base clone) from a **modulation/behavior layer** sitting on top (constraints/drivers, effectors, camera blending brain, envelope shaping) — never asking the user to hand-author every frame or every clone by hand. Your current KB is strongest exactly where you've already internalized this (the weighted modulation matrix), and weakest where you haven't yet (raw camera keyframing, flat symmetry, no easing curves). Worth treating "add a behavior/modulation layer on top of raw data" as a standing design principle before building the next phase, rather than solving it feature-by-feature as gaps get noticed.
Three more concrete finds this round — one resolves the camera question even further, one solves your "simpler than TouchDesigner" goal directly, and one is a genuinely under-the-radar UX pattern worth stealing.

## Unreal's Sequencer — the camera answer, but inside an actual NLE

This is even closer to your exact tool than Cinemachine was, because Sequencer literally is a non-linear editing suite built for offline editing of animation and cinematic sequences, non-destructively. The camera-specific piece: a dedicated **Camera Cut Track** controls which camera is currently active during playback, separate from tracks that animate the cameras themselves — and you can drag the upper corner of a camera cut section to blend it in and out, useful for constructing complex shots without hand-keyframing a crossfade. This is your Camera-track-on-the-NLE-timeline answer, confirmed by a tool that's structurally almost identical to what you're building.

Two more things worth adopting directly:
- **Subsequences** — sequences can be nested inside larger sequences, letting you organize a big cinematic into smaller, independently-editable pieces, and enabling multiple people to work on different sub-scenes independently. Map this onto your States: a State could itself be a nested mini-timeline, not just a flat block — useful once your project gets past a handful of states.
- **Shots as reusable, reorderable, trimmable units**, similar to clips in a normal video editor, that can be freely rearranged non-destructively — validates your "states = clips" instinct is exactly right, not just an approximation.

## Unreal's Niagara — literally solves "simpler than TouchDesigner"

This is the best single answer I've found to a UI problem you flagged early on. Niagara offers **two parallel views of the same system**: a full node graph for power users, and a **stack** — a linear list of stacked modules — for less technical users, explicitly built because graphs are flexible but require technical knowledge, while stacks are modular and give an easier at-a-glance overview for less-technical users. Same underlying data, two skins.

That's your node-view problem solved architecturally: build the real logic as a graph internally, but default users into a **stacked list view** ("Drums → Radius: 50%, Guns → Explode Strength: 30%...") and only expose the raw node graph as an "advanced" toggle for people who want it. You get TouchDesigner's power without forcing TouchDesigner's interface on everyone.

Two more Niagara patterns worth having:
- **User Parameters** — values explicitly exposed by a system to the outside world, so external tools (like a Sequencer timeline) can drive them without opening the internal graph. This is exactly the concept you need for "which shape parameters are exposed to the modulation matrix / timeline" — an explicit exposed-parameter list, not "everything is always linkable."
- **Event Handlers** — one emitter can generate an event, and a separate emitter can listen for it and trigger a reaction. This is a genuinely different mechanism from your continuous modulation matrix (weighted blend of ongoing signals) — it's discrete trigger/response ("on kick hit → fire one burst"), which is closer to what a real gunshot/kick-hit "trigger" should feel like versus a continuously-blended value. Worth having both: continuous modulation for smooth things (atmosphere → slow color drift), discrete events for percussive things (kick → one explosion burst).

## Rhythm game beatmap editors — a small but genuinely useful UX trick

Tools like osu!'s editor and Beat Saber's ChroMapper are, at their core, exactly your problem in miniature: placing timed events precisely against a music waveform. Their answer: a **beat-snap grid** that snaps placed events to musical subdivisions (1/4, 1/8 notes, etc.) of the detected BPM, rather than free timeline positions, and the very first thing a mapper is told to check is whether the waveform display lines up correctly with the editor's beat grid before placing anything — a basic sync sanity-check step.

Direct steal: when placing keyframes, state cuts, or triggers on your NLE timeline, offer **snap-to-beat-grid** (derived from your onset/BPM detection) as a toggle, the same way video editors snap to frames. For someone syncing an explosion to a kick drum by hand, "snap to nearest detected onset" turns a fiddly manual alignment task into a click.
