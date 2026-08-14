# 01 — Vision & Positioning

## What AURA is

A professional **audio-reactive visual NLE**. Musicians and producers load their own
stems, route each stem's musical character to parameters of a 3D scene, direct a
camera through that scene by hand, cut between visual states on a timeline like a
video editor, and render a finished video.

## What AURA refuses to be

- **Not a preset player.** No canned "modes" you pick from a grid. Everything is
  built from generic, recombinable parts. (See Principle 12.)
- **Not AI-generated.** Nothing predicts, prompts, or auto-composes. The camera in
  particular is a *craft* — you direct it. This is a stated product principle, not
  a v1 limitation.
- **Not a VJ tool.** No DMX, no NDI/Spout, no multi-projector rigs in v1. Those
  serve live performers; AURA serves people rendering a file.

## The white space

Nothing on the market combines all of:

- Multi-track **stem** routing, not a single mixed file
- A weighted **N:1 modulation matrix** — 50% guns + 25% drums + 25% atmosphere → one parameter
- An **NLE-style state timeline** — cut between scenes, not one continuous automation curve
- **Manual 3D camera keyframing**, treated as cinematography
- Built for **musicians and producers**

High-ceiling tools (TouchDesigner, Notch) are too hard for musicians. Tools built for
musicians (Freebeat, NeuralFrames, AE template packs) are too shallow or too automated.
AURA sits in that gap.

## Primary audience: type-beat / trap-drill producers

The strongest finding in the market research, and an unconscious fit — the original
note dump's stem list (kick/snare, hats, "guns", "fakeouts", sub, extra gun layers) is
literally trap-beat stem vocabulary.

They already think in stems (that's how beats get built), upload weekly, and are
currently served only by static After Effects templates ($16–$30 on Gumroad) and
one-click tools. What follows from that audience:

| Need | Consequence for the product |
|---|---|
| "One visual system, many beats" | **Reusable rigs are a business model, not a feature.** A rig (camera path + scene + routing + palette) must be a saveable unit smaller than a project. |
| Weekly upload cadence | Batch rendering matters. Throughput over one-off polish. |
| YouTube + Shorts/TikTok | Horizontal and vertical export from one render. |
| Channel identity | A recognizable look per producer is a discoverability growth loop worth marketing. |

**v1 scoping rule:** target people who **already own their stems**. Users with only a
finished mixed MP3 need AI source separation (Demucs-class) — a genuinely harder,
different problem, deliberately deferred.

> **Revised 2026-08-14 — this rule has expired.** Demucs v4 exported to ONNX now runs **entirely in a
> browser tab**, separating a four-minute song in three to five minutes with no server and no upload
> ([19 §3](19-RESEARCH-2026.md)). It is an offline analysis step of exactly the shape the MIR worker
> already is, not a different problem. Meanwhile a competitor separates into eight stems and maps
> them to visual controls, which is this document's own sentence.
>
> The deferral was correct when written and is now the product's largest onboarding barrier: the
> thesis is per-stem routing, and it currently asks the user to arrive already holding stems. See
> [20 §S1](20-OPPORTUNITIES.md).

## Secondary audiences (not v1)

Bedroom/live electronic producers · streamers and DJs (would want a live session mode) ·
church/worship AV (completely unserved, but an entirely different sales motion).

## Positioning

- **The AI-generation wave is validation, not a threat.** It proves large appetite for
  "music becomes video." AURA is the manual, high-ceiling alternative for people who
  currently have *no* accessible manual option.
- **"You direct it. Nothing auto-generates for you."** Academic virtual-cinematography
  research is moving toward AI-automated camera control, which makes deliberate manual
  authorship close to contrarian in 2026 — worth stating outright, not downplaying.
- **Updated 2026-08-14 — it is no longer contrarian, it is a trend.** Dither-effect interest is up
  ~900 % year on year and the trend writing states the reason outright: 1-bit and hand-made
  aesthetics are **a deliberate counter-move to perfect-resolution AI imagery**. Motion-design
  surveys for 2026 lead with *authenticity over polish*. The founding principle and the market
  moved into alignment without the principle changing ([19 §4](19-RESEARCH-2026.md)).
- **The competitors' reviewers write our positioning for us.** The recurring criticism of the AI
  tools is sync precision and control — "a vibe match rather than precise beat synchronisation",
  "hits a ceiling quickly", "limited customization for users who want fine-grained control over
  every frame". Those are the three axes a deterministic, per-parameter, per-stem tool wins on.

## Pricing signals

*Revised from the 2026-08 scan ([19 §1](19-RESEARCH-2026.md)); the previous figures were one tier
too high for the volume end of this market.*

| Comparable | Price | What it says |
|---|---|---|
| **Specterr** Pro | **$9.99/mo** ($99.99/yr) | The template floor. Free tier: 3 videos/month, watermarked, 720p |
| **Vizzy** | free, no watermark, no cap | There is a zero-price competitor. Do not compete on price |
| AI music-video tools | $20–50/mo | Where the "generated" category sits |
| **Gumroad AE/FL template packs** | **$5–35** each · **$240** bundles | The market already pays this for *one look*. That is what a portable AURA state is worth (see [20 §D1](20-OPPORTUNITIES.md)) |
| DAWs — the mental model this audience prices against | **$200–600** perpetual, or $10–40/mo | AURA is closer to an instrument than to a generator, and should be priced like one |
| TrackAura (bootstrapped, DAW-inspired) | $19.99 flat | Small, but it validates *"make video creation feel like my DAW"* as a sellable pitch |

---

*Source material: `research/01-market-research-and-positioning.md` (2026-07, frozen) and
[19-RESEARCH-2026.md](19-RESEARCH-2026.md) (2026-08, current — supersedes the frozen scan wherever
they disagree).*
