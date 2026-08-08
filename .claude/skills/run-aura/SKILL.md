---
name: run-aura
description: Launch AURA Studio in a real browser and drive it — screenshot every page, import a stem, build a look, export an MP4 and measure the decoded frames. Use whenever a change needs verifying against pixels rather than tests, or when asked to run/screenshot/test the app.
---

# Running AURA Studio

Structural tests do not catch what this app gets wrong. Every defect found by actually
running it — D9 (infinite render loop), D11 (lights arriving at 0.12 candela), D14 (post
rendering at 1×1), D18 (the 4K preset unable to encode) — was invisible to 350 passing tests.
Run it.

## 1 · Dev server

```bash
cd aurav2 && (npm run dev > "$TEMP/aura-dev.log" 2>&1 &) ; sleep 6; cat "$TEMP/aura-dev.log"
```

Vite serves on **5173**. Confirm with `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.

**If the log says `Port 5173 is in use, trying another one...`, a previous run is still alive.**
Stop it before starting another — do not just accept the new port. Six orphans accumulated in one
session that way, each still holding a port and still recompiling on every edit.

### Stopping it — `pkill -f vite` does NOT work here

Vite runs as `node.exe` with `vite.js` as an *argument*. `pkill -f vite` matches nothing, **exits 0,
and looks like it worked**. Use PowerShell and match the command line:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*vite*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Verify, rather than trusting the kill:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5173,5174,5175,5176,5177,5178 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, OwningProcess
```

Empty output means clean. Check the `CommandLine` before killing if anything else on the machine
might be running node — the filter above catches *every* vite, including one the user started
themselves.

## 2 · Browser

Playwright is not a dependency of the project — install it in the scratchpad, not the repo:

```bash
cd "$SCRATCH" && npm init -y && npm install playwright@latest
npx playwright install chromium
```

**WebGL needs these flags or every screenshot is a blank frame** that reads as a layout bug
rather than a missing GPU:

```js
args: ['--use-gl=angle', '--use-angle=swiftshader',
       '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
```

Confirm the context is real before trusting any shot:

```js
const gl = canvas.getContext('webgl2')
gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)
// → "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device …"
```

SwiftShader is software rendering — roughly two orders of magnitude slower than a GPU.
**Export at 720p, never 4K**, or the render outlives any sane timeout. That is the harness
being slow, not the app.

## 3 · Driving it

Tabs have stable ids: `#tab-media-stems`, `#tab-scene-shapes`, `#tab-look`, `#tab-routing`,
`#tab-camera`, `#tab-deliver`. Allow ~900 ms after a switch for the viewport to reposition.

Useful handles, all stable because they are titles rather than text:

| Action | Selector |
|---|---|
| Import stems | `div.border-dashed` (the empty-state drop zone) |
| Add post effect | `[title="Add an effect"]` then `button:has-text("Bloom")` |
| Add camera behaviour | `[title="Add a behaviour"]` then `button:has-text("Orbit")` |
| Capture a state | `[title^="Capture what is currently visible"]` |
| Place a strip | `button[title^="Place it on the timeline"]` |
| Resolution | `page.selectOption('select', { value: '720p' })` |
| Auto-sequence | `button:has-text("Auto")` in the Deliver states rail |

**Never use a bare `header >> button`.** It resolves to the topbar's *undo* arrow, which
silently reverts the edit you just made — an earlier run spent a whole cycle chasing "the
object is missing from the export" that was this selector undoing the add.

### Importing audio

The app refuses hidden `<input>` elements by design (03-ARCHITECTURE §1 — everything goes
through the platform adapter). Delete the picker before boot to force the adapter's own
documented `<input>` fallback, which is a real code path:

```js
await page.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker })
const chooser = page.waitForEvent('filechooser')
await page.click('div.border-dashed')
await (await chooser).setFiles(wav)
await page.waitForTimeout(6000)  // decode + offline MIR in a worker
```

Generate the WAV rather than shipping a fixture — a 3-second four-on-the-floor kick at
44.1 kHz gives the analyser a real tempo and onsets. `drive4.mjs` beside this file has `makeWav`.
Note the tempo comes back an octave low (D24), so do not assert on the BPM readout.

## 4 · Judging the output

A muxed MP4 proves nothing. Four checks, in order:

1. **Box structure** — `ftyp` / `moov` / `mdat` present, `avc1` and `mp4a` in the bytes.
2. **Pixels** — decode in a `<video>`, draw to a canvas, read `getImageData`. Report mean
   luma, max luma and lit percentage. A file that muxes cleanly and renders black is the
   failure worth catching.
3. **Motion** — sample ten frames and count pixels that changed by more than 24. A static
   video from an animated scene passes every check above. Expect **~15–20 %** changed with a
   camera Orbit behaviour on; under 1 % means the clock is not advancing.
4. **Structure**, when the project is sequenced — sample ~25 frames and print mean luma as a
   bar chart. This is the check that proved auto-sequence works: luma should *step* at each
   strip boundary and hold flat within a strip. A flat line across the whole file means cuts
   are not reaching the render; noise within a strip means something non-deterministic is.
   `Cut Flash` shows up as a single sample near 100 % lit, so a boundary you can see in the
   chart is a boundary the exporter honoured.

The scripts live beside this file — copy them to the scratchpad and run from there, so
`node_modules` stays out of the repo:

| Script | Does |
|---|---|
| `drive4.mjs` | The full path: stem → shape → bloom → camera orbit → export. Has `makeWav` |
| `verify.mjs` | Check 2 — decodes and reports luma per frame, writes a mid frame as PNG |
| `diff.mjs` | Check 3 — inter-frame changed-pixel percentage |
| `cuts.mjs` | Check 4 — 25-sample luma bar chart, for reading strip boundaries |

Each takes `DL_DIR`, `SHOT_DIR` and `MP4` from the environment.

## 5 · Look at the screenshots

Not the console output. Layout defects — panels overlapping, a rail squeezed to four lines,
a hint sentence clipped mid-word, an object the same colour as every other object — are only
visible in the image, and several shipped because nobody opened one.
