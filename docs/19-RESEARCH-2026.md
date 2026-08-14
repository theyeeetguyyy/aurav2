# 19 — Landscape scan, August 2026

> **External facts only, dated.** What the market looks like, what the platforms require, and what
> the browser can now do. Nothing here is a decision — the decisions this scan produced are in
> [20-OPPORTUNITIES.md](20-OPPORTUNITIES.md), and the ones already locked are in
> [07-DECISIONS.md](07-DECISIONS.md).
>
> The frozen 2026-07 material in `research/` is the previous scan. **This supersedes it on every
> point where they disagree**, and several disagree — most importantly the one about stem separation.
>
> *Scanned 2026-08-14. Re-scan before any strategic decision made after roughly February 2027; three
> of the findings below have a shelf life measured in months.*

---

## 1 · The competitive set, and where each one stops

| Tool | Model | Price | Where it stops |
|---|---|---|---|
| **Specterr** | Template visualiser, browser | Free (3/mo, watermark, 720p) · **$9.99/mo** Pro · $49.99/mo Enterprise | Presets with colour options. The output space is the template set |
| **Vizzy** | Template visualiser, browser | Free, no watermark, no export cap | Same shape, no revenue model to fund depth |
| **Neural Frames** | AI diffusion + audio reactivity | ~$20–50/mo | **Separates a track into eight stems and maps them to visual controls.** The closest thing to AURA's thesis on the market |
| **Kaiber** | AI diffusion, style-led | subscription | *"Audio reactivity is basic — more of a vibe match than precise beat synchronisation."* No lyric sync. No character consistency |
| **Freebeat** | Full-song auto-generation | subscription | Analyses BPM, onsets and energy, then generates. Nothing to author |
| **TouchDesigner / Notch** | Node-based pro tools | free tier / seat licences | Ceiling is unlimited; the floor is a career. Not for musicians |
| **cables.gl** | Browser node editor, open source | free | Genuinely capable and genuinely a programming environment |
| **Hydra / Butterchurn / MilkDrop** | Live-coded or preset visual synths | free | Live performance, not a rendered file. Butterchurn is the Winamp lineage |
| **AE / FL template packs** | Files on Gumroad | **$5–35 each, $240 bundles** | Static. One look, per purchase, per producer |
| **ZGameEditor Visualizer** | Ships inside FL Studio | free with FL | *A 50 MB video can consume 6 GB of RAM.* Most producers already have it and most do not use it twice |

**Three readings of that table.**

1. **The middle is empty and the edges are crowded.** Everything is either a template with knobs or
   a programming environment. [01-VISION](01-VISION.md)'s white-space claim survives this scan intact.
2. **Neural Frames is the one to watch**, and it is not a template player — it separates stems and
   maps them, which is AURA's sentence. It differs in *what the mapping drives*: a diffusion model,
   not a scene you built. That is a real difference (theirs cannot be re-rendered deterministically,
   ours cannot invent a face) but it is a difference in kind, not a moat.
3. **The AI tools' weakness is named repeatedly in their own reviews: sync precision and control.**
   "Vibe match", "hits a ceiling quickly", "limited customization for users who want fine-grained
   control over every frame". Those are the exact axes a deterministic, per-parameter, per-stem tool
   wins on, and they are being written by the reviewers rather than by us.

**Pricing reality, revised.** [01-VISION](01-VISION.md) quoted $20–50/mo from the previous scan. The
volume end of this market is **$9.99/mo**, and the artefact end is **$5–35 one-off**. DAWs — the
mental model this audience actually prices against — are $200–600 perpetual or $10–40/mo.

---

## 2 · Platform requirements the product must satisfy

Concrete numbers, all verified across several 2026 sources.

### Spotify Canvas

| | |
|---|---|
| Aspect | **9:16**, 720×1280 min, 1080×1920 max |
| Length | **3–8 seconds**, hard — 8.5 s is rejected |
| Format | MP4 or JPG. Not MOV, GIF, PNG or WebM |
| Audio | **None**. Strip it |
| Behaviour | **Loops forever.** Most artists use the full 8 s so the repetition reads less |
| Volume | **One per track** — a ten-track album needs ten |

