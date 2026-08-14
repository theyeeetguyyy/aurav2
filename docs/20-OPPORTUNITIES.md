# 20 — Opportunities

> **What to do about [19-RESEARCH-2026](19-RESEARCH-2026.md).** Ranked bets, each with the reason,
> the cost, the architectural fit and the way it could be wrong. Nothing here is scheduled — the
> queue is [06-ROADMAP](06-ROADMAP.md) and the current priority is still
> [17-EXPRESSIVE-RANGE](17-EXPRESSIVE-RANGE.md). This is the pool the next few passes are chosen from.
>
> *Written 2026-08-14, while the [ten-project test](18-TEN-PROJECT-TEST.md) was being run for the
> first time. Several of these are answers to outcomes that test has not reported yet, and are marked
> so.*

## The short version

Every idea in one line. The rest of the document is the reasoning, the cost and the ways each one
could be wrong — read a row, then jump to its section only if you want to argue with it.

| | Idea | In plain terms | Size |
|---|---|---|---|
| **S1** | Stem separation in the app | Drop in one MP3, get drums/bass/vocals/other back, all on your machine. Today you must already own stems | medium |
| **S2** | Spotify Canvas export | The 8-second looping vertical clip every release needs. We can make it loop *perfectly*; most tools can't | small |
| **A1** | Dither / halftone / ASCII / posterise | Four post effects that make the output look *made* instead of computer-smooth. Massively in fashion right now | small |
| **A2** | Better colour maths | Rotate a colour without it also getting brighter or duller. Fixes every ramp and every hue wire at once | tiny |
| **A3** | Motion blur on export only | Render each frame several times and average. Fast motion stops strobing. Only an offline tool can do this | small |
| **A4** | Vertical safe-area guides | A box in the viewport showing what TikTok/Reels covers up, so your subject isn't behind the caption | tiny |
| **A5** | Anticipation on any wire | Let a wire read *slightly ahead* in the song, so a shape braces before the hit instead of after | tiny |
| **A6** | Silence as a signal | React to the music *stopping* — the bar before the drop. Nothing on the market does this | small |
| **A7** | Starter scenes | Three to five real, fully editable scenes so the first screen isn't empty | small |
| **B** | Attractors, growth, isolines, audio-shaped strokes | New shapes, all cheap now that the lines backend exists | day each |
| **C1** | Let cheap shapes rebuild every frame | Unlocks the oscilloscope, the live spectrum, the sweeping figure — the things that read instantly as *music* | medium |
| **C2** | **GPU (WebGPU)** | Move the per-frame vertex work off the CPU. Ceilings go from tens of thousands to millions | **large, staged** |
| **C3** | Thick strokes, as an option | Real line width, at the cost of deformers on that object. Offer both and say so | small |
| **D** | Sell the *look*, not the app | The market already pays $5–35 for one look. An AURA scene is that artefact | — |

**The organising idea.** Every entry below was checked against one question: *does this follow from
something AURA already is?* The tool's real assets are that **features are timelines sampled by `t`**
(HC-3), that **everything is a pure function of time** (HC-2), and that **the signal is per stem**.
A bet that leans on those is cheap and defensible. A bet that ignores them is a feature any of the
eleven tools in §1 of the scan could ship next quarter.

*If a term below is unfamiliar, it is defined in plain English in [GLOSSARY.md](GLOSSARY.md).*

---

## Tier S — changes what the product is

### S1 · Stem separation in the tab

**The whole thesis is per-stem routing, and today the user has to arrive already holding stems.**
That excludes anyone with a bounced mixdown, anyone visualising a track they did not produce, and
anyone who wants to try the software before committing an afternoon. [01-VISION](01-VISION.md)
deferred this as "a genuinely harder, different problem" — **true when written, false now**: Demucs
v4 via ONNX runs client-side in three to five minutes for a four-minute song, no server, no upload.

*Fit:* it is an **offline analysis step**, the exact shape of the MIR worker that already exists.
Nothing about the clock, the matrix or the render path changes. The result is four ordinary stems in
the rack, indistinguishable from imported ones.

*Cost:* medium, and mostly not code — `onnxruntime-web`, a worker, and a model of a few hundred
megabytes that has to be fetched once and cached. The honest version offers it as an optional
download rather than bundling it.

