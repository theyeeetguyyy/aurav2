# 🎨 AURA STUDIO — DESIGN SYSTEM v2

> **Standard**: Industry-grade creative software (Figma, DaVinci Resolve, Blender, TouchDesigner, Ableton Live).
> **Status**: Supersedes previous theme tokens and node category definitions. Single source of truth for UI/UX implementation.

---

## 1. Executive Summary & Design Decisions

| Decision | Rationale |
|---|---|
| **Flat, Opaque Surfaces (Killed Glassmorphism)** | Retired translucent `rgba()` panels and `--aura-glow`. Blender, Resolve, Ableton, and TouchDesigner use opaque, crisp surfaces because background blurs waste GPU budget and reduce pixel-level legibility for dense numeric data. Flat opaque reads as a real instrument panel, not a generic SaaS dashboard. |
| **Node Category vs. Stem Identity Color Split** | Node headers/handles use Category colors (`Signal` orange, `Processor` green, `Parameter` blue, `Event` rose) to make wiring validity readable at a glance. Stem identity (Drums, Bass, Lead, Atmosphere) uses a secondary 6px badge inside `TrackNode`. |
| **Tailwind v4 `@theme` Token Enforcer** | All custom colors and fonts are registered in `index.css` via `@theme`. Arbitrary hex classes (`bg-[#121215]`) are strictly forbidden in React components. |
| **Persistent Transport Strip + Deliver Timeline** | A slim transport bar (play/pause, seek, timecode, loop) lives in the app shell across all 5 tabs. The full NLE timeline stays in Tab 5 (Deliver Page). |
| **Tabular Figures & Pointer Lock Scrubbing** | `tabular-nums` on all dynamic readouts stops digit-jitter. `requestPointerLock()` on scrub drag provides infinite horizontal travel without hitting screen edges. |

---

## 2. Layout Architecture — Shell + Per-Page Docks

The 260px left / center / 320px right dock structure is fixed across all 5 workspace tabs, with page-specific contents:

| Tab | Left Dock | Center | Right Dock |
|---|---|---|---|
| **1. Media & Stems** | Import / file browser | Stem rack (waveforms, full width) | Selected track: trim bounds, essentia analysis (BPM, onsets) |
| **2. Scene & Shapes** | Shape hierarchy + shape library | R3F 3D viewport | Transform / material / deformer inspector |
| **3. Routing** | Available sources (drag to wire) | Stacked list ⟷ React Flow graph (toggle) | Selected connection's signal chain (Gain/Rise/Fall/Min/Max/Weight) |
| **4. Camera** | Keyframe / waypoint list | 3D viewport with spline gizmo | Constraint stack (Follow Path, Look-At, influence sliders) |
| **5. Deliver** | Section markers | Full NLE timeline (full width) | Export settings |

### Shell Dock Rules
- **Persistent Shell Bar**: TopBar + slim Transport Strip + 5-tab Workspace Switcher live in the main shell.
- **Splitters**: 1px splitters (`border-aura-line`) with hover indicator. Double-click to collapse; drag to resize (200px min, 480px max).
- **Immersive View (`H`)**: Toggles visibility of Left, Right, and Bottom docks to give 100% fullscreen to the 3D Canvas.

---

## 3. Color Tokens & Tailwind Wiring

### 3.1 Surface Layers (Flat & Opaque)

| Token | Hex | Tailwind Utility Class | Purpose |
|---|---|---|---|
| `--color-aura-void` | `#09090b` | `bg-aura-void` | Main window background, letterbox margin |
| `--color-aura-base` | `#121215` | `bg-aura-base` | Default panel background |
| `--color-aura-surface` | `#18181b` | `bg-aura-surface` | Cards, inputs, row hover |
| `--color-aura-elevated` | `#27272a` | `bg-aura-elevated` | Menus, tooltips, dropdowns, command palette |
| `--color-aura-line` | `rgba(255,255,255,0.07)` | `border-aura-line` | Dividers, panel borders |
| `--color-aura-focus` | `#6366f1` | `border-aura-focus` / `ring-aura-focus` | Active input border, focus ring, playhead |

### 3.2 Functional Accents & State Colors

| Token | Hex | Tailwind Utility Class | Purpose |
|---|---|---|---|
| `--color-aura-accent` | `#6366f1` (indigo) | `bg-aura-accent` / `text-aura-accent` | Primary selection, playhead, focus |
| `--color-aura-hot` | `#f43f5e` (rose) | `bg-aura-hot` / `text-aura-hot` | Recording LED, clipping warning, Mute button |
| `--color-aura-state-solo` | `#eab308` (yellow) | `bg-aura-state-solo` | **Solo** highlight (dedicated token across all tracks) |

### 3.3 Stem Identity vs. Node Category Scales

**Stem Identity** (Track Rack, waveform accents, stem chips):
- Drums / Percussion: `--color-aura-stem-drums` (`#f97316` orange)
- Bass / Sub: `--color-aura-stem-bass` (`#f59e0b` amber)
- Lead / Synth: `--color-aura-stem-lead` (`#10b981` emerald)
- Atmosphere / Vocal: `--color-aura-stem-atmo` (`#06b6d4` cyan)

