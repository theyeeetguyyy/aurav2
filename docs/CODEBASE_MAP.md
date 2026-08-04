# Codebase Map

File-by-file registry. **Update this in the same commit that adds or moves a file** —
the previous version of this document drifted within a single phase.

Constraint references (HC-n) point at [03-ARCHITECTURE.md](03-ARCHITECTURE.md).

---

## Data flow

```
  audio file
      │
      ▼
 ┌──────────────┐   decode
 │MultiTrackRack│───────────┬──────────────────────────────┐
 └──────┬───────┘           │                              │
        │ schedule          ▼ copy + transfer              ▼ pre-fader tap (HC-11)
        │            ┌──────────────┐              ┌────────────────┐
        │            │analysis.worker│ own FFT      │RealtimeAnalyser│ Meyda
        │            └──────┬───────┘              └───────┬────────┘
        │                   ▼ once, on import              ▼
        │            ┌──────────────┐              ┌────────────────┐
        │            │ AudioFeatures│              │  AudioDataBus  │ live only,
        │            │ sample(id,k,t)│             └────────────────┘ mic input (future)
        │            └──────┬───────┘
        ▼                   │
 ┌──────────────┐           │  f(t) — deterministic, any order
 │TransportClock│           │
 └──────┬───────┘           │
        │ time              ▼
        ├──────────▶ ┌─────────────────┐   Map<addressKey, offset>
        │            │ModulationMatrix │───────────────┐
        │            └─────────────────┘               │
        │              ▲ connections/triggers          │
        │              │ (passed in, not imported)     │
        │        useModulationStore                    │
        │                                              ▼
        │                                    ┌──────────────────┐
        ├───────────────────────────────────▶│   SceneObjects   │ useFrame writes
        │                                    │   DualCameraRig  │ straight to Three
        │                                    └──────────────────┘
        │
        ├──▶ WaveformCanvas · SourceList meters   (imperative, no React)
        │
        └──▶ useTransportTime()  ──▶ React components   (throttled 12 Hz)
                                          ▲
                          Zustand stores ──┘  (coarse state only)
```

**The rule the diagram encodes.** Two paths, and they never cross:

- **Frame rate** — `AudioFeatures` → `ModulationMatrix` → `useFrame` → Three.js objects.
  Typed arrays and imperative writes. Zero React (HC-1).
- **Human rate** — Zustand → React. Only values a person needs to *watch*, throttled.

**The other rule.** `AudioFeatures.sample(track, metric, t)` is a function of time, not
of "now" (HC-3). That single property is what lets `FrameClock` render frame 5000 before
frame 12 and still produce exactly what was previewed.

---

## `src/types/` — pure declarations, zero runtime

| File | Contains | Status |
|---|---|---|
| `audio.ts` | `Track`, `TrimBounds`, `AnalysisData`, `StemMetrics`, `ID` | current |
| `generator.ts` | `Generator`, `GeneratorType` — synthetic stems (D-37) |
| `params.ts` | `ParamAddress`, `ParamDescriptor`, `FieldRef`, `ParamValue`, address serialisation, `denormalise()` (HC-5). `ParamType` includes `stem`, whose options are the loaded tracks rather than a static list | current |
| `visual.ts` | `SceneObject`, `RenderBackend`, `MeshKind`, `Transform3D`, `MaterialParams`, `EffectInstance`, `POST_STACK_ID` (HC-4). `MaterialParams` is an open record now, not a fixed struct (D-43) | current |
| `modulation.ts` | `ModulationConnection`, `SignalChain`, `EventTrigger`, defaults | current — both ends are `FieldRef` / `ParamAddress`; the closed unions are gone (HC-5) |
| `camera.ts` | `SceneCamera`, `PreviewCamera`, `CameraKeyframe`, `SplineWaypoint`, `CameraConstraint` | current |
| `project.ts` | `VisualState`, `Strip`, `SectionMarker`, `Project` | ⚠️ needs `activeConnectionIds` / `connectionOverrides` (HC-8) — Phase 6A |

## `src/store/` — Zustand

