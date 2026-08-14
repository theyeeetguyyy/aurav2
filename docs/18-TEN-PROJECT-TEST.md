# 18 — The ten-project test

> The bar is stated in [17-EXPRESSIVE-RANGE §2](17-EXPRESSIVE-RANGE.md). This is the **protocol** —
> how to actually run it, what to capture, how to score it, and where each kind of finding goes
> afterwards. No guide existed until now, which is part of why it had not been run since Pass 2.

**What it measures:** not whether AURA can make something good. It measures whether **ten people
would make ten different things**, which is the question that decides if this is a tool or a demo.
One person cannot literally be ten people, so the protocol substitutes constraints and a timer for
ten separate heads — see §3 for why that substitution is honest, and where it is not.

**Time:** about three hours, splittable across two sittings. Do the free run in one sitting.

---

## 1 · Before you start

| Need | Why |
|---|---|
| **One stem set, ~20 seconds long** | Every project uses the *same* audio, or you are measuring the music and not the software. Twenty seconds keeps ten exports fast and is still long enough for a build and a drop |
| **A folder per run** — `runs/2026-08-13/` | Ten `.aura.json` files, ten MP4s, ten stills, one record sheet. A finding you cannot reopen is an anecdote |
| **A timer** | Fifteen minutes, visible, per project |
| **A stranger, eventually** | Criterion 1 needs someone who did not build them. A housemate and thirty seconds is enough. Failing that, wait a full day and look again — same-day self-judgement always passes and always lies |

Trim the stem so the project is about twenty seconds before you start project 1, and never touch the
audio again.

---

## 2 · Rules that keep it honest

1. **Fifteen minutes, hard.** When the timer goes, you export what you have. A project rescued in
   overtime tells you nothing about the shortest path.
2. **No project is abandoned.** A bad one is *criterion 2 data* — the whole point is to find out
   whether the floor holds when someone is rushing.
3. **Start each one from an empty project.** No duplicating the last, no reusing its palette, no
   copying its wires.
4. **Reach for what you would actually reach for.** Do not deliberately use an obscure brick to make
   the numbers look better. If your hand goes to Bloom every time, that is the finding.
5. **Write the friction line before you export.** One sentence: *what did you want and not get?*
   This is the single most valuable output of the whole exercise and it evaporates in ninety seconds.
6. **Do not fix bugs mid-run.** Note them. Fixing one changes the software under the test.

---

## 3 · Two decks, and why

Splitting the ten is the one methodological change this protocol makes to the bar as written, and it
exists to stop the test grading its own homework.

**Deck A · The free five (projects 1–5).** No constraints at all. This measures the **centre of
mass** — what the software pulls you toward when nothing pushes. The original complaint was "ten
users, eight similar outputs", and only an unconstrained run can measure that.

**Deck B · The constrained five (projects 6–10).** One card each, drawn in order. This measures
**reachability and friction** — can the space produce these at all, in fifteen minutes, without
fighting? A card never names a brick or a look; it names a property of the result.

Scoring follows from that split, and the split matters:

- **Criteria 1 and 2 are judged across all ten.**
- **Criterion 3 — four distinct image families — is judged on Deck A alone.** If four families
  appear only when a card demands them, the software has *range* but no *pull*, and that is a
  different diagnosis with a different fix: better defaults and a better first-run path, not more
  backends. Record it as a distinct outcome rather than a pass or a fail.

---

## 4 · Deck B — the cards

Draw them in this order. Each one probes an axis the free run tends not to reach.

| # | Card | What it probes |
|---|---|---|
| 6 | **Nothing with a lit surface.** No shading model that responds to a light may appear in the frame. | Whether the non-mesh backends are usable on their own, or only as garnish on a mesh |
| 7 | **One object.** Exactly one entry in the layer stack besides lights. Everything else comes from deformers, material, post, camera and the timeline. | Depth versus breadth. If a one-object project is dull, the per-object vocabulary is thinner than the library implies |
| 8 | **A bright frame.** The overall image must read as light, not as an accent colour on black. | The oldest known bias in the product. The background is the largest area of every frame and the least authored |
| 9 | **The structure must be visible.** At least three timeline states, and a stranger watching the export must be able to say where the sections change. | Whether the piece can carry *narrative*, not just reaction. This is the card most likely to fail today |
| 10 | **Vertical, and it must read on a phone.** 9:16, and judge it at phone size, not full screen. | The delivery format this audience actually posts in. Composition, scale and legibility all change |

