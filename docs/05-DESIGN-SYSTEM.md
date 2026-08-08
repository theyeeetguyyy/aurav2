# 05 — Design System

> Benchmark: Figma, DaVinci Resolve, Blender, TouchDesigner, Ableton Live.
> This is the only home for design tokens. Do not restate them elsewhere.

## 1. Core decisions

| Decision | Why |
|---|---|
| **Flat, opaque surfaces. No glassmorphism.** | Blender, Resolve, Ableton and TouchDesigner all use opaque crisp surfaces. Background blur burns GPU budget the viewport needs and hurts legibility of dense numeric data. Flat opaque reads as an instrument panel, not a SaaS dashboard. **`backdrop-blur` is banned outright.** |
| **Node category ≠ stem identity** | Node headers and handles are coloured by *category* so wiring validity is readable at a glance. Stem identity appears as a secondary badge dot inside the node. Conflating them makes both unreadable. |
| **Tokens are enforced** | All colours and fonts are registered in `index.css` via Tailwind v4 `@theme`. Arbitrary values (`bg-[#121215]`) in components are forbidden — including inside `style={{}}`. |
| **Persistent transport, dedicated timeline page** | A slim transport strip lives in the shell across every tab — with a scrub bar, so you can always *go* somewhere in the piece and not merely know where you are (D-79). The full NLE timeline has its own workspace (D-77). |
| **Document-level controls live in the top bar** | Which project, and which state. A control that acts on the *contents* of a state belongs in that state's workspace; putting the state selector in a side dock gave one 280px column two unrelated jobs, and put it on one page when it applies to all of them. Blender puts its Scene picker in the same place, for the same reason (D-77). |
| **A button with no handler is not a placeholder, it is a lie** | REC sat in the top bar from Phase 1 wired to nothing. It read as a feature and was a picture of one. Ship the control with the behaviour or do not ship the control. |
| **No instructional prose in the UI** | A paragraph explaining how a control works is a design failure with a workaround attached — and several of ours appeared in two places, which is the same sentence maintained twice. `title` attributes are fine: hover help is on demand and costs no space. Empty states that say what a panel is *for* are fine: with nothing in a list there is nothing else to read. Narrating a gesture is not. |
| **One page, one job** | A page's docks serve a single question. When Scene & Shapes' left dock accumulated the layer stack, the shape library, world settings *and* the post chain, each got a sliver and the fixed-size library overflowed onto the rows beneath. Look was split out for that reason, and it is the standing rule: a new concern gets a home, not a corner of an existing one. |
| **Tabular figures, pointer-lock scrubbing** | `tabular-nums` on every live readout stops digit jitter. `requestPointerLock()` on scrub gives infinite travel without hitting screen edges. |

## 2. Layout

Fixed shell: 260px left dock · centre · 320px right dock, consistent across every tab.

| Tab | Left dock | Centre | Right dock | State |
|---|---|---|---|---|
| **1 · Media & Stems** | Import / file browser | Stem rack, full width | Track detail: trim, BPM, onsets | rack only — docks unbuilt |
| **2 · Scene & Shapes** | Layer stack + brick library | 3D viewport | Transform / material / effect stack | built |
| **3 · Look** | World: background, fog, lighting rig, reflections, grid | 3D viewport | Post chain | built |
| **4 · Routing** | Available Fields (drag to wire) | Patchbay ⟷ node graph | Connection signal chain | patchbay built, graph unbuilt |
| **5 · Camera** | Transform + behaviour stack (where it IS) | 3D viewport, camera gizmos + path | Path waypoints, animate-over-time (how it MOVES) | built |
| **6 · Timeline** | States + section markers | Monitor above the NLE timeline | — | built |
| **7 · Deliver** | — | Monitor | Export settings | built |

- **Splitters** — 1px, `border-aura-line`, hover indicator. Drag to resize (200–480px), double-click to collapse.
- **Immersive view (`H`)** — hides left/right/bottom docks for a full-bleed viewport. Restores the *previous* dock state on exit, not a default state.
- **Non-overlapping rule** — docked CSS Grid. No floating popup ever obscures the centre viewport.

## 3. Tokens

### Surfaces

| Token | Hex | Class | Use |
|---|---|---|---|
| `--color-aura-void` | `#09090b` | `bg-aura-void` | Window background, viewport clear colour, letterbox |
| `--color-aura-base` | `#121215` | `bg-aura-base` | Default panel |
| `--color-aura-surface` | `#18181b` | `bg-aura-surface` | Cards, inputs, row hover |
| `--color-aura-elevated` | `#27272a` | `bg-aura-elevated` | Menus, tooltips, command palette |
| `--color-aura-line` | `rgba(255,255,255,.07)` | `border-aura-line` | Dividers, panel borders |
| `--color-aura-focus` | `#6366f1` | `ring-aura-focus` | Focus ring, active input border |