**Node Category** (Routing graph — header & handle colors):
- Signal Node (`TrackNode`): `--color-aura-node-signal` (`#f97316` orange)
- Processor Node (`SignalProcessorNode`): `--color-aura-node-processor` (`#22c55e` green)
- Parameter Node (`ShapeParamNode`): `--color-aura-node-parameter` (`#3b82f6` blue)
- Event Node (Discrete triggers): `--color-aura-node-event` (`#f43f5e` rose)

---

## 4. Typography & Numerical Precision

### 4.1 Font Families & Scale
- **UI Text**: `Inter`, `sans-serif` (11px labels, 12px controls, uppercase 11px tracking-wide headers)
- **Data & Readouts**: `JetBrains Mono`, `monospace` (11px numerical inputs)

### 4.2 Tabular Figures Rule
All live-updating readouts (scrubbable inputs, VU meters, BPM, timecode `00:00:00:00`, automation values) **MUST** use `tabular-nums` (`font-variant-numeric: tabular-nums`). This prevents digit width jitter (`9.99` → `10.00`) during scrubbing and playback.

---

## 5. Precision Controls & Ergonomics

### 5.1 Scrubbable Numeric Field (Pointer Lock Enabled)
```tsx
// Scrub Field Template
<div className="flex items-center justify-between h-7 px-2 bg-aura-surface hover:bg-aura-elevated border border-aura-line rounded cursor-ew-resize group select-none text-[11px]">
  <span className="text-slate-400 font-medium">Radius</span>
  <span className="font-mono tabular-nums text-aura-accent group-hover:text-indigo-300">50.00 mm</span>
</div>
```
- **Pointer Lock Scrubbing**: On drag start, call `element.requestPointerLock()` and consume `movementX` deltas. Provides infinite horizontal travel without bumping screen boundaries.
- **Modifiers**: `Shift` = 10x coarse scrub, `Alt` = 0.1x fine scrub.
- **Direct Entry**: Double-click turns field into a typed text `<input>`.

### 5.2 Command Palette & Action Registry
- Pressing `Ctrl+K` / `Cmd+K` opens fuzzy command palette over `bg-aura-elevated`.
- **Single Registry Mandate**: Every command palette entry maps directly to a registered `ActionID` in `ShortcutManager` (Phase 1G), preventing shortcut-palette list drift.

---

## 6. Micro-Interactions, Motion & Quiet Chrome

1. **Quiet Chrome Rule**: Glow and pulse effects are reserved strictly for 3D viewport objects and graph node data cables — never panel borders or buttons.
2. **Keyboard Focus (`:focus-visible`)**: Focus outlines (`ring-2 ring-aura-focus ring-offset-2 ring-offset-aura-base`) display only during keyboard navigation, hidden on mouse click.
3. **Accessibility Motion**: `prefers-reduced-motion` disables/shortens playhead smoothing and drag ghosting.

---

## 7. Tailwind v4 `@theme` Setup

Add to `src/index.css`:

```css
@import "tailwindcss";

@theme {
  /* Surface Layers */
  --color-aura-void: #09090b;
  --color-aura-base: #121215;
  --color-aura-surface: #18181b;
  --color-aura-elevated: #27272a;
  --color-aura-line: rgba(255, 255, 255, 0.07);
  --color-aura-focus: #6366f1;

  /* Accents & State */
  --color-aura-accent: #6366f1;
  --color-aura-hot: #f43f5e;
  --color-aura-state-solo: #eab308;

  /* Stem Identity */
  --color-aura-stem-drums: #f97316;
  --color-aura-stem-bass: #f59e0b;
  --color-aura-stem-lead: #10b981;
  --color-aura-stem-atmo: #06b6d4;

  /* Node Categories */
  --color-aura-node-signal: #f97316;
  --color-aura-node-processor: #22c55e;
  --color-aura-node-parameter: #3b82f6;
  --color-aura-node-event: #f43f5e;

  /* Fonts */
  --font-sans: "Inter", -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
}
```

---

## ✅ Design Quality Checklist (Must Pass Before Merge)

- [ ] Typography is compact (`11px–12px`) with zero excessive padding/whitespace.
- [ ] Scrubbable fields use `requestPointerLock()` for infinite travel and `Shift`/`Alt` speed modifiers.
- [ ] All numeric readouts use `tabular-nums` so numbers don't jitter on update.
- [ ] Center viewport remains unobscured by floating popups.
- [ ] Every color reference uses semantic tokens (`bg-aura-*`) — zero raw hex or `bg-[#...]` in components.
- [ ] In node graph, node header/handle color = category, with stem identity as a secondary badge dot.
- [ ] Focus rings use `:focus-visible` and motion respects `prefers-reduced-motion`.
- [ ] Glow/ambient motion is reserved for 3D viewport content, never panel chrome.
- [ ] Command palette entries resolve to the unified `ShortcutManager` ActionIDs.
