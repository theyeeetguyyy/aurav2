# 🏗️ AURA STUDIO v2 — CODEBASE ARCHITECTURE & FILE REGISTRY

> **Purpose**: Single source of truth for the codebase structure, file responsibilities, component connections, and state flow.
> **Maintenance Rule**: Must be updated after every phase/feature addition.

---

## 🗺️ SYSTEM OVERVIEW & DATA FLOW

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              App.tsx                                   │
 │ (TopBar | ActivePage | TransportBar | WorkspaceNavBar | Hotkey Sub)    │
 └───────┬───────────────────┬───────────────────┬────────────────────────┘
         │                   │                   │
 ┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
 │ useUIStore    │   │ useAudioStore │   │useProjectStore│
 │ (Page, Docks) │   │ (Tracks, Sync)│   │ (States, NLE) │
 └───────────────┘   └───────────────┘   └───────────────┘
         │                   │                   │
 ┌───────▼───────────────────▼───────────────────▼────────────────────────┐
 │                        3D Viewport Layer                               │
 │ SceneViewport → Canvas → SceneCamera (0,0,50) + DefaultScene + HUD     │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 COMPLETE FILE REGISTRY & RESPONSIBILITIES

### 1. Root & Configuration Files

| File Path | Role & Purpose | Inter-File Connections |
|---|---|---|
| `package.json` | Dependencies (React 19, Three.js, R3F, Drei, Zustand, Lucide, Tailwind v4) | Configures build & scripts |
| `vite.config.ts` | Vite bundler config with Tailwind v4 plugin & `@/` path alias | Resolves `@/` → `src/` |
| `tsconfig.app.json` | Strict TypeScript compiler options with alias resolution | Type checks all `src/` files |
| `index.html` | HTML entry point with Inter + JetBrains Mono fonts preload | Mounts `<div id="root">` |
| `src/index.css` | Design System v2 Tailwind `@theme` tokens, focus rings, scrollbar, `tabular-nums` | Imported by `main.tsx` |
| `src/main.tsx` | ReactDOM root render | Mounts `App.tsx` |
| `src/App.tsx` | Root shell layout (TopBar, ActivePage, TransportBar, NavBar, global hotkey subscriptions) | Imports all pages, shell components, stores |

---

### 2. Type System (`src/types/`)

| File Path | Role & Purpose | Consumed By |
|---|---|---|
| `src/types/audio.ts` | Types for `Track`, `TrimBounds`, `AnalysisData`, `StemMetrics` | `useAudioStore`, `MultiTrackRack`, Track UI |
| `src/types/project.ts` | Types for `VisualState` (referencing `sceneObjectIds`), `Strip` (NLE reference), `SectionMarker`, `Project` | `useProjectStore`, State Manager, Timeline |
| `src/types/visual.ts` | Types for `SceneObject` (open layer stack), `SceneObjectType` (`shape` \| `particleEmitter` \| `light` \| `backgroundElement` \| `image`), `Transform3D`, `EffectInstance` (`GeometryEffect` \| `InstancingEffect` \| `PostProcessEffect`) | Layer Stack, Inspector, `EffectRegistry`, Renderer |
| `src/types/camera.ts` | Types for `SceneCamera`, `PreviewCamera`, `CameraKeyframe`, `SplineWaypoint`, `CameraConstraint` | `useCameraStore`, `DualCameraEngine`, Viewport |
| `src/types/modulation.ts` | Types for `ModulationConnection`, `SignalChain`, `EventTrigger`, `SourceMetric`, `TargetParam` | `useModulationStore`, Modulation Matrix |

---

### 3. Zustand State Stores (`src/store/`)

| Store | State Managed | Exported Actions | Connected To |
|---|---|---|---|
| `useUIStore.ts` | `activePage` ('media-stems' \| 'scene-shapes' \| 'routing' \| 'camera' \| 'deliver'), panel collapse flags, dock widths | `setActivePage`, `toggleImmersiveView`, `setLeftPanelWidth`, etc. | `App.tsx`, `WorkspaceNavBar.tsx`, HUD |
| `useAudioStore.ts` | `tracks[]`, `isPlaying`, `currentTime`, `loopEnabled`, `loopStart/End` | `addTrack`, `toggleSolo`, `toggleMute`, `setPlaying`, `setCurrentTime` | `TransportBar.tsx`, Track Rack, Audio Engine |
| `useProjectStore.ts` | `project` container (`statesLibrary`, `timelineStrips`, `markers`) | `addState`, `updateState`, `addStrip`, `addMarker` | Timeline, State Manager, TopBar |
| `useModulationStore.ts` | `connections[]` (N:1 matrix), `eventTriggers[]` | `addConnection`, `updateConnection`, `addEventTrigger` | Node Graph, Signal Evaluator |
| `useCameraStore.ts` | `activeCamera` ('scene' \| 'preview'), `controlMode` ('orbit' \| 'fly'), `keyframes[]`, `waypoints[]` | `setActiveCamera`, `setControlMode`, `addKeyframe` | `ViewportHUD.tsx`, `SceneCamera.tsx`, Dual Camera |

---

### 4. Application Shell Components (`src/components/`)

| Component | File Path | Responsibilities & UI Features | Connected Files |
|---|---|---|---|
| `TopBar` | `src/components/topbar/TopBar.tsx` | Brand header, project name display, REC button, settings gear button | `useProjectStore`, `ShortcutSettingsModal` |
| `WorkspaceNavBar` | `src/components/workspace/WorkspaceNavBar.tsx` | 5 DaVinci Resolve workspace tabs (Media, Shapes, Routing, Camera, Deliver) | `useUIStore` |
| `TransportBar` | `src/components/shell/TransportBar.tsx` | Persistent transport: Skip Back, Play/Pause, `tabular-nums` timecode (`00:00.00`), Loop toggle | `useAudioStore` |
| `ShortcutSettingsModal` | `src/components/common/ShortcutSettingsModal.tsx` | Modal displaying all remappable hotkeys by category | `ShortcutManager.ts`, `TopBar.tsx` |