| Store | Owns | Notes |
|---|---|---|
| `historyHook.ts` | The seam stores use to record an undoable change. Holds a callback only, so the bridge and the stores cannot cycle |
| `useUIStore.ts` | active page, dock sizes, collapse state, `preImmersiveDocks`, patchbay column widths | immersive view restores prior dock state |
| `useAudioStore.ts` | tracks, trim, solo/mute/volume, loop, `isPlaying` | **no playhead** — that is TransportClock (HC-1). Exports `isTrackVisuallyActive()` |
| `useCameraStore.ts` | active camera view, control mode, keyframes, waypoints, constraints | |
| `useModulationStore.ts` | global connections, event triggers | project-global by design (HC-8) |
| `useProjectStore.ts` | states library, strips, markers, project meta | |
| `useGeneratorStore.ts` | Synthetic stems — LFOs and noise (D-37). Own store, not folded into `useAudioStore`, which would mean a dozen permanently-null fields |
| `useSceneStore.ts` | **the SceneObject layer stack** — array order *is* layer order; param writes by address | exports `useSelectedObject()` |
| `usePostStore.ts` | The project-global post chain. Array order is evaluation order; owns the master bypass (D-42) |
| `useAutomationStore.ts` | One lane per stem plus any detached ones. `ensureStemLane` on import, `materialise` on first edit, `resetToAnalysis`. Exports `getLane()` for the field context — passed into the engine, never imported by it |
| `useEnvironmentStore.ts` | Background, fog, lighting, reflections, grid — one flat record per section (D-44) |

> No store may hold an `AudioBuffer`, a `THREE.Object3D`, a GPU handle, or a DOM node.

## `src/engine/` — no React below this line

### `engine/time/`

| File | Role |
|---|---|
| `Clock.ts` | The `Clock` interface plus `SteppedClock` and `FrameClock`. Anything not drivable by `FrameClock` cannot be exported (HC-2). |
| `TransportClock.ts` | Live playhead singleton. Per-frame subscribers read imperatively; React uses `useTransportTime()`. |
| `timeAuthority.ts` | `activeClock()` — the seam the render path reads. Transport during preview, whatever the exporter installs during a render (D-45). |

### `engine/audio/`

| File | Role |
|---|---|
| `MultiTrackRack.ts` | AudioContext owner. Exports `resolveLoopRegion()` — an unset loop region means the whole project. Decode, per-track node chain, synchronised playback, seek, loop, trim-aware scheduling, project duration. Publishes to `TransportClock`. |
| `AudioDataBus.ts` | Fixed-capacity `Float32Array` bus, 9 floats per track slot. Pre-allocated so views never dangle. Zero React. |
| `RealtimeAnalyser.ts` | Per-track Meyda extraction from the **pre-fader** tap. Live path only — retained for future mic input; modulation does not read it. |
| `featureTypes.ts` | Shared worker/main contract. Imports nothing — the worker must stay free of stores and DOM. |
| `analysis.worker.ts` | Offline MIR. Own radix-2 FFT, 13 metrics, spectral-flux onset detection with adaptive median threshold, tempo from folded inter-onset histogram, **percentile normalisation per metric**. |
| `AudioFeatures.ts` | **The source of truth for audio-derived values.** `sample(track, metric, t)` — a value AT A TIME, deterministic in any call order. `lastOnsetAtOrBefore()` backs stateless event triggers. |

### `engine/modulation/`

| File | Role |
|---|---|
| `SignalShaper.ts` | One connection's chain: Gain → Rise/Fall → Min/Max → Weight. The only stateful part of modulation; reset on clock jumps. |
| `fields.ts` | `evaluateField()` + the source catalogue. Every field is a **pure function of time**. Takes a `FieldContext` rather than importing a store, which is how the engine boundary is kept. |
| `curve.ts` | Response curves — points + per-segment exponential tension, presets, `evaluateCurve()` (D-39) |
| `preview.ts` | Runs the real shaper over the real timeline for the drawn curve (D-41), and `reachableRange()` — the span the parameter ACTUALLY reaches given the signal that exists, as opposed to the span the settings allow |
| `ModulationMatrix.ts` | Per-frame evaluation into `Map<addressKey, offset>`. Weighted N:1 summing. Connections passed in, not read from a store, so the exporter can drive it with its own state. |

### `engine/scene/`

