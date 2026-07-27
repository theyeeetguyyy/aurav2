# Codebase Map

File-by-file registry. **Update this in the same commit that adds or moves a file** —
the previous version of this document drifted within a single phase.

Constraint references (HC-n) point at [03-ARCHITECTURE.md](03-ARCHITECTURE.md).

---

## Data flow

```
                        ┌──────────────────┐
   audio files ────────▶│  MultiTrackRack  │  decode · schedule · master transport
                        └────────┬─────────┘
                    pre-fader ───┤ (HC-11)
                                 ▼
                        ┌──────────────────┐      ┌──────────────────┐
                        │ RealtimeAnalyser │─────▶│   AudioDataBus   │  Float32Array
                        └──────────────────┘      └────────┬─────────┘  (no React)
                                 │                         │
                                 │                         ▼
                        ┌────────▼─────────┐      ┌──────────────────┐
                        │  TransportClock  │─────▶│ ModulationMatrix │  ⬜ Phase 5
                        └────────┬─────────┘      └────────┬─────────┘
                                 │  (HC-1, HC-2)           ▼
              ┌──────────────────┼───────────────┐  ┌──────────────┐
              ▼                  ▼               ▼  │  SceneGraph  │  ⬜ Phase 3D
     useTransportTime()   WaveformCanvas   DualCameraRig └──────────┘
       (throttled 12Hz)    (imperative)      (useFrame)
              │
              ▼
      React components ◀──── Zustand stores (coarse state only)
```

**The rule the diagram encodes:** frame-rate data flows down the right-hand side into
typed arrays and `useFrame`. React only ever sees the throttled left branch.

---

## `src/types/` — pure declarations, zero runtime

| File | Contains | Status |
|---|---|---|
| `audio.ts` | `Track`, `TrimBounds`, `AnalysisData`, `StemMetrics`, `ID` | current |
| `params.ts` | `ParamAddress`, `ParamDescriptor`, `FieldRef`, `ParamValue`, address serialisation, `denormalise()` (HC-5) | current |
| `visual.ts` | `SceneObject`, `RenderBackend`, `MeshKind`, `Transform3D`, `MaterialParams`, `EffectInstance` (HC-4) | current |
| `modulation.ts` | `ModulationConnection`, `SignalChain`, `EventTrigger` | ⚠️ `TargetParam` / `SourceMetric` closed unions still to be replaced by `ParamAddress` / `FieldRef` — Phase 5A |
| `camera.ts` | `SceneCamera`, `PreviewCamera`, `CameraKeyframe`, `SplineWaypoint`, `CameraConstraint` | current |
| `project.ts` | `VisualState`, `Strip`, `SectionMarker`, `Project` | ⚠️ needs `activeConnectionIds` / `connectionOverrides` (HC-8) — Phase 6A |

## `src/store/` — Zustand

| Store | Owns | Notes |
|---|---|---|
| `useUIStore.ts` | active page, dock sizes, collapse state, `preImmersiveDocks` | immersive view restores prior dock state |
| `useAudioStore.ts` | tracks, trim, solo/mute/volume, loop, `isPlaying` | **no playhead** — that is TransportClock (HC-1). Exports `isTrackVisuallyActive()` |
| `useCameraStore.ts` | active camera view, control mode, keyframes, waypoints, constraints | |
| `useModulationStore.ts` | global connections, event triggers | project-global by design (HC-8) |
| `useProjectStore.ts` | states library, strips, markers, project meta | |
| `useSceneStore.ts` | **the SceneObject layer stack** — array order *is* layer order; param writes by address | exports `useSelectedObject()` |

> No store may hold an `AudioBuffer`, a `THREE.Object3D`, a GPU handle, or a DOM node.

## `src/engine/` — no React below this line

### `engine/time/`

| File | Role |
|---|---|
| `Clock.ts` | The `Clock` interface plus `SteppedClock` and `FrameClock`. Anything not drivable by `FrameClock` cannot be exported (HC-2). |
| `TransportClock.ts` | Live playhead singleton. Per-frame subscribers read imperatively; React uses `useTransportTime()`. |

### `engine/audio/`

| File | Role |
|---|---|
| `MultiTrackRack.ts` | AudioContext owner. Decode, per-track node chain, synchronised playback, seek, loop, trim-aware scheduling, project duration. Publishes to `TransportClock`. |
| `AudioDataBus.ts` | Fixed-capacity `Float32Array` bus, 9 floats per track slot. Pre-allocated so views never dangle. Zero React. |
| `RealtimeAnalyser.ts` | Per-track Meyda extraction from the **pre-fader** tap. Adaptive per-band normalisation. Live path only — see HC-3. |
| `AudioFeatures.ts` | ⬜ Phase 2G — dense feature timelines, `sample(track, metric, t)`. Becomes the source of truth for preview *and* export. |
| `AnalysisWorker.ts` | ⬜ Phase 2G — essentia.js offline MIR on import. |

### `engine/scene/`