---

### 5. 3D Viewport & Engine Layer (`src/components/viewport/` & `src/engine/`)

| Component / Engine | File Path | Responsibilities & Behavior | Inter-File Connections |
|---|---|---|---|
| `SceneViewport` | `src/components/viewport/SceneViewport.tsx` | R3F `<Canvas>` container, WebGL2 high-performance renderer, background `#09090b` | Wraps `SceneCamera`, `DefaultScene`, `ViewportHUD`, `PreviewCameraControls` |
| `SceneCamera` | `src/components/viewport/SceneCamera.tsx` | Locked render camera at `(0, 0, 50)` looking at origin `(0, 0, 0)`. Resets coordinates when activeCamera switches to 'scene' | Consumes `useCameraStore` |
| `DefaultScene` | `src/components/viewport/DefaultScene.tsx` | Clean studio lighting setup (Hemisphere sky/ground light + Key Light + Cyan/Indigo rim lights) + infinite DoubleSide spatial grid | Child of `SceneViewport` |
| `ViewportHUD` | `src/components/viewport/ViewportHUD.tsx` | Viewport overlay: corner reticles (`┌ ┐ └ ┘`) + bottom camera switcher (`SCENE CAM` / `PREVIEW`) | Consumes `useCameraStore` |
| `PreviewCamera` | `src/components/viewport/PreviewCamera.tsx` | R3F frame loop component driving WASD fly flight | Calls `DualCameraEngine.ts` in `useFrame` |
| `DualCameraEngine` | `src/engine/camera/DualCameraEngine.ts` | Non-React vector state manager for WASD movement calculation (`W/A/S/D` + `Shift/Ctrl` vertical elevation) | Called by `PreviewCamera.tsx` |
| `ShortcutManager` | `src/engine/shortcuts/ShortcutManager.ts` | Centralized action registry mapping keyboard `e.code` to callback handlers with text-input safety | Subscribed by `App.tsx`, displayed in `ShortcutSettingsModal` |

---

### 6. Audio Engine & Components (`src/engine/audio/` & `src/components/audio/`)

| Component / Engine | File Path | Responsibilities & Behavior | Inter-File Connections |
|---|---|---|---|
| `MultiTrackRack` | `src/engine/audio/MultiTrackRack.ts` | Singleton Web Audio API engine: lazy AudioContext init, MP3/WAV/OGG decode, synchronized play/pause/seek, per-track GainNode for solo/mute/volume, loop region support, rAF clock sync | `useAudioStore`, `TransportBar`, `App.tsx`, `TrackRow` |
| `WaveformCanvas` | `src/components/audio/WaveformCanvas.tsx` | Canvas-rendered peak waveform from AudioBuffer. Downsamples to pixel width, draws past/future color split + playhead line | `TrackRow.tsx` |
| `TrackRow` | `src/components/audio/TrackRow.tsx` | Individual stem row: color indicator, name, Solo/Mute toggles, volume slider, waveform display, hover-delete button | `useAudioStore`, `WaveformCanvas`, `MultiTrackRack` |

---

### 7. Utilities (`src/utils/`)

| File Path | Role & Purpose | Consumed By |
|---|---|---|
| `src/utils/stemColors.ts` | Rotating stem color palette (8 colors from Design System v2), unique ID generation | `MediaStemsPage.tsx` |

---

### 8. Workspace Pages (`src/components/pages/`)

| Page Component | Workspace Tab | Content & State Mounted |
|---|---|---|
| `MediaStemsPage.tsx` | 1. Media & Stems | Drag-and-drop audio import, decode-to-buffer, track rack with waveform + solo/mute/volume |
| `ShapesScenePage.tsx` | 2. Scene & Shapes | R3F 3D Viewport (`SceneViewport`) + Hierarchy & Shape Inspector |
| `NodeGraphPage.tsx` | 3. Routing | Placeholder → Stacked List & React Flow Node Canvas (Phase 4) |
| `CameraPage.tsx` | 4. Camera | R3F 3D Viewport (`SceneViewport`) + Camera Spline Inspector (Phase 6) |
| `DeliverPage.tsx` | 5. Deliver | Placeholder → Multi-track NLE Timeline & WebCodecs Export (Phase 5 & 7) |

---

## 📈 IMPLEMENTATION STATUS TRACKER

- [x] **Phase 1A**: Vite + React 19 + TypeScript 6 Scaffold
- [x] **Phase 1B**: TailwindCSS v4 with `@theme` Tokens (Design System v2)
- [x] **Phase 1C**: Zustand Stores Skeleton & TypeScript Interfaces (5 Stores, 5 Type Files)
- [x] **Phase 1D**: DaVinci Workspace Shell (TopBar, WorkspaceNavBar, TransportBar, 5 Pages)
- [x] **Phase 1E**: R3F 3D Viewport Canvas, Scene Camera (0,0,50), Studio Lighting & DoubleSide Floor Grid
- [x] **Phase 1F**: Dual Camera Engine & WASD Fly Controls
- [x] **Phase 1G**: Remappable Keyboard Shortcuts System & Settings Modal
- [x] **Phase 2A**: Web Audio API Multi-Track Engine (MultiTrackRack singleton)
- [x] **Phase 2B**: DAW Stem Track Rack UI (MediaStemsPage, WaveformCanvas, TrackRow, drag-drop import)
- [ ] **Phase 3A**: Scene Object Layer Stack (Figma/Blender Outliner)
- [ ] **Phase 3B**: Shape Factory & Shape Inspector