| File | Role |
|---|---|
| `BrickRegistry.ts` | The geometry-operator catalogue. Registration is data, never a switch statement. Caches built geometry by brick + parameter signature; owns disposal. |
| `backends/types.ts` | `GeometryBrick` contract, `canMorph()`, `defaultParams()`. `canMorph` is the single authority — the UI must never offer a morph a backend cannot perform. |
| `backends/proceduralMesh.ts` | **The morph-compatible family.** One welded 642-vertex icosphere displaced per shape. Exports `BASE_VERTEX_COUNT`, `assertMorphCompatible()`. |
| `backends/primitiveMesh.ts` | 10 native Three geometries. `morphGroup: null` — swap-only. |
| `backends/proceduralMesh.test.ts` | The shared-topology invariant (HC-4). 23 assertions. |
| `EffectRegistry.ts` | Catalogue of stackable effects — deformers, cloners and effectors under one roof, told apart by which method they carry. Separate from BrickRegistry because a geometry brick *builds* a mesh and an effect brick *modifies* one. |
| `DeformRuntime.ts` | Per-object working geometry. Shared geometry is never mutated — an object with deformers gets a private copy; one without allocates nothing. |
| `effects/types.ts` | `DeformerBrick` contract. Whole-array, not per-vertex callback. |
| `effects/deformers.ts` | **15 deformers**, each a distinct class of vertex operation (D-38). No `time` in the contract — they cannot self-animate (D-36). See [12-DEFORMERS.md](12-DEFORMERS.md). |
| `effects/noise.ts` | Stateless 3D value noise + fbm. Stateless because deformers must be pure functions of time (HC-3). |
| `cloners/types.ts` | `ClonerBrick` / `EffectorBrick`, `CloneBuffers` (structure-of-arrays), `MAX_CLONES`. `EffectorContext` carries time; `DeformContext` still does not (D-47) |
| `cloners/cloners.ts` | Three layouts — radial, linear, grid. Three and not thirty: anything else is a layout plus an effector |
| `cloners/effectors.ts` | Step, Random, Wave and **Time Delay**. Each is a weight function feeding one shared set of transform/tint outputs |
| `cloners/CloneRuntime.ts` | Per-object clone state. Buffers allocated once at MAX_CLONES, so clone count is drivable at frame rate. Restarts from the layout every frame (HC-3) |

### `engine/post/` — whole-frame effects (4I)

| File | Role |
|---|---|
| `types.ts` | `PostBrick` / `PostHandle` contract, `PostContext` (carries clock time — D-46), descriptor helpers. A handle's node is either a mergeable `Effect` or a `Pass` that owns render targets |
| `PostRegistry.ts` | The catalogue, grouped Glow · Distort · Time · Colour · Texture |
| `bricks/builtins.ts` | Seven wrappers over `postprocessing` effects. Re-declared rather than exposed raw, so every knob arrives as a `ParamDescriptor` with a real range (HC-5) |
| `bricks/shaders.ts` | Six hand-written effects — Kaleidoscope, Mirror, Zoom Blur, Colour Grade, Palette, Film Grain. `resolution`/`aspect`/`time` are supplied by the material and must not be re-declared; the composer's `time` is banned (HC-2) |
| `bricks/feedback.ts` | Feedback Trails. The only stateful thing in the render path — ping-pong frame history, cleared on any clock jump |

### `engine/environment/` — the world (4M)

| File | Role |
|---|---|
| `sections.ts` | The five world sections and their descriptors. A fixed set, not an open stack — a scene has one background (D-44) |

### `engine/scene/materials/` — shading models (4L)

| File | Role |
|---|---|
| `types.ts` | `MaterialBrick` / `MaterialHandle`. Descriptor keys carry the `material.` prefix; stored values do not — `materialKey()` is the single place that bridges them |
| `materials.ts` | Seven models: Standard, Physical, Unlit, Gradient, Fresnel Rim, Toon, Normal. The unlit family matters more than it looks — bloom and feedback key off bright flat colour |
| `MaterialRegistry.ts` | Catalogue + `migrateParams()`, which carries shared values across a model swap |

### `engine/scene/lights/` — light objects (4N)

| File | Role |
|---|---|
| `types.ts` | `LightBrick` / `LightHandle`. `intensityParam()` deliberately ships headroom and an exp curve — a trigger that can only add 0.2 is a nudge, not a flash |
| `lights.ts` | Point, Spot, Sun, Area, Ambient. Aiming lights parent a target down -Z so the object's rotation aims the beam |
| `LightRegistry.ts` | The catalogue. Fifth registry, same contract as the other four |

### `engine/automation/` — hand-drawn signals (5F)