| File | Role |
|---|---|
| `BrickRegistry.ts` | The geometry-operator catalogue. Registration is data, never a switch statement. Caches built geometry by brick + parameter signature; owns disposal. |
| `backends/types.ts` | `GeometryBrick` contract, `canMorph()`, `defaultParams()`. `canMorph` is the single authority — the UI must never offer a morph a backend cannot perform. |
| `backends/proceduralMesh.ts` | **The morph-compatible family.** One welded 642-vertex icosphere displaced per shape. Exports `BASE_VERTEX_COUNT`, `assertMorphCompatible()`. |
| `backends/primitiveMesh.ts` | 10 native Three geometries. `morphGroup: null` — swap-only. |
| `backends/proceduralMesh.test.ts` | The shared-topology invariant (HC-4). 23 assertions. |

### `engine/params/`

| File | Role |
|---|---|
| `ParamRegistry.ts` | Universal transform/material descriptors, `describeObject()`, `resolveDescriptor()`, `readParam()`, `modulationTargets()`. Every consumer reads parameter metadata from here — nothing hardcodes a parameter list. |

### `engine/camera/`

| File | Role |
|---|---|
| `DualCameraEngine.ts` | Authoritative transforms for both cameras. Fly movement, mouse-look, reference-counted input attach with text-field guards and key-release-on-blur. |

### Not yet created

`engine/platform/` (adapter) · `engine/scene/SceneGraph.ts` (HC-9) ·
`engine/modulation/` · `engine/timeline/` · `engine/commands/` · `engine/export/`

### `engine/shortcuts/`

| File | Role |
|---|---|
| `ShortcutManager.ts` | Action registry. **Modifier-aware chords** (`Ctrl+KeyZ`), conflict detection, change notification, localStorage persistence, Tab-vs-focus-traversal handling. |

## `src/components/`

### Shell

| File | Role |
|---|---|
| `App.tsx` | Shell layout, global shortcut subscriptions |
| `topbar/TopBar.tsx` | Brand, project name, REC, settings |
| `workspace/WorkspaceNavBar.tsx` | 5 DaVinci-style workspace tabs |
| `shell/TransportBar.tsx` | Persistent transport. Timecode via `useTransportTime()` |
| `shell/WorkspaceLayout.tsx` | Shared left/centre/right dock grid with draggable splitters. Docked CSS Grid — no floating panels, no z-index wars |
| `common/ShortcutSettingsModal.tsx` | Rebinding UI — click a row, press a chord, conflicts reported |
| `common/ScrubField.tsx` | Pointer-lock scrub control. Range, step and unit all come from the `ParamDescriptor` — nothing parameter-specific is hardcoded |

### Scene

| File | Role |
|---|---|
| `scene/LayerStack.tsx` | Outliner + brick library. Bricks grouped by morph family, because that grouping is what matters before picking a shape |
| `scene/Inspector.tsx` | Fully descriptor-driven. Knows nothing about radius or roughness — renders whatever `ParamRegistry` describes |

### Viewport

| File | Role |
|---|---|
| `viewport/SceneViewport.tsx` | Canvas shell + HUD. ⚠️ still per-page — moves to the shell in Phase 3D (HC-9) |
| `viewport/DualCameraRig.tsx` | **Two real cameras**, explicit active-camera binding, mutually exclusive Fly/Orbit (HC-10) |
| `viewport/DefaultScene.tsx` | Studio lights + grid, colours read from design tokens |
| `viewport/SceneObjects.tsx` | Renders the layer stack. Geometry from `BrickRegistry` (cached, never disposed here). Click to select, inflated back-face shell for the selection outline |
| `viewport/ViewportHUD.tsx` | Reticles, camera + control-mode switchers. Flat, no blur |

### Audio

| File | Role |
|---|---|
| `audio/TrackRow.tsx` | Stem row: colour, name, solo, mute, volume, waveform, delete |
| `audio/WaveformCanvas.tsx` | Two static canvas layers + clip-path progress. **Never repaints during playback** |
| `audio/TrimHandles.tsx` | Draggable trim in/out with pointer capture |

### Pages

| File | Tab | State |
|---|---|---|
| `pages/MediaStemsPage.tsx` | 1 · Media & Stems | built |
| `pages/ShapesScenePage.tsx` | 2 · Scene & Shapes | built — layer stack ∣ viewport ∣ inspector |
| `pages/NodeGraphPage.tsx` | 3 · Routing | placeholder — Phase 5 |
| `pages/CameraPage.tsx` | 4 · Camera | viewport only — Phase 7 |
| `pages/DeliverPage.tsx` | 5 · Deliver | placeholder — Phase 6 & 8 |

## `src/hooks/` · `src/utils/`

| File | Role |
|---|---|
| `hooks/useTransportTime.ts` | Throttled playhead for display-only components (HC-1) |
| `utils/tokens.ts` | Reads CSS custom properties for canvas/Three.js consumers, so viewport and chrome share one token source |
| `utils/stemColors.ts` | Rotating stem palette from tokens; `generateId()` via `crypto.randomUUID()` |

## Root

| File | Role |
|---|---|
| `index.html` | Entry, font preloads |
| `src/index.css` | Tailwind v4 `@theme` tokens — the single home for design tokens |
| `vite.config.ts` | React + Tailwind plugins, `@/` → `src/` |
| `tsconfig.app.json` | Strict, `erasableSyntaxOnly` (no constructor parameter properties, no enums) |
| `.oxlintrc.json` | Lint config |

## Scripts

`npm run dev` · `typecheck` · `lint` · `test` (Vitest) · `test:watch` ·
`check` (typecheck + lint + test) · `build` · `preview`
