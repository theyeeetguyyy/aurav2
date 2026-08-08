# 17 — Expressive range

**The problem this document exists for:** give AURA to ten people and eight of them will make
the same thing — wireframed cloned shapes, routed to a stem, with a little post-processing.

That is not a UI problem and it is not a taste problem. It is a **range** problem, and it is the
one thing that decides whether this is a tool or a demo. Nothing else in the backlog matters until
it is fixed, because a tool that can only make one image does not need better keyboard shortcuts.

*Written 2026-08-07, after driving the software end to end.*

---

## 1 · Why everyone converges

Not because the vocabulary is small. Because it has **one mode**.

### There is exactly one way to put a pixel on screen

```ts
export type RenderBackend = 'mesh' | 'sdf' | 'points'
```

Three declared. **One implemented.** Every visual in the product is a lit triangle mesh, optionally
duplicated, optionally filtered on the way out.

[10-ELEMENTS.md](10-ELEMENTS.md) designs eight element families. Four exist — geometry,
environment, light, post — and all four resolve to *lit mesh* or *full-frame filter*. The four
missing ones are precisely the ones that would produce a **different kind of image**:

| Family | Status | What its absence costs |
|---|---|---|
| A · Geometry | ✅ 10 primitives, 7 materials, deformers, cloners | — |
| B · Data-driven geometry | ⬜ | No spectrum, no waveform-as-form. The audio is never *the shape* |
| C · Particles | ⬜ | No clouds, no swarms, no dissolve. Multiplicity only ever reads as an array |
| D · Fields / raymarched | ⬜ | No metaballs, tunnels, infinite repetition. Nothing that is not a surface |
| E · Environment | ✅ | — |
| F · Light | ✅ | — |
| G · Overlay / text | ⬜ | No type. For this audience that is not a gap, it is a hole |
| H · Post | ✅ 15 effects, 5 groups | — |

### The output space, written out

Everything anyone can currently make is a point in:

```
{10 primitives} × {deformers} × {regular array} × {one accent colour} × {bloom, kaleidoscope, grade}
```

Four observations about that space:

1. **Multiplicity is always a lattice.** Cloners distribute on grids, radials and spirals. Every
   one is regular, so an array always reads as an array — which is the single loudest "made in a
   toy" signal there is.
2. **Colour is incidental, not authored.** One colour per object from a rotating palette, over a
   near-black background, under one default rig. Every scene is therefore *an accent colour on
   dark*, and the palette rotation makes that true even when the user has made no colour decision
   at all.
3. **Three post effects dominate.** Bloom, kaleidoscope and grade are the three that read best, so
   they are the three everyone will reach for. The other twelve are variations nobody arrives at.
4. **The centre of mass of that space is exactly the predicted output.** "Wireframed cloned shapes
   with a bit of post" is not a failure of the space — it *is* the space, described.

### The claim in the docs that is wrong

[10-ELEMENTS.md](10-ELEMENTS.md) §"Why it will not look like everyone else's" argues from
combinatorics: no presets to pick from, and the stack is per-project, so the combinations are large
enough for individual identity.

**That reasoning does not hold.** Combinations of a narrow vocabulary are still narrow. Ten
thousand permutations of "lit mesh + filter" are ten thousand things that look like each other.
Variety needs different *kinds* of image, not more arrangements of one kind. The section is
corrected in place; this document replaces its argument.

---

## 2 · The bar

"Good and different" has to be falsifiable or it is a mood. So:

> ### The ten-project test
>
> Ten projects, same stem, each built in about fifteen minutes by the shortest path a new user
> would actually take. It passes when:
>
> 1. **Distinguishable** — a stranger shown one frame from each can tell all ten apart.
> 2. **None embarrassing** — every one is something its author would post.
> 3. **At least four distinct image families** across the ten — not ten variations of one look.

Today it fails (1) and (3), and passes (2) — which is the honest shape of the situation. The
floor is fine. There is barely a ceiling, and the room is narrow.

Run it after every pass below. It is cheap, it is the only measure that matters, and it is the
thing that will say when to stop widening and start polishing.

---

## 3 · The levers, ranked by variance per unit of work

### Pass 1 · Colour and light as things you author

**Cheapest, and it changes every single frame.**

Today: one colour per object, one default three-point rig, a near-black background. A user who
makes no colour decision gets *the same palette as everyone else* — and most users make no colour
decision, because nothing invites one.

What it needs:

- **A scene palette.** A small ordered set of colours belonging to the state, not to each object.
  Objects take a slot. Changing the palette re-colours the whole scene at once, which is the edit
  people actually want to make.
