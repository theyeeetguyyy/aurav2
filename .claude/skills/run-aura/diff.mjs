/** Are consecutive exported frames actually different? A static video from an animated
 *  scene is the failure the luma stats cannot see. */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const b64 = readFileSync(join(process.env.DL_DIR, process.env.MP4)).toString('base64')
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setContent('<body><video id=v muted></video></body>')

console.log(JSON.stringify(await page.evaluate(async (data) => {
  const v = document.getElementById('v')
  v.src = 'data:video/mp4;base64,' + data
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error('decode')) })
  const c = document.createElement('canvas')
  c.width = v.videoWidth; c.height = v.videoHeight
  const ctx = c.getContext('2d')
  const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t })

  const grab = async (t) => { await seek(t); ctx.drawImage(v, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data }
  const out = []
  let prev = null
  for (let i = 0; i <= 10; i++) {
    const t = (v.duration * i) / 10
    const px = await grab(Math.min(t, v.duration - 0.05))
    if (prev) {
      let changed = 0
      for (let p = 0; p < px.length; p += 4) {
        if (Math.abs(px[p] - prev[p]) + Math.abs(px[p + 1] - prev[p + 1]) + Math.abs(px[p + 2] - prev[p + 2]) > 24) changed++
      }
      out.push({ t: +t.toFixed(2), changedPercent: +((changed / (px.length / 4)) * 100).toFixed(2) })
    }
    prev = px
  }
  return out
}, b64), null, 1))
await browser.close()