### State

| Token | Hex | Use |
|---|---|---|
| `--color-aura-accent` | `#6366f1` | Selection, playhead, focus |
| `--color-aura-hot` | `#f43f5e` | Record LED, clipping, mute |
| `--color-aura-state-solo` | `#eab308` | Solo — its own token, used consistently everywhere |

### Stem identity

`drums #f97316` · `bass #f59e0b` · `lead #10b981` · `atmo #06b6d4`
Extended rotation: `violet #8b5cf6` · `pink #ec4899` · `teal #14b8a6` · `rose #f43f5e`

### Node category

`signal #f97316` (orange) · `processor #22c55e` (green) · `parameter #3b82f6` (blue) · `event #f43f5e` (rose)

### Viewport

Scene colours (grid, default lights, gizmos) are tokens too — `--color-aura-grid-cell`,
`--color-aura-grid-section`, `--color-aura-viewport-bg`. Three.js code reads them from
CSS custom properties so the viewport and the chrome can never drift apart.

## 4. Typography

- **UI** — Inter. 11px labels, 12px controls, 11px uppercase `tracking-wide` headers.
- **Data** — JetBrains Mono. 11px numeric readouts.
- **Every live-updating number uses `tabular-nums`.** Timecode, BPM, VU, scrub fields, automation values. Non-negotiable — `9.99 → 10.00` reflowing during playback looks broken.

## 5. Precision controls

**Scrubbable numeric field** — the primary way any parameter is edited.

```tsx
<div className="flex items-center justify-between h-7 px-2 bg-aura-surface hover:bg-aura-elevated
                border border-aura-line rounded cursor-ew-resize group select-none text-[11px]">
  <span className="text-slate-400 font-medium">Radius</span>
  <span className="font-mono tabular-nums text-aura-accent group-hover:text-indigo-300">50.00 m</span>
</div>
```

- On drag start call `requestPointerLock()` and consume `movementX`. Infinite travel.
- `Shift` = 10× coarse, `Alt` = 0.1× fine.
- Double-click converts to a typed `<input>`.
- Range, step, and unit come from the parameter's `ParamDescriptor` (HC-5) — never hardcoded per component.

**Command palette** — `Ctrl/Cmd+K` over `bg-aura-elevated`. Every entry maps to a
registered `ActionID` in `ShortcutManager`, so the palette and the shortcut list can
never drift.

## 6. Motion & chrome

1. **Quiet chrome.** Glow and pulse are reserved for 3D viewport content and live data cables. Never panel borders or buttons.
2. **`:focus-visible` only.** Focus rings appear for keyboard navigation, not mouse clicks.
3. **`prefers-reduced-motion`** shortens or disables playhead smoothing and drag ghosting.

## 7. Merge checklist

- [ ] Compact type (11–12px), no excessive padding
- [ ] Scrub fields use pointer lock + `Shift`/`Alt` modifiers
- [ ] Every live numeric readout uses `tabular-nums`
- [ ] Centre viewport unobscured by popups
- [ ] **Zero raw hex or arbitrary Tailwind values** — including in `style={{}}` and Three.js material colours
- [ ] **Zero `backdrop-blur`**
- [ ] Node colours: header/handle = category, stem identity = secondary dot
- [ ] Focus rings `:focus-visible`; motion respects `prefers-reduced-motion`
- [ ] Glow reserved for viewport content, never chrome
- [ ] Command palette entries resolve to real `ActionID`s

---

## Where this system is still not honest

Written 2026-08-07, after using the software rather than reading it.

**Every control in the app is a slider, a number field, or a row in a list.** That is why panels
read as forms: a form is the shape of the *data*, exposed directly, which is what you build before
deciding how a thing should be operated. A rotation is not a text field. A colour is not three
numbers. An ordering is not a pair of ▲▼ buttons.

Concretely missing, against every reference this document names:

| To do this | Here | Blender · Notch · TouchDesigner |
|---|---|---|
| Move an object | type into X/Y/Z rows in a side dock | drag a gizmo on the object |
| Move a path waypoint | delete it, fly there, re-add it | drag the point in 3D |
| Nudge a value | click, select, type, Enter | drag on the number and it scrubs |
| Reorder a stack | ▲ / ▼ buttons | drag the row |
| Know what you are about to hit | nothing | it highlights on hover |

Plus: nothing eases. Panels appear instantly, states swap instantly. Instant reads as cheap.

**This is deliberately not the next thing.** It makes a narrow tool pleasant, and narrowness is the
problem that decides whether the tool is worth operating at all — see
[17-EXPRESSIVE-RANGE.md](17-EXPRESSIVE-RANGE.md) §4. Recorded here so it is a known debt with a
diagnosis, not a vague sense that something is off.
