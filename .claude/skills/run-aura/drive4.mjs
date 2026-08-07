/** The real end-to-end test: stem + shape + camera motion + bloom, exported and measured.
 *
 *  Motion comes from a camera behaviour rather than a dragged wire — a behaviour is one
 *  click and guarantees per-frame movement, which is what makes "do the frames differ?" a
 *  meaningful question. Bloom is on because a post effect is the case that used to export at
 *  preview resolution and upscale (D-66).
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.SHOT_DIR
const DL = process.env.DL_DIR
mkdirSync(OUT, { recursive: true })
mkdirSync(DL, { recursive: true })

function makeWav(seconds = 3, rate = 44100, bpm = 128) {
  const n = seconds * rate
  const pcm = new Int16Array(n)
  const beat = (60 / bpm) * rate
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-(i % beat) / (rate * 0.06))
    pcm[i] =
      Math.max(
        -1,
        Math.min(
          1,
          Math.sin((2 * Math.PI * 60 * i) / rate) * env * 0.8 +
            Math.sin((2 * Math.PI * 220 * i) / rate) * 0.08,
        ),
      ) * 32767
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.byteLength, 4); h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.byteLength, 40)
  return Buffer.concat([h, Buffer.from(pcm.buffer)])
}

const wav = join(DL, 'kick.wav')
writeFileSync(wav, makeWav())

const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true })
const page = await context.newPage()

const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('[error] ' + m.text())
})
page.on('pageerror', (e) => problems.push('[pageerror] ' + e.message))

await page.addInitScript(() => {
  delete window.showOpenFilePicker
  delete window.showSaveFilePicker
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('shot', n) }
const tab = async (id) => { await page.click(`#tab-${id}`); await page.waitForTimeout(900) }
const sceneCount = () =>
  page.evaluate(() => (document.body.innerText.match(/SCENE · (\d+) OBJECT/) ?? [, '?'])[1])

// ── Stem ───────────────────────────────────────────────────────────────
await tab('media-stems')
const chooser = page.waitForEvent('filechooser')
await page.click('div.border-dashed')
await (await chooser).setFiles(wav)
await page.waitForTimeout(6000)

// ── Shape ──────────────────────────────────────────────────────────────
await tab('scene-shapes')
await page.click('button:has-text("Torus Knot")')
await page.waitForTimeout(800)
console.log('objects:', await sceneCount())

// ── Bloom ──────────────────────────────────────────────────────────────
await tab('look')
await page.click('[title="Add an effect"]')
await page.waitForTimeout(500)
await page.click('button:has-text("Bloom")')
await page.waitForTimeout(900)
await shot('30-bloom')
console.log('post active:', await page.evaluate(() =>
  (document.body.innerText.match(/(\d+) ACTIVE/) ?? [, '?'])[1]))

// ── Camera motion ──────────────────────────────────────────────────────
await tab('camera')
await page.click('[title="Add a behaviour"]')
await page.waitForTimeout(400)
await page.click('button:has-text("Orbit")')
await page.waitForTimeout(900)
await shot('31-orbit')
console.log('objects still:', await sceneCount())

// ── Export ─────────────────────────────────────────────────────────────
await tab('deliver')
await page.selectOption('select', { value: '720p' }) // keeps the SwiftShader render quick
await page.click('button:has-text("30 fps")')
await page.waitForTimeout(400)
await shot('32-ready')

const download = page.waitForEvent('download', { timeout: 300000 })
await page.click('button:has-text("Export MP4")')
await page.waitForTimeout(4000)
await shot('33-exporting')

const d = await download
const out = join(DL, 'motion.mp4')
await d.saveAs(out)
console.log('MP4:', statSync(out).size, 'bytes')
await shot('34-done')

console.log('\n--- problems ---')
console.log(problems.length ? [...new Set(problems)].slice(0, 20).join('\n') : '(none)')
await browser.close()