### Vertical safe zones (TikTok / Reels / Shorts)

| | |
|---|---|
| Canvas | 1080×1920 |
| **Cross-platform safe area** | **900×1400, centred** — guaranteed visible everywhere |
| TikTok | ~130–140 px clear at top, ~400–484 px at bottom, ~140–180 px on the right for the action rail |
| Reels | Worst bottom, ~500 px |
| Shorts | ~320 px bottom |
| Text | 60–80 pt minimum on mobile, 2–3 lines maximum, outlined for contrast |

Anything in the right third or the bottom quarter is at risk on at least one platform.

---

## 3 · What the browser can do now that it could not

This is the section with the shortest shelf life and the largest consequences.

### Stem separation runs locally, in a tab

Demucs v4 exported to ONNX runs under WebAssembly, and with WebGPU acceleration, entirely
client-side. **A four-minute song separates in three to five minutes with no server and no upload.**
Models are published (`htdemucs`, `htdemucs_ft`, 4-stem; `htdemucs_6s` adds guitar and piano) and
working browser demos exist.

[01-VISION](01-VISION.md) defers this as "a genuinely harder, different problem". **That was true
when it was written and is no longer true.** It is now a dependency, a worker and a progress bar.

### Whisper transcribes at 5–8× real time in the browser

Transformers.js with WebGPU runs Whisper-base entirely client-side; WhisperX-style forced alignment
gives **sub-100 ms word timestamps**. Browser-based lyric-video tools built on exactly this shipped
during 2026, and lyric sync is a gap the AI video tools are being criticised for.

### WebGPU is no longer a bet

Three.js r184+ ships **TSL** as a first-class shading language that compiles to GLSL for WebGL and
WGSL for WebGPU from one source. Coverage is ~95 % with automatic WebGL2 fallback. The number that
matters for this product:

> **CPU particle updates bottleneck around 50 000. WebGPU compute pushes the same work past
> 1 000 000.**

AURA's own ceilings — 40 000 points, 20 000 line vertices, 512 clones — are all *CPU vertex pass*
limits, not design limits.

**The catch, and it is specific:** `pmndrs/postprocessing`, which AURA's entire 15-effect chain is
built on, is a **WebGL library**. The recommended WebGPU path is three's own TSL post-processing,
which is a different API. R3F's WebGPU support is "still maturing as of Q2 2026", with post-
processing named as the rough edge. So the migration is not the advertised one-line renderer swap
for this codebase; it is a renderer swap **plus a rewrite of the post chain**.

### Codecs

AV1 encode is well supported on desktop Chromium and gives 30–50 % better quality per bit than VP9;
VP9 is as universally supported as H.264; H.264 works everywhere. AURA ships H.264 + AAC, which
remains the correct default and is no longer the only sensible option.

---

## 4 · Aesthetic trends, and one that is strategically loaded

From motion-design trend surveys and the tooling that appeared in 2026:

- **Typography motion is a core style**, explicitly named in the music-video context: letters
  stretching, breaking apart, reforming, reacting to sound.
- **Authenticity over polish.** "Emotion beats spectacle"; imperfection reads as trustworthy.
- **Generative and coded motion is mainstream** — ASCII visualisations, reactive physics, custom
  particle flows appearing in commercial branding rather than only in demos.
- **Mixed 2D/3D** — 3D space with 2D linework over it, which is precisely the surfaces-plus-strokes
  combination the lines backend just made possible.
- **1-bit, dither, halftone, riso, Game Boy.** Dither-effect searches are up **~900 % year on year**,
  and the trend pieces state the reason outright: it is **a deliberate counter-move to
  perfect-resolution AI imagery**.

That last one is not a shader idea, it is a positioning fact. The market is actively developing an
appetite for work that is visibly *made* rather than generated, at the same moment AURA's founding
principle — [01-VISION](01-VISION.md)'s "nothing predicts, prompts, or auto-composes" — went from
contrarian to fashionable.