---

## 5 · The loop, per project

1. **New project.** Load the stem. Start the timer.
2. **Build.** Free, or per the card.
3. **At fifteen minutes: stop editing.** Write the friction line.
4. **Save** as `NN-name.aura.json`.
5. **Export** 720p, 30 fps, the whole twenty seconds. 9:16 for card 10.
6. **Pull one still** from the exported file — not a screenshot of the app. The still is what
   criterion 1 is judged on, and it must come from the artefact the product actually produces,
   gizmos and grid and all.
7. **Fill in the row.** Two minutes, immediately, while you still remember what you tried.

---

## 6 · The record sheet

Copy this into the run folder as `record.md`.

```markdown
# Ten-project test — run of YYYY-MM-DD
Stem: <name, length, bpm>       Build: <git sha or "uncommitted, N tests">

| # | Deck | Name | Backends used | First thing I reached for | Finished? | One-line description |
|---|------|------|---------------|---------------------------|-----------|----------------------|
| 1 | A    |      |               |                           |           |                      |
| 2 | A    |      |               |                           |           |                      |
| 3 | A    |      |               |                           |           |                      |
| 4 | A    |      |               |                           |           |                      |
| 5 | A    |      |               |                           |           |                      |
| 6 | B — no lit surface |  |    |                           |           |                      |
| 7 | B — one object     |  |    |                           |           |                      |
| 8 | B — bright frame   |  |    |                           |           |                      |
| 9 | B — visible structure | | |                           |           |                      |
| 10| B — vertical       |  |    |                           |           |                      |

## Friction log — the important half
One line per project: what you wanted and could not get, or got only by fighting.

1.
2.
...

## Bugs seen
Anything that behaved wrongly. Do not fix during the run.

## Scoring
1. Distinguishable — a stranger told all ten apart from one still each:  yes / no / (n wrong)
2. None embarrassing — every one is something you would post:            yes / no / (which)
3. Four distinct image families in **Deck A**:                           yes / no / (list them)

Verdict: pass / fail / range-without-pull
```

---

## 7 · Judging the three criteria

**1 · Distinguishable.** Lay the ten stills out together, unlabelled. Ask the stranger to group any
that "look like they came from the same person on the same day". Every pair they group is a fail
against this criterion, and *which* pair they group tells you what the software over-supplies.

**2 · None embarrassing.** The test is "would you post it", not "is it good". Anything you would
delete rather than show is a failure of the **floor**, and a floor failure outranks everything in the
backlog — a tool that can produce a bad result in fifteen minutes of honest effort has a defaults
problem, not a features problem.

**3 · Four distinct image families in Deck A.** Families, not variations: *lit surface*, *cloud*,
*stroke*, *swept band*, *raymarched field*, *type*. Two projects that differ only in colour, count or
post are one family. Be strict here — the whole document exists because a permissive reading of this
question was wrong once already.

---

## 8 · What to do with the results

Each kind of finding has one home, and filing them is what makes a run worth three hours:

| Finding | Goes to |
|---|---|
| Something behaved wrongly | [15-BUILD-PLAN §1 Defects](15-BUILD-PLAN.md) — fix on sight, no scheduling |
| Something was impossible | [14-VISUAL-IDEAS](14-VISUAL-IDEAS.md), and if it is a whole family, [17-EXPRESSIVE-RANGE §3](17-EXPRESSIVE-RANGE.md) |
| Something was possible but slow or awkward | [15-BUILD-PLAN §3 Craft](15-BUILD-PLAN.md) — this is what unblocks the craft pass being scheduled honestly |
| You reached for the same thing every time | A **defaults** problem. Record it in [05-DESIGN-SYSTEM](05-DESIGN-SYSTEM.md) — defaults are a design surface (D-70) |
| The run passed | Say so in [00-STATUS](00-STATUS.md) with the date, and the priority moves from widening to craft |

The **friction log** outranks the score. A run that fails all three criteria but produces ten sharp
sentences about what was missing is a better outcome than a clean pass with an empty log.

---

## 9 · Run history

| Run | Date | Build | Verdict | Notes |
|---|---|---|---|---|
| — | — | — | **never run** | The bar was written 2026-08-07 and has been cited ever since without being executed. Passes 1, 2 and 4 have landed since |
