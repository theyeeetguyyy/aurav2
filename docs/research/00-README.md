# AURA Studio — Research & Design Docs

Reference material for the AURA Studio build, distilled from market research
and deep dives into comparable software (TouchDesigner, Blender, Cinema 4D,
Unity, Unreal, Ableton, and others). Meant to be given as context to a coding
AI before implementation work, and kept as founder reference alongside the
project's technical knowledge base.

## Reading order

1. **`01-market-research-and-positioning.md`** — competitive landscape, who's
   underserved, target audience, positioning strategy, pricing signals.
2. **`02-tool-research-deep-dive.md`** — tool-by-tool findings (TouchDesigner,
   Blender, Cinema 4D, Unity Cinemachine, Unreal Sequencer/Niagara, Ableton,
   rhythm game editors, etc.) with a concrete "takeaway for AURA" per tool.
3. **`03-tech-stack-and-architecture.md`** — confirmed tech stack, the
   web-vs-native decision and reasoning, and hard architectural constraints
   that must be respected from the first commit (audio-data-bypasses-React,
   shared-topology morphing, typed node graph, etc.).
4. **`04-feature-checklist-and-open-questions.md`** — every feature from the
   original notes dump, cross-referenced against what's resolved vs. still
   open. Start here when picking the next thing to build or design.

## How to use this with a coding AI

Paste the relevant doc(s) — usually `03` and the relevant section of `04` —
as context before asking for implementation of a specific module. `02` is
useful context when designing a *new* subsystem (check if a mature tool
already solved the problem before inventing a pattern from scratch). `01` is
mainly for product/marketing decisions, less relevant to pure engineering
tasks.

These docs reflect research and decisions as of **2026-07-24**. Update them as
real decisions are made during implementation — treat `04`'s open-questions
list as living, not static.
