# 05 — Design System

> Benchmark: Figma, DaVinci Resolve, Blender, TouchDesigner, Ableton Live.
> This is the only home for design tokens. Do not restate them elsewhere.

## 1. Core decisions

| Decision | Why |
|---|---|
| **Flat, opaque surfaces. No glassmorphism.** | Blender, Resolve, Ableton and TouchDesigner all use opaque crisp surfaces. Background blur burns GPU budget the viewport needs and hurts legibility of dense numeric data. Flat opaque reads as an instrument panel, not a SaaS dashboard. **`backdrop-blur` is banned outright.** |
| **Node category ≠ stem identity** | Node headers and handles are coloured by *category* so wiring validity is readable at a glance. Stem identity appears as a secondary badge dot inside the node. Conflating them makes both unreadable. |
| **Tokens are enforced** | All colours and fonts are registered in `index.css` via Tailwind v4 `@theme`. Arbitrary values (`bg-[#121215]`) in components are forbidden — including inside `style={{}}`. |
| **Persistent transport, page-local timeline** | A slim transport strip lives in the shell across every tab so you always know where you are in the piece. The full NLE timeline stays in Deliver. |
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
| **5 · Camera** | Keyframe / waypoint list | 3D viewport + spline gizmo | Constraint stack, influence sliders | viewport only |
| **6 · Deliver** | Section markers | NLE timeline, full width | Export settings | unbuilt |

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