- **Gradients across multiplicity.** A cloner array should be able to ramp across the palette. This
  alone turns a lattice from "the same object repeated" into something composed.
- **Colour from signal.** Hue and emission as routing targets, so the drop changes the colour of
  the piece and not merely its size.
- **Environments that are not near-black.** Gradient skies, two-tone rigs, coloured fog. The
  background is the largest area of every frame and it is currently the least authored.

*How we will know:* two projects with identical geometry and routing look like different pieces.

### Pass 2 · The points backend

**Doubles the medium. `points` is already in the type union and nothing implements it.**

Any geometry becomes a cloud; a cloud is not a surface, and that is the whole point. Dissolve,
swarm, sparkle, sand, smoke-adjacent. It is the single largest jump in kind available.

It must stay a **pure function of `(id, t)`** — position computed, never accumulated. That is what
[D-49](07-DECISIONS.md) actually rejected: particle *libraries*, all of which integrate
`position += velocity·dt` and therefore cannot survive an out-of-order offline render. A stateless
point system has no such problem and was always the intended answer.

*How we will know:* a point-based project and a mesh-based project are not mistakable for each other.

### Pass 3 · Structure that is not a lattice

**Kills the loudest tell in the current output.**

Cloners place on grids. Add distribution by noise, curl-noise flow, surface scatter, and
audio-driven density. Same objects, same count — completely different read, because the eye stops
seeing a lattice and starts seeing a form.

*How we will know:* an array of 200 objects no longer looks like an array of 200 objects.

### Pass 4 · Lines and ribbons

Cheap once points exist: trails, contours, connections between neighbours, wire-as-content rather
than wire-as-debug-view. A third image family for a fraction of the second one's cost.

### Pass 5 · The SDF backend

The "not a mesh" family — metaballs, tunnels, infinite repetition, domain warping. The most
distinctive of all of them and the most work, which is why it is fifth and not first.

### Pass 6 · Text

The clearest unmet need for this audience. A music visual without type is a category, not a choice,
and right now it is the only category available.

### Then, and only then · Shareable states

The state-as-portable-artefact idea is the **real** long-term answer to convergence: divergence
comes from other people's starting points, not from our defaults. But it is worth nothing until
passes 1–5 make the space wide enough that two shared states differ in kind. A marketplace of
lit-mesh-with-bloom presets would just make the sameness distributable.

---

## 4 · What is deliberately *not* next

Both of these are real, and both would be the wrong thing to do now.

**Interaction craft — gizmos, drag-to-scrub, hover feedback, motion.** Diagnosed honestly: every
control in the app is a slider, a number field or a list row, and you manipulate descriptions of
things rather than the things. That is why it reads as a prototype next to Notch and TouchDesigner.
It is also true that fixing it makes a *narrow tool pleasant*, and the narrowness is the problem
that decides whether the tool is worth using at all. Polish after range, not before — a beautifully
operable one-trick tool is still a one-trick tool.

**More post effects, more primitives.** Both add permutations inside the single existing image
family. They feel like progress and move nothing.

---

## 5 · What is already strong

Worth stating, because the range problem is not a verdict on the whole system and the passes above
depend on all of it:

- **Deterministic export.** Frames are stepped from a `FrameClock`; two exports of a project are
  the same file. Verified against decoded pixels, not asserted.
- **The modulation matrix.** Addressed parameters, weighted N:1, shared processors, pure functions
  of `t` throughout. Every widening pass gets audio-reactivity for free because of it.
- **Clips over patterns.** Draw once, place anywhere, repeat, share. Any new parameter any new
  backend exposes is automatable the day it exists.
- **States that own their scenes.** The unit of authorship, and the unit of sharing.
- **One renderer, one scene.** Preview is what renders, by construction.

The engine is not the problem. **The vocabulary is.**

---

## 6 · Sequencing

| Pass | What | Why here |
|---|---|---|
| 1 | Colour & light authoring | Cheapest, touches every frame |
| 2 | Points backend | Second image family; the biggest jump in kind |
| 3 | Non-lattice structure | Removes the loudest "toy" tell |
| 4 | Lines & ribbons | Third family, cheap after points |
| 5 | SDF backend | Most distinctive, most work |
| 6 | Text | Unmet need for the audience |
| — | Ten-project test | After every pass, without exception |
| 7 | Interaction craft | Once the room is wide enough to be worth furnishing |
| 8 | Shareable states | Once two shared states can differ in kind |