*Risk:* it is the first thing in this product that takes minutes and can fail. It needs a progress
bar, a cancel, and a clear "or drop your own stems" path that stays first-class. And a 300 MB
download is a real commitment to ask of a first-time user — it may belong *after* the first export
rather than before the first import.

*Also:* it closes the one place a competitor is directly on our thesis — Neural Frames separates into
eight stems and maps them to visual controls.

### S2 · The Canvas preset — an eight-second seamless loop

Spotify Canvas is **9:16, 3–8 seconds, no audio, loops forever, one per track**. A ten-track album
needs ten. It is a recurring, specified, unglamorous need that every releasing artist has and that
nothing in the competitive set treats as a first-class output.

**AURA is structurally excellent at it and does not know that yet.** A perfect loop requires every
time-dependent value to be periodic and in phase at the boundary — which is exactly what a system
built entirely from pure functions of `t` can guarantee, and exactly what a system with accumulators
cannot. Three pieces:

- **Loop mode on the clock** — the export wraps `t` at the loop length.
- **Loop-locked generators** — an LFO whose period divides the loop, and noise sampled *around a
  circle* in noise space rather than along a line, which is the standard technique and the only way
  noise closes on itself.
- **A seam check in the exporter** — decode frame 0 and frame N and diff them. A loop that is
  *nearly* right is worse than one that is obviously wrong, because it reads as a stutter every eight
  seconds forever.

*Cost:* small. *Fit:* perfect. *Marketing sentence:* "your Canvas, from your own beat, in five
minutes, and it actually loops."

### S3 · Lyrics as geometry

Whisper runs in-browser at 5–8× real time with WebGPU, and forced alignment gives **sub-100 ms word
timestamps**. Two facts from the scan sit either side of that: the AI video tools are being reviewed
badly for *having no lyric sync at all*, and kinetic typography is named as a core 2026 style
specifically in the music-video context.

AURA already owns the hard half. A word timing is a **marker**; a word is a **text object**; the
timeline, the states, the clips, the fifteen deformers and the whole modulation matrix already apply
to any object that exists. So the feature is: text (10F) + an aligner + a "make a clip per word"
action. Everything after that is the engine that is already built.

*Fit:* very high, and it makes the case for building text next rather than fifth.
*Cost:* text is a pass; the aligner is a worker and a model.
*Risk:* transcription on a dense mix is worse than on a vocal stem — **so it should run on the
separated vocal stem**, which makes S1 a prerequisite rather than a coincidence.

---

## Tier A — high value, low cost

### A1 · The 1-bit family — dither, halftone, ASCII, posterise

Four post bricks in the cheapest subsystem in the codebase. Dither-effect interest is up ~900 % year
on year, and the trend writing is explicit that it is **a counter-move to perfect-resolution AI
imagery**.

It also fixes something specific about AURA's own output: everything renders as smooth, clean WebGL,
which in 2026 is the visual signature of *generated*. A 1-bit pass is the fastest available way for
the work to read as made.

### A2 · OKLCH for every colour operation

`paletteRamp` already documents that sRGB mixing is wrong and that Oklab would be better. `shiftHue`
(D-116) has the same flaw in a more visible place: rotating hue in HSL changes apparent brightness as
it goes, so a hue wired to a stem *pumps in lightness* as well as colour, which is not what anyone
asked for. Perceptual hue rotation holds lightness constant.

*Cost:* one conversion pair and two call sites. *Payoff:* every ramp, every clone array, every hue
wire, in every project, forever.

### A3 · Sub-frame motion blur, export only

**The one quality advantage an offline renderer has over every real-time tool, and it is unclaimed.**
Render N sub-frames per output frame and average them. It is deterministic because everything is a
pure function of `t`; it costs N× render time, which is acceptable in a file you export once and
unacceptable in a preview, so it is export-only by construction.

Fast motion — a kick-punched dolly, a strobing array, a spinning kaleidoscope — currently strobes and
aliases. This is what makes an export look shot rather than screen-recorded, and no live visualiser
can do it at all.

### A4 · Vertical safe areas and a vertical workspace

The cross-platform safe area is **900×1400 centred in 1080×1920**; TikTok alone claims ~130 px at
the top, ~400–484 px at the bottom and ~140–180 px on the right. Composing a vertical piece without
those guides means the important part sits behind the caption or the action rail, and you find out
after posting.

