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
| Surface / Points | `button:has-text("Points")` in the inspector header (only on a mesh brick) |
| Remove an effect | `[title="Remove"]` — visible without hovering, unlike the reorder arrows |

**Never use a bare `header >> button`.** It resolves to the topbar's *undo* arrow, which
silently reverts the edit you just made — an earlier run spent a whole cycle chasing "the
object is missing from the export" that was this selector undoing the add.

### Read the state instead of guessing at pixels

Development builds expose a read-only `window.aura` (`src/devBridge.ts`). Use it. A screenshot
cannot tell *the feature is broken* from *the click missed the button*, and three wrong turns in one
afternoon came from that ambiguity.

```js
await page.evaluate(() => window.aura.objects())   // + selection, palette, connections, states, strips, post, time
```

### Setting a numeric parameter

Every number in the inspector is a `ScrubField`: a `div`, not an `input`. `fill()` finds nothing and
`type=range` does not exist. Double-click to enter edit mode, then type:

```js
const f = page.locator('div[title^="Angle "]').last()   // title is `${label} — drag to scrub…`
await f.dblclick()
await page.keyboard.press('Control+a')
await page.keyboard.type('220')
await page.keyboard.press('Enter')
```

### Adding an effect proves nothing on its own

**Deformers rest at zero by design** — modulation is `base + Σ offsets`, so a bass-driven bulge must
start unbulged (D-111). Add a Twist and *nothing changes*, correctly. A check that adds an effect and
diffs the screenshot will report the whole feature dead; one did, and the conclusion was wrong.
Always drive the brick's `driver` parameter before comparing. The **at rest** badge in the effect
stack is the app telling you this.

Watch the mirror-image trap too: `DeformRuntime.resolve()` calls `computeVertexNormals()`, so merely
adding a deformer *does* shift a lit mesh's shading by a pixel or two. On a mesh, "the image changed"
is not evidence the deformer did anything.

### Check the drawing buffer, not just the screenshot

A screenshot looks identical whether the canvas is 2307×1733 or 14128×14128 — the browser scales it
into the same box. D-117 was a feedback loop that multiplied the canvas by the pixel ratio every
frame and killed the WebGL context, and it is invisible in an image. Two numbers catch it:

```js
await page.evaluate(() => {
  const c = document.querySelector('canvas')
  return { css: [c.clientWidth, c.clientHeight], drawing: [c.width, c.height],
           lost: c.getContext('webgl2')?.isContextLost() }
})
```

`drawing` should be `css × dpr` and should not move when an effect is added. Assert it after any
change to the post chain, the viewport sizing or the exporter.

### You cannot read the viewport's pixels from inside the page

`drawImage(canvas, …)` into a 2D context returns **blank**, and so does `gl.readPixels` after
compositing — the drawing buffer is not preserved. A colour check written that way reports "no lit
pixels" for a viewport that is plainly full of them, which reads as the feature being dead. It is the
instrument. Use `page.screenshot()` and measure the PNG, or decode the exported MP4.

### Screenshots block on fonts

`page.screenshot()` waits for `document.fonts.ready` and intermittently times out there mid-run,
which looks like the app hanging. Await it once after load and give the screenshots a real timeout:

```js
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ clip: CLIP, timeout: 60000 })
```

### Do not judge sub-10-pixel detail

Two limits compound. R3F renders at `dpr` (capped at 2), so a Playwright `deviceScaleFactor: 4`
screenshot **upscales** the canvas rather than rendering more pixels. And headless SwiftShader draws
small point sprites as hard squares that a real GPU may well draw round (open question in D-112).
Verify sizes, counts, colours and motion here; take dot and edge quality to real hardware.

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
