# AURA Studio — Documentation

Single source of truth for AURA Studio. Everything in this folder is **current and
non-contradictory**. If two documents disagree, that is a bug — file it and fix it.

## Start here

**[00-STATUS.md](00-STATUS.md)** — where the project actually is, what runs today, what
does not, and what to do next. Read it first in any new session; everything else is
reference.

## Reading order

| # | Document | Read it when |
|---|---|---|
| 00 | [Status](00-STATUS.md) | **First, always.** Current state, verified. |
| 01 | [Vision & Positioning](01-VISION.md) | Deciding *whether* to build something. Product, audience, what AURA refuses to be. |
| 02 | [Design Principles](02-PRINCIPLES.md) | Before designing **any** new subsystem. Twelve standing rules distilled from Blender, TouchDesigner, C4D, Cinemachine, Unreal, Ableton. |
| 03 | [Architecture](03-ARCHITECTURE.md) | Before writing engine code. Hard constraints, the render-backend model, parameter addressing, the time authority. **Non-negotiable.** |
| 04 | [Engine Specs](04-ENGINE-SPECS.md) | Implementing or refactoring a specific module. |
| 05 | [Design System](05-DESIGN-SYSTEM.md) | Writing any UI. Tokens, layout, ergonomics, merge checklist. |
| 06 | [Roadmap](06-ROADMAP.md) | Picking what to build next. Phase status lives here and nowhere else. |
| 07 | [Decision Log](07-DECISIONS.md) | Wondering "why is it like this?" Every locked decision, dated, with reasoning. |
| 08 | [Open Questions](08-OPEN-QUESTIONS.md) | Something is ambiguous. If it's here, it is genuinely undecided. |
| 09 | [Brick Registry](09-BRICK-REGISTRY.md) | Catalogue of geometry, deformer, field and post-process operators. |
| 10 | [Element Taxonomy](10-ELEMENTS.md) | Deciding *what to build next*. Element families mined from v1 + ideated, with build order. |
| 11 | [Routing UX](11-ROUTING-UX.md) | The patchbay redesign and why not a node canvas. |
| 12 | [Deformer Catalogue](12-DEFORMERS.md) | The fifteen deformers, why each is structurally distinct, and the no-built-in-motion rule. |
| 13 | [Product Gap](13-PRODUCT-GAP.md) | **What is done, what is missing, and what actually blocks being a product.** |
| 14 | [Visual Idea Bank](14-VISUAL-IDEAS.md) | Researched + original element ideas, ranked. What only AURA can do. |
| — | [Codebase Map](CODEBASE_MAP.md) | Finding where something lives. File-by-file registry. |
| — | [Audit 2026-07-27](AUDIT-2026-07-27.md) | Historical record of the full-codebase audit that produced this doc set. |

## `research/`

Frozen source material — market research, tool-by-tool deep dives, and the raw
conversation transcripts that produced the design. **Do not edit these.** They are
a historical record of *how* conclusions were reached. Conclusions themselves live
in 01–08. Consult `research/02-tool-research-deep-dive.md` before designing a new
subsystem: a mature tool has usually already solved the problem.

## Maintenance rules

1. **One fact, one home.** Phase status lives only in `06-ROADMAP.md`. Tokens live
   only in `05-DESIGN-SYSTEM.md`. Duplicating a fact across documents is how the
   previous doc set drifted into self-contradiction.
2. **Resolving an open question is a three-file edit**: strike it from
   `08-OPEN-QUESTIONS.md`, record it in `07-DECISIONS.md`, encode it in whichever
   of 03/04/05 governs it.
3. **`03-ARCHITECTURE.md` outranks everything.** Code that violates a hard
   constraint is wrong even if it works.
4. Update `CODEBASE_MAP.md` in the same commit that adds or moves a file.

## Repository layout

```
aura/
├── aurav2/            The application (React + TS + R3F). Its own git repo.
│   ├── docs/          ← you are here
│   └── src/
└── legacy/
    └── aura-v1/       Frozen v1 vanilla-JS build. Own git repo, full history.
                       Reference and parts donor only — never edited, never shipped.
```