*Cost:* a rectangle on the existing gizmo layer and a toggle. It also finally forces
[Q3](08-OPEN-QUESTIONS.md) — the 2D overlay layer — to be decided.

### A5 · Anticipation on any wire

The Time Delay effector can read the *future* (`t + lookahead`) and it is the only thing in the
product that can. Editing craft says a cut landing slightly **before** the beat creates tension where
one landing on it merely confirms. That is the same idea, and it belongs in the signal chain rather
than in one effector: **a negative delay on any connection**, so any parameter can brace before the
hit.

Two lines in the shaper, because the processors already work by changing *when* the source is read
(D-96). Structurally impossible for every live-tap competitor in the scan — they know the present and
nothing else.

### A6 · Silence as a signal

Every visualiser in existence reacts to loudness. **Nothing reacts to absence** — and in this genre
the bar before the drop, where everything stops, is the most important visual moment in the track.

A `gap` feature source: an inverted, gated envelope that rises when a stem *stops*. It costs almost
nothing on top of the existing timelines, it is only computable offline over a whole file (a live tap
cannot distinguish "silent" from "not started"), and it gives the one thing the current vocabulary
cannot express — the visual holding its breath.

### A7 · Starter states instead of a blank canvas

The activation research is unambiguous and repeats across every creative tool studied: replace the
empty state with **three to five real, editable starting points**, because most people do not know
what they want until they see something to react to.

*The tension, stated honestly:* [02-PRINCIPLES](02-PRINCIPLES.md) Principle 12 and
[01-VISION](01-VISION.md) both refuse "canned modes you pick from a grid". The distinction that
resolves it: **a starting point is not a preset if every part of it is visible and removable.** A
starter state is an ordinary state made of ordinary bricks — you can see the four objects, the six
wires and the palette, and delete any of them. A preset is a black box with knobs. The first teaches
the model; the second replaces it.

*This is also the fix if the ten-project test comes back "range without pull".*

---

## Tier B — vocabulary, now cheap because of the lines backend

All four of these fit `curves.ts`'s existing writer contract — build-time integration, deterministic
from a seed, cached by parameter signature — and are roughly a day each.

| Idea | Why it earns a place |
|---|---|
| **Strange attractors** — Lorenz, Aizawa, Thomas, Halvorsen | The trajectory *is* the drawing. Instantly recognisable, impossible to mistake for anything else in the product, and the reference implementations are twenty lines of arithmetic. Nothing in the competitive set has them |
| **Differential growth** | Points on a curve repel their neighbours and the curve subdivides where it stretches — coral, brain folds, lichen. The organic counterpart to the geometric paths already shipped |
| **Spectrum and waveform as strokes** | Element family B, the one that makes a video read instantly as *music*, arriving as polylines for a fraction of what it would cost as meshes. **Blocked by C1 below**, and that is the whole reason C1 matters |
| **Isolines from a spectrogram** | Marching squares over any 2D scalar field — and a spectrogram is one. Contours of the audio itself, as line art. The most literal possible answer to "the audio is never the shape" |

---

## Tier C — architecture

### C1 · `rebuildCost`, and the data elements it unlocks

**The most consequential idea in this document.**

[D-31](07-DECISIONS.md) forbids geometry parameters as modulation targets, because wiring a kick to
`radius` would re-tessellate an icosphere sixty times a second. That reasoning is correct for a
*mesh*. It is not correct for a 512-point polyline, whose rebuild is a few microseconds of arithmetic
into a buffer that already exists.

The rule was written when there was one backend, and it has quietly become the thing standing between
the product and **its own most on-brand element family**: a Lissajous whose phase sweeps, an
oscilloscope trace that is the actual waveform, a spectrum whose bars are this frame's FFT. Every one
of those is a stroke whose *shape parameter* has to change per frame, and every one is currently
unreachable.

*The proposal:* a brick declares `rebuildCost: 'cheap' | 'expensive'`. A cheap brick may expose
`realtime` geometry parameters; the runtime rebuilds it into a persistent, pre-allocated buffer each
frame rather than through the geometry cache. Expensive bricks keep D-31 exactly as it is.

*What has to be true:* the buffer is allocated once at the maximum point count (the pattern
`MAX_CLONES` already established), the rebuild allocates nothing, and the cache is bypassed rather
than thrashed. All three are ordinary.