---

## 5 · Techniques worth stealing, with their catch

| Technique | Status | The catch |
|---|---|---|
| **troika-three-text** | The answer for text. Parses `.ttf`/`.otf`/`.woff` directly, generates an SDF atlas on the fly **in a worker**, real kerning and ligatures and RTL, and works with three's ordinary materials — so lighting, shadows and fog come free | It is *flat* SDF text. "Extruded 3D text", which is what this audience asks for, needs a separate extrusion path — `TextGeometry` tessellates and scales badly, `three-text` (countertype) is the newer contender |
| **Line2 / LineSegments2 / LineMaterial** | Real line width, in pixels or **world units**, with round caps and joins | Geometry is *instanced* (`instanceStart`/`instanceEnd`), so a deformer writing `position` does nothing. **Fat lines and deformers-on-strokes are mutually exclusive** without a per-frame rebuild. Performance also degrades past ~1000 line segments. `Line2NodeMaterial` is the WebGPU equivalent |
| **Differential growth** | Points on a curve repel neighbours and the curve subdivides where it stretches — coral, brain folds, lichen | Iterative and stateful. Build-time only, exactly like the flow path |
| **Strange attractors** (Lorenz, Aizawa, Thomas, Halvorsen) | Integrate a chaotic system; the trajectory *is* the drawing. One reference implementation renders ~127 M points | Integrated, so build-time. **Its parameters are the interesting modulation targets and they are the ones that force a rebuild** |
| **Marching squares / isolines** | Contours of any 2D scalar field, as lines or filled bands | Needs a field to contour. A spectrogram is one |
| **Gaussian splats** | Mature in the browser in 2026; three.js gained SH1–SH3 view-dependent colour in August 2026, and several viewers exist | It is *captured* content, not authored. Wrong shape for this product until there is a reason to import reality |
| **OKLCH / Oklab** | The modern standard for palette work: equal lightness numbers actually look equally bright, and interpolation gives a vivid midpoint where sRGB gives mud | Nothing but a conversion. AURA's `paletteRamp` already admits sRGB mixing is wrong, and `shiftHue` in HSL changes apparent brightness as it rotates |
| **Chromagram → key/chord** | 12-bin projection compared against 24 key profiles; a JS binding of Stark's detector exists, and a 2025 paper builds a near-real-time key visualiser | Chord detection is noisy on dense mixes. **Per stem it is far easier**, and AURA has stems |
| **Blender's fields model** | Attributes carry per-element data; a field evaluates differently at every element. It is why geometry nodes beat a modifier stack | AURA's `Field` already means a control signal — [08-OPEN-QUESTIONS Q4b](08-OPEN-QUESTIONS.md) flags the collision. Adopting per-element fields makes resolving that name urgent |

---

## 6 · Two findings about how people are convinced

- **The blank canvas is the activation problem**, consistently, across creative tools. *"Most users
  do not know what they want to build until they see something to react to."* The repeated advice is
  to replace the empty state with three to five real, editable starting points — not a tour, not a
  tooltip.
- **Remix communities train their own users.** Shadertoy and OpenProcessing are cited as having
  "formed and trained many people" precisely because the source is visible and forkable. The
  commercial version (fx(hash)) adds earnings and visibility for newcomers.

Both bear directly on the [ten-project test](18-TEN-PROJECT-TEST.md)'s "range without pull" outcome:
if the software can make ten different things but every user makes the same one, this section is
where the fix lives, not in another backend.

---

## Sources