| File | Role |
|---|---|
| `lane.ts` | `sampleLane()`, `decimate()` and the edit primitives. A lane in `analysis` mode holds no points and defers to the feature timeline (D-55). Holds end values outside the drawn range (Blender NLA's `hold`) — a lane drawn over the chorus must not mute the parameter everywhere else |

### `engine/commands/` — undo (3F)

| File | Role |
|---|---|
| `CommandHistory.ts` | `{label, undo, redo}` closures, coalescing by key inside 600 ms, bounded at 50, re-entrancy guard. Knows nothing about state |

### `engine/export/` — offline render (8A/8B)

| File | Role |
|---|---|
| `types.ts` | `ExportSettings`, progress, resolution/fps presets (resolves Q9), and the `FrameSource` registry |
| `Mp4Encoder.ts` | WebCodecs H.264 + AAC into `mp4-muxer`. Backpressure via `encodeQueueSize`; `canExport()` says up front when the browser cannot |
| `VideoExporter.ts` | The loop. Installs a `FrameClock`, steps frames, captures each in the SAME task as its draw, restores the clock on every exit path |
| `audioMixdown.ts` | `OfflineAudioContext` mixdown honouring trim, volume and solo. Deterministic, like the visual side |

### `engine/platform/` — host capability (3E)

| File | Role |
|---|---|
| `PlatformAdapter.ts` | The interface, plus `setPlatform()` / `platform()`. Nothing outside this folder may touch a file picker or a download anchor |
| `fileHandles.ts` | `FileSystemFileHandle` persistence in IndexedDB, so a reopened project finds its own stems (D-56). Degrades quietly where IndexedDB or the picker is unavailable |
| `WebPlatform.ts` | Browser implementation. File System Access API where present, `<input>` + download anchor where not. `canRelinkByPath` is true where handles persist — audio comes back without re-picking (D-56) |

### `engine/project/` — the project file (8E)

| File | Role |
|---|---|
| `schema.ts` | `AuraProject` + base64 `Float32Array` codec. Stems referenced, feature timelines embedded |
| `projectFile.ts` | Encode/decode with versioning. Refuses a newer file rather than half-reading it; fills what an older one predates |

### `engine/params/`

| File | Role |
|---|---|
| `ParamRegistry.ts` | Universal transform/material descriptors, `describeObject()`, `resolveDescriptor()`, `readParam()`, `modulationTargets()`. Every consumer reads parameter metadata from here — nothing hardcodes a parameter list. |

### `engine/camera/`

| File | Role |
|---|---|
| `behaviours.ts` | Orbit / Sway / Shake / Dolly / Lens. Pure functions of clock time, summed into a `CameraRig` (D-50) |
| `DualCameraEngine.ts` | Authoritative transforms for both cameras. Separates the **authored** `baseScene*` from the **resolved** `scene*` — behaviours are additive, so writing onto the authored value would accumulate. Owns `alignSceneToPreview()`. Fly movement, mouse-look, reference-counted input attach with text-field guards and key-release-on-blur. |

### Not yet created

`engine/platform/` (adapter) ·
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
| `project/UndoButtons.tsx` | Undo/redo with the pending action's name in the tooltip |
| `project/ProjectActions.tsx` | Save · Open · Relink. Relink appears only while stems have no audio |
| `workspace/WorkspaceNavBar.tsx` | 5 DaVinci-style workspace tabs |
| `shell/TransportBar.tsx` | Persistent transport. Timecode via `useTransportTime()` |
| `shell/WorkspaceLayout.tsx` | Shared left/centre/right dock grid. Docked CSS Grid — no floating panels, no z-index wars |
| `common/ErrorBoundary.tsx` | Contains a crash to one panel. Page and viewport are wrapped separately, so a broken panel cannot destroy the WebGL context |
| `common/Splitter.tsx` | 1px draggable divider, shared by the docks and the patchbay columns. Absolute-position based, so it never drifts from the pointer |
| `common/ShortcutSettingsModal.tsx` | Rebinding UI — click a row, press a chord, conflicts reported |
| `common/ScrubField.tsx` | Pointer-lock scrub control. Range, step and unit all come from the `ParamDescriptor` — nothing parameter-specific is hardcoded |

### Scene

| File | Role |
|---|---|
| `scene/LayerStack.tsx` | Outliner + brick library. Bricks grouped by morph family, because that grouping is what matters before picking a shape |
| `scene/Inspector.tsx` | Fully descriptor-driven. Knows nothing about radius or roughness — renders whatever `ParamRegistry` describes |
| `scene/ParamField.tsx` | One parameter row. Shows base value *and* the live modulated value, polled at 15 Hz — modulation never enters React, so the UI samples it |
| `scene/EffectStack.tsx` | Deformer stack: add, reorder, enable, remove. Order is evaluation order |
| `scene/WorldPanel.tsx` | The five world sections. Sits above Post because that is the order a frame is built |
| `scene/PostStack.tsx` | The post chain with inline parameters, grouped effect picker and a master bypass. A/B against the untreated render is one click |

### Routing

| File | Role |
|---|---|
| `routing/patchbay/Patchbay.tsx` | The routing surface. Two **resizable** columns + wire layer, drag-to-connect, descriptor-seeded default ranges |
| `routing/patchbay/SourceColumn.tsx` | Every Field, grouped by stem, plus the Generators section. Each dot is a drag handle with a live level meter behind the label |
| `routing/patchbay/TargetColumn.tsx` | Every drivable parameter incl. deformer params. Rows carry `data-target-id` for drop detection |
| `routing/patchbay/WireLayer.tsx` | SVG beziers measured from DOM anchors. Geometry recomputed on change; **pulse animated per-frame imperatively** |
| `routing/patchbay/anchors.ts` | DOM anchor registry. Wires connect real elements, so columns stay plain scrollable lists. `refreshAnchors()` re-measures after a column resize, which no observer would catch |
| `routing/patchbay/dragState.ts` | In-flight drag, kept outside React — only the coarse "is dragging" flag reaches it |
| `routing/WireInspector.tsx` | Right dock: selected wire's endpoints, enable/delete, chain or trigger settings |
| `routing/ConnectionInspector.tsx` | Real value range, modulation graph, curve editor, chain — in the order you think about them |
| `routing/CurveEditor.tsx` | SVG response-curve editor. Drag points, drag segments to bend, double-click add, Alt-click remove |
| `routing/ModulationGraph.tsx` | The parameter's real value over time, plus a ghost of the raw signal. Canvas, imperative |
| `routing/patchbay/StemSignalStrip.tsx` | Each stem's own signal over time — the shape everything wired from it inherits |
| `routing/ChainEditor.tsx` | Per-connection signal chain, presented in evaluation order |
| `automation/LaneEditor.tsx` | The draw surface. Canvas, sampled per pixel so the drawn line matches what the engine reads; painting replaces what is under the stroke rather than overlaying it |
| `automation/StemAutomation.tsx` | One stem's curve, under its own waveform, with a metric picker, an `edited` marker and Reset. The primary path (D-55) |
| `automation/AutomationPanel.tsx` | Detached lanes — the exception, for a shape the music does not contain |
| `camera/CameraRigPanel.tsx` | Scene Camera behaviour stack, Look-At target, Align-to-view |
| `routing/targetInfo.ts` | Resolves any target address — SceneObject, post chain or world — to descriptor, base value and labels. Lives here rather than in `ParamRegistry` because it reads stores, and `engine/` may not |

### Viewport

| File | Role |
|---|---|
| `viewport/PersistentViewport.tsx` | **The one and only Canvas** (HC-9). Mounted in the shell, never unmounted; tracks the active `ViewportSlot` rect and pauses its frameloop when no page shows it |
| `viewport/ViewportSlot.tsx` | Empty div a page mounts to say "draw the viewport here". `compact` hides the HUD, `interactive={false}` makes it a monitor |
| `viewport/SceneMonitor.tsx` | Live scene panel for non-3D pages. Relocates the one renderer — not a copy, not a second context |
| `viewport/viewportSlotRegistry.ts` | Current slot element + subscribers. Named `…Registry` because `viewportSlot.ts` collides with `ViewportSlot.tsx` on case-insensitive filesystems |
| `viewport/DualCameraRig.tsx` | **Two real cameras**, explicit active-camera binding, mutually exclusive Fly/Orbit (HC-10) |
| `viewport/EnvironmentRig.tsx` | The world: gradient background, fog, three-point rig, `RoomEnvironment` reflections, authoring grid. Replaced the hardcoded `DefaultScene`. Values applied in `useFrame`, never as props (HC-1) |
| `viewport/PostChain.tsx` | The composer. Mounted only while something is enabled — a `useFrame` at priority ≥ 1 takes the render loop from R3F, so unmounting is what hands it back. Rebuilt on stack SHAPE change only |
| `viewport/ExportBridge.tsx` | Publishes the live renderer to the exporter. Forces the Scene Camera and hides the gizmo layer for the render (HC-10) |
| `viewport/CameraRigDriver.tsx` | Resolves the Scene Camera from its behaviour stack. Mounted before `DualCameraRig`, which copies the result onto the real camera |
| `viewport/SceneLight.tsx` | Renders one light object, plus its authoring gizmo on `GIZMO_LAYER` — both cameras show that layer, the exporter disables it on the Scene Camera |
| `viewport/SceneObjects.tsx` | Dispatches on object type — lights to `SceneLight`, everything else to a mesh. Renders the layer stack. Object transform lives on a `<group>`; below it either one `<mesh>` or an `<instancedMesh>` when the stack has a cloner. Geometry from `BrickRegistry` (cached, never disposed here). **Applies modulation imperatively in `useFrame`** — never through props or state (HC-1) |
| `viewport/ModulationDriver.tsx` | Evaluates the matrix once per frame, before anything reads it. Reads stores with `getState()`, never a hook |
| `viewport/ViewportHUD.tsx` | Reticles, camera + control-mode switchers. Flat, no blur |

### Audio

| File | Role |
|---|---|
| `audio/TrackRow.tsx` | Stem row: colour, name, solo, mute, volume, waveform, delete |
| `audio/WaveformCanvas.tsx` | Two static canvas layers + clip-path progress. **Never repaints during playback**. Drawn against the PROJECT duration, so every stem shares one time scale |
| `audio/TrimHandles.tsx` | Draggable trim in/out with pointer capture |
| `audio/RackPlayhead.tsx` | ONE playhead for the whole rack, measured off a real lane element rather than a hardcoded control width |

### Pages

| File | Tab | State |
|---|---|---|
| `pages/MediaStemsPage.tsx` | 1 · Media & Stems | built |
| `pages/ShapesScenePage.tsx` | 2 · Scene & Shapes | built — layer stack ∣ viewport ∣ inspector |
| `pages/LookPage.tsx` | 3 · Look | built — world & lighting ∣ viewport ∣ post chain |
| `pages/NodeGraphPage.tsx` | 4 · Routing | built — patchbay |
| `pages/CameraPage.tsx` | 5 · Camera | viewport only — Phase 7 |
| `pages/DeliverPage.tsx` | 6 · Deliver | placeholder — Phase 6 & 8 |

## `src/project/`

Where the engine and the stores are allowed to meet. `engine/project/` owns the format;
this owns the wiring.

| File | Role |
|---|---|
| `history.ts` | Wires `CommandHistory` to the stores. Captures a **slice** snapshot — never stems, audio or feature timelines |
| `projectBridge.ts` | `collectProject()` / `applyProject()` / `relinkStems()`. Tears down the previous session's audio before replacing the track list — without that the old stems keep playing under the new project |

## `src/hooks/` · `src/utils/`

| File | Role |
|---|---|
| `hooks/useTransportTime.ts` | Throttled playhead for display-only components (HC-1) |
| `hooks/useModulatedValue.ts` | Polls live modulation offsets for display. **One shared 15 Hz ticker** for all subscribers — the first version created a timer per field |
| `utils/units.ts` | Display suffix per parameter unit, so every readout spells a value the same way |
| `utils/tokens.ts` | Reads CSS custom properties for canvas/Three.js consumers, so viewport and chrome share one token source |
| `utils/stemColors.ts` | Rotating stem palette from tokens; `generateId()` via `crypto.randomUUID()` |

## Root

| File | Role |
|---|---|
| `index.html` | Entry, font preloads |
| `src/main.tsx` | ReactDOM root render |
| `src/index.css` | Tailwind v4 `@theme` tokens — the single home for design tokens |
| `vite.config.ts` | React + Tailwind plugins, `@/` → `src/` |
| `tsconfig.app.json` | Strict, `erasableSyntaxOnly` (no constructor parameter properties, no enums) |
| `.oxlintrc.json` | Lint config |

## Scripts

`npm run dev` · `typecheck` · `lint` · `test` (Vitest) · `test:watch` ·
`check` (typecheck + lint + test) · `build` · `preview`
