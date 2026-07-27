# AURA Studio — Market Research & Positioning

> Context doc for coding AI + founder reference. Captures competitive landscape,
> target audience research, and positioning conclusions reached during ideation.

## 1. The two worlds of "real-time visuals" software

The space splits into two camps that barely overlap:

### World 1 — Live performance / VJ tools
- **TouchDesigner** — node-based, generative/interactive/sensor-driven, extremely
  high ceiling, notoriously brutal learning curve (feels like backend coding, no
  cohesive learning path).
- **Resolume Arena** — the safe, ubiquitous choice for live VJ/DJ events. Wins on
  "just works, drag and drop, no patching required" — ease of use over raw power.
- **Notch** — arena-scale, Broadway-tier work. Parametric deformers exposed as
  sliders on top of a node graph underneath.
- **MadMapper, VDMX** — projection mapping and live-mixing focused.

These tools assume: multi-projector rigs, DMX lighting, NDI/Spout video routing
between apps, MIDI controllers, a live audience. They are built for **VJs**, not
musicians/producers.

### World 2 — Release-content tools for musicians
Two sub-camps, both recent:
- **AI generators** (Freebeat, Kaiber) — analyze BPM/onset/energy/song structure,
  auto-produce a beat-synced video. Prompt-and-regenerate workflow, shallow
  creative ceiling, fast output.
- **Stem-reactive visualizers** — **NeuralFrames** is the closest existing product
  to AURA's core idea: separates a song into drums/bass/vocals/melody/etc. and
  maps each stem to visual movement/effects. Still AI-generation-first, not a
  hands-on 3D-scene-builder with manual camera control.

### Adjacent, mostly-untouched categories
- **Streaming visualizers** (vizz.fm, Visuval, Serato Twitch overlays) — shallow,
  waveform/bars-level reactivity to fill dead air during DJ streams. Not a
  creative statement, not stem-aware.
- **Church/worship AV** (ProPresenter, EasyWorship, MediaShout) — entirely
  lyric-and-loop focused. Churches literally *buy* prebuilt "worship motion" loop
  videos from stores (e.g. Worship House Media). Zero audio-reactivity, zero
  stem-awareness. Completely unserved by generative audio-reactive visuals.

## 2. The white space AURA occupies

Nobody found in research combines all of:
- Multitrack **stem** routing (not single mixed file)
- Weighted **N:1 modulation matrix** (50% guns + 25% drums + 25% atmosphere → one param)
- **NLE-style state timeline** (cut between scenes like video editing, not one
  continuous automation curve)
- **Manual, hands-on 3D camera keyframing** — explicitly not AI-generated,
  not predictive. Positioned as a craft, like a real cinematographer.
- Built **for musicians/producers**, not VJs, not AI-prompt users.

Manual/high-ceiling tools (TouchDesigner, Notch) are too hard for musicians;
tools made for musicians (Freebeat, template packs) are too shallow/automated.
AURA sits directly in that gap.

## 3. Who's actually left behind (ranked by how underserved they are)

### 1. Type-beat / trap-drill producers — the strongest, most surprising finding
A massive, extremely active YouTube content economy (BeatStars, Airbit,
thousands of weekly uploads). Currently served only by:
- Static After Effects templates (Trapcode Particular-based packs — "Grotesk,"
  "TrapWix," $16–$30 on Gumroad)
- One-click tools like TunesToTube
- FL Studio's built-in basic visualizer

None of these offer real per-stem audio routing, 3D, or camera control.

**Notable unconscious fit**: the original note dump's stem list — kick/snare,
hats, "guns," "fakeouts," sub, extra gun layers — is literally trap-beat stem
vocabulary. This audience already thinks in tracks/stems (that's how they build
beats), uploads weekly (needs speed + reusable templates), and explicitly wants
"one visual system, many beats" (per market research into type-beat channel
needs) — i.e. **reusable presets/rigs are a business model for this audience,
not just a feature.**

Practical needs specific to this audience:
- Horizontal + vertical export **simultaneously** (YouTube + Shorts/TikTok)
- Batch rendering (queue many tracks, come back to many finished videos)
- A recognizable visual identity per channel (helps with YouTube feed
  discoverability — a built-in growth loop worth marketing directly)

### 2. Church/worship AV volunteers
Different buyer profile entirely: non-technical, small individual budget but
often real institutional tech funds. Completely unserved by
generative/audio-reactive tools — this is a possible secondary market, not a v1
target (different sales motion, different feature priorities — lyrics/scripture
overlay likely matters more than audio-reactivity here).

### 3. Bedroom/live electronic producers
Want NeuralFrames-style stem control but with actual manual authorship instead
of AI-generate-and-pray.

### 4. Streamers/DJs doing live sets
Stuck with shallow waveform visualizers. A lighter/live-performance mode of
AURA (session-view style, see tech docs) could serve this as a stretch goal —
not core v1.

## 4. Pricing & demand signals found
- Indie-tier "audio-structural" AI video tools: **$20–$50/month**
- Premium tiers of the same category: **$200+/month**
- TrackAura (bootstrapped, DAW-inspired interface pitched specifically at
  producers "without the steep learning curve of video editing software"):
  **$19.99** flat — small, but validates "make video creation feel like my DAW"
  as a sellable pitch.

## 5. Strategic positioning conclusions

- **The AI-generation wave is validation, not a threat.** It proves large
  appetite for "music becomes video automatically" — AURA is positioned as the
  manual, high-ceiling alternative for people who currently have *no* accessible
  manual option, not as a contrarian bet against AI tools.
- **"You direct it, nothing auto-generates for you"** is a legitimate marketing
  angle — academic/industry research on virtual cinematography is moving toward
  AI-automated camera control, making deliberate manual authorship a
  differentiator worth stating outright, not downplaying.
- **Scope v1 to people who already own their stems** (producers rendering from
  their own DAW) — explicitly *not* signed artists who only have a final mixed
  single. Serving the latter requires AI stem-separation (Demucs-style), a much
  harder, different problem, and a deliberate v2+ decision, not a v1 requirement.
- **Primary go-to-market candidate: type-beat/trap producers.** Existing
  distribution channel (YouTube SEO, BeatStars), existing habit of buying visual
  templates, existing stem-based workflow, weekly output cadence that rewards a
  reusable-rig business model.