Market and pricing — [Specterr pricing](https://www.saasworthy.com/product/specterr) ·
[Specterr review](https://www.toolworthy.ai/tool/specterr-music-visualizer) ·
[Neural Frames — stems](https://neuralframes.com/post/stems-in-music-what-they-are-and-how-neural-frames-extracts-them) ·
[AI music video generators compared](https://www.neuralframes.com/post/10-best-ai-music-video-generators-for-creative-control-2026) ·
[Kaiber review](https://resource.digen.ai/review-of-kaiber-ai-video-generator-2026/) ·
[Best audio-to-video visualisers 2026](https://freebeat.ai/articles/best-audio-to-video-visualizers-for-music-creators-in-2026) ·
[VJ software comparison 2026](https://autovj.club/en/guide/vj-software-comparison/) ·
[ZGameEditor RAM complaint](https://forum.image-line.com/viewtopic.php?t=268850) ·
[Gumroad template pricing](https://anotherxlife.gumroad.com/) ·
[DAW price guide 2026](https://dj.studio/blog/daw-price-guide-subscriptions-student-deals)

Platform specs — [Spotify Canvas specs](https://www.velveteen.fm/guides/spotify-for-artists/spotify-canvas) ·
[Canvas size guide](https://makecanvas.me/spotify-canvas-size) ·
[Safe-zone hub 2026](https://kreatli.com/guides/safe-zone-guide) ·
[TikTok safe zone](https://creamate.ai/en/blog/tiktok-safe-zone-guide)

Browser capability — [Demucs in the browser](https://github.com/timcsy/demucs-web) ·
[demucs-onnx](https://pypi.org/project/demucs-onnx/) ·
[Local browser stem separation](https://earezki.com/ai-news/2026-04-24-i-ran-a-neural-network-in-a-browser-tab-to-split-a-song-into-stems/) ·
[Whisper WebGPU in-browser](https://whisperstt.com/blog/transcribe-audio-in-browser/) ·
[WhisperX word timestamps](https://localaimaster.com/blog/whisperx-guide) ·
[Three.js WebGPU migration checklist](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) ·
[WebGPU compute particles](https://threejsroadmap.com/blog/introduction-to-webgpu-compute-shaders) ·
[three.js WebGPU & node materials](https://deepwiki.com/mrdoob/three.js/3.5-webgpu-and-node-based-materials) ·
[Codec analysis 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/) ·
[MDN codec selection](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection)

Trends and technique — [Motion design trends 2026](https://elements.envato.com/learn/motion-design-trends) ·
[Video & motion creative trends 2026](https://graphicdesignjunction.com/2026/01/video-and-motion-creative-trends-2026/) ·
[Dithering guide & the 900 % figure](https://www.ascii-magic.com/blog/complete-guide-to-dithering) ·
[Real-time ASCII and dithering with WebGL](https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders/) ·
[troika-three-text](https://github.com/protectwise/troika/tree/main/packages/troika-three-text) ·
[three.js LineMaterial](https://threejs.org/docs/pages/LineMaterial.html) ·
[Differential growth](https://medium.com/@Jamesroha/differential-growth-in-blender-225c284ed5aa) ·
[Strange attractors, audio-reactive](https://www.kinnytools.com/lorenz-attractor.html) ·
[Marching squares](https://en.wikipedia.org/wiki/Marching_squares) ·
[Gaussian splatting in three.js](https://github.com/mkkellogg/GaussianSplats3D) ·
[Oklab / OKLCH](https://en.wikipedia.org/wiki/Oklab_color_space) ·
[OKLCH for palettes](https://colors.jarhalab.com/wiki/oklch-color) ·
[Chord detector & chromagram](https://github.com/adamstark/Chord-Detector-and-Chromagram) ·
[Scriabin's colour–key system](https://en.wikipedia.org/wiki/Chromesthesia) ·
[Blender attributes and fields](https://code.blender.org/2021/08/attributes-and-fields/) ·
[Perfect loops in GLSL](https://shadergif.com/guides/how-to-make-a-perfect-loop/) ·
[Looping noise](https://www.simonaa.media/tutorials/looping-noise-part-1) ·
[Rhythmic editing](https://www.skillmanvideogroup.com/rhythmic-editing/) ·
[Blank-canvas activation](https://www.fishmanafnewsletter.com/p/how-ai-products-drive-adoption-in-onboarding-through-template-activation-loop) ·
[fx(hash) and remix culture](https://www.rightclicksave.com/article/the-emergent-artists-of-fx-hash-interview-generative-art)