*Do it when* text or the data elements are next, not before — it needs a caller to justify it.

### C2 · WebGPU and TSL — the trigger, not the date

CPU particle work bottlenecks around 50 000; WebGPU compute passes 1 000 000. Every ceiling in AURA
— 40 000 points, 20 000 line vertices, 512 clones — is a *CPU vertex pass* limit rather than a design
one, and the deformer stack is the pass in question.

**The catch is specific and expensive:** the entire fifteen-effect post chain is built on
`pmndrs/postprocessing`, which is WebGL-only. The WebGPU path is three's own TSL post-processing —
a different API — and R3F's WebGPU support still names post-processing as its rough edge. So this is
a renderer swap **plus a post-chain rewrite**, not the one-line migration the guides advertise.

*Trigger it on evidence, not on ambition:* a measured frame-rate failure from the 9C audit, or the
SDF backend, whichever comes first. Raymarching wants compute anyway, which makes 4K the natural
moment to pay for this.

*The pleasant surprise:* AURA's hardest constraint is the thing that makes it GPU-ready. A system
whose positions are `f(id, t)` with no accumulation ports to a compute shader almost mechanically —
no ping-pong state, no frame ordering, no readback. The determinism rule (HC-3) and GPU-friendliness
turn out to be the same rule.

### C3 · Fat strokes, honestly

D-114 says width is not a control because `LineBasicMaterial.linewidth` is ignored. That is true, and
it is not the whole truth: `Line2`/`LineSegments2`/`LineMaterial` give real width in pixels or world
units, with round caps and joins.

**The reason it was not used, stated properly:** that geometry is *instanced* — `instanceStart` and
`instanceEnd`, not `position` — so a deformer writing positions does nothing, and "every deformer
works on a stroke unmodified" is the property the whole backend was designed around. It also degrades
past ~1000 segments.

*The resolution, if width is wanted:* a second stroke material that rebuilds the instanced buffer
from the deformed positions each frame. It costs one copy per frame and it buys width. Offer both,
name the trade in the picker, and do not pretend the thin one is a limitation rather than a choice —
a hairline is the right medium for a figure of two hundred crossing strands.

---

## Tier D — the shape of the business

Not code. Recorded because two of the findings in the scan are about *what gets bought*, and they
change what is worth building.

**D1 · The artefact this market already pays for is a look.** Gumroad sells single After Effects and
FL visualiser templates at **$5–35**, and bundles at **$240**. That is the same money AURA's
**state** is worth — a state is a scene, its routing and its palette, and 8F already anticipates it
as a portable file. The market has been validated by other people; the product just has to make the
artefact real, which means solving [Q10](08-OPEN-QUESTIONS.md) (a rig that references object ids from
its birth project is worthless) before the first one is exported.

**D2 · Remix communities train their users.** Shadertoy and OpenProcessing are credited with having
"formed and trained many people" for one reason: the source is visible and forkable. A shared AURA
state is exactly that — not a black box, but a scene you can open, take apart and learn from. That is
the answer to the blank canvas *and* to convergence at the same time, and
[17 §3](17-EXPRESSIVE-RANGE.md) already says it only becomes worth doing once two shared states can
differ in kind. **Three backends in, they now can.**

**D3 · Price against the DAW, not against the visualiser.** Specterr is $9.99/mo for templates and
Vizzy is free; competing there is a race to a floor. This audience already pays $200–600 for a DAW
and $240 for a bundle of static templates. AURA is closer to an instrument than to a generator, and
the pricing should say so.

---

## What not to build, and why

| | |
|---|---|
| **AI generation of any kind** | It contradicts [01-VISION](01-VISION.md), and — new, from the scan — the trend has stopped rewarding it. The 1-bit revival is *explicitly* a reaction against perfect-resolution AI imagery. Being the authored tool is now both the principle and the position |
| **Gaussian splats** | Mature in the browser, genuinely impressive, and the wrong shape: splats are *captured reality*. Nothing in the product's model knows what to do with content it cannot deform, route or recolour |
| **A live/VJ mode** | Refused in 01-VISION and worth re-refusing: every architectural advantage here — offline analysis, look-ahead, out-of-order rendering, sub-frame blur — exists *because* the output is a file. A live mode would trade all of it away |
| **More post effects that are variations** | Still true, with one exception granted above: A1 is a different *kind* of image, not another glow |
