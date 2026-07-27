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

**Early.** Phase 1 (shell, viewport, dual cameras, shortcuts) and Phase 2 (multi-track
audio engine, stem rack, trim, live analysis) are working. Scene objects, modulation,
timeline, camera authoring, and export are not built yet.

Current phase status lives in [`docs/06-ROADMAP.md`](docs/06-ROADMAP.md).

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # oxlint
npm run build      # typecheck + production build
```

Drop MP3/WAV/OGG stems onto the **Media & Stems** tab to import them.

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
