/** Dense sampling around the expected strip boundaries.
 *  A cut should show as a jump in scene content; the flash as a luma spike right at it. */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const b64 = readFileSync(join(process.env.DL_DIR, process.env.MP4)).toString('base64')
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setContent('<body><video id=v muted></video></body>')

const r = await page.evaluate(async (data) => {
  const v = document.getElementById('v')
  v.src = 'data:video/mp4;base64,' + data
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('decode')) })
  const c = document.createElement('canvas')
  c.width = v.videoWidth; c.height = v.videoHeight
  const ctx = c.getContext('2d')
  const seek = (t) => new Promise((res) => { v.onseeked = res; v.currentTime = t })

  const rows = []
  // 25 samples across the whole thing: fine enough to land inside a 0.12s flash.
  for (let i = 0; i <= 24; i++) {
    const t = Math.min((v.duration * i) / 24, v.duration - 0.02)
    await seek(t)
    ctx.drawImage(v, 0, 0)
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    let sum = 0, lit = 0
    for (let p = 0; p < px.length; p += 4) {
      const l = (px[p] + px[p + 1] + px[p + 2]) / 3
      sum += l
      if (l > 40) lit++
    }
    rows.push({
      t: +t.toFixed(2),
      luma: +(sum / (px.length / 4)).toFixed(1),
      lit: +((lit / (px.length / 4)) * 100).toFixed(1),
    })
  }
  return { duration: +v.duration.toFixed(2), size: [v.videoWidth, v.videoHeight], rows }
}, b64)

console.log(`${r.size[0]}x${r.size[1]}  ${r.duration}s`)
const peak = Math.max(...r.rows.map((x) => x.luma))
for (const x of r.rows) {
  const bar = '#'.repeat(Math.round((x.luma / peak) * 46))
  console.log(`${String(x.t).padStart(5)}s luma ${String(x.luma).padStart(6)} lit ${String(x.lit).padStart(5)}%  ${bar}`)
}
await browser.close()
