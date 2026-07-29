<div align="center">
  <h1>AURA STUDIO</h1>
  <p><strong>An audio-reactive visual NLE for musicians and producers.</strong></p>
  <p>Load your stems. Route each one to a 3D scene. Direct a camera by hand. Cut states on a timeline. Render a video.</p>
</div>

---

Load multi-track stems, route each stem's musical character to parameters of a 3D scene
through a weighted modulation matrix, direct a camera through that scene by hand, cut
between visual states on an NLE timeline, and render frame-accurate video.

Nothing auto-generates. You direct it.

## Status

**The core loop works.** Import stems → add a shape → route a stem to one of its
parameters → press play → the shape reacts, deterministically.

Built: workspace shell · dual camera · multi-track audio with offline MIR analysis ·
scene layer stack with 17 shapes across two render backends · descriptor-driven
inspector · weighted N:1 modulation matrix with envelope shaping and discrete triggers.

Not built: morphing · deformers · timeline & states · camera authoring · export · undo.

👉 **[docs/00-STATUS.md](docs/00-STATUS.md)** — exact current state, known gaps, next step.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + test — green before any commit
```

| Script | Does |
|---|---|
| `dev` | Vite dev server |
| `typecheck` | `tsc -b --noEmit` |
| `lint` | oxlint |
| `test` / `test:watch` | Vitest |
| `check` | typecheck + lint + test |
| `build` | typecheck + production build |

### Try the loop

1. **Media & Stems** — drop in MP3/WAV stems.
2. **Scene & Shapes** — add a Sphere from the *Morphable* group.
3. **Routing** — expand it, `+` on **Scale**, pick **Envelope** + your drum stem, Connect.
4. Press play.

Tick *Discrete trigger* when connecting to fire once per hit instead of blending — that
is the difference between a kick that punches and one that smears.

## Documentation

Everything is in [`docs/`](docs/README.md), and it is the source of truth — not the code,
not commit messages.

| Read | For |
|---|---|
| [01 · Vision](docs/01-VISION.md) | What this is and who it's for |
| [02 · Principles](docs/02-PRINCIPLES.md) | **Before designing any subsystem** |
| [03 · Architecture](docs/03-ARCHITECTURE.md) | **Before writing engine code.** Binding constraints |
| [04 · Engine Specs](docs/04-ENGINE-SPECS.md) | Implementing a module |
| [05 · Design System](docs/05-DESIGN-SYSTEM.md) | Writing UI |
| [06 · Roadmap](docs/06-ROADMAP.md) | What to build next |
| [07 · Decisions](docs/07-DECISIONS.md) | Why something is the way it is |
| [08 · Open Questions](docs/08-OPEN-QUESTIONS.md) | What's genuinely undecided |
| [09 · Brick Registry](docs/09-BRICK-REGISTRY.md) | Operator catalogue |
| [Codebase Map](docs/CODEBASE_MAP.md) | Where things live |

## Stack

React 19 · TypeScript (strict) · Vite · Three.js + React Three Fiber · Zustand ·
Tailwind v4 · Web Audio API · Meyda (→ essentia.js) · WebCodecs (planned)

## Repository layout

```
aura/
├── aurav2/          this project
│   ├── docs/        source of truth
│   └── src/
│       ├── types/   pure declarations
│       ├── store/   Zustand
│       ├── engine/  no React below this line
│       └── components/
└── legacy/
    └── aura-v1/     frozen vanilla-JS v1 — reference and parts donor only
```

> The `engine/` boundary is absolute: no file under it imports React, a store, or a
> component. This is what makes offline rendering and testing possible.
