/** Decodes the exported MP4 in Chromium and reports real pixel content per frame.
 *  A file that muxes cleanly but renders black is the failure mode worth catching. */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DL = process.env.DL_DIR
const OUT = process.env.SHOT_DIR
const b64 = readFileSync(join(DL, process.env.MP4 ?? 'out.mp4')).toString('base64')

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setContent('<body style="margin:0;background:#222"><video id=v muted></video></body>')

const report = await page.evaluate(async (data) => {
  const v = document.getElementById('v')
  v.src = 'data:video/mp4;base64,' + data
  await new Promise((res, rej) => {
    v.onloadedmetadata = res
    v.onerror = () => rej(new Error('decode failed'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = v.videoWidth
  canvas.height = v.videoHeight
  const ctx = canvas.getContext('2d')

  const seek = (t) =>
    new Promise((res) => {
      v.onseeked = res
      v.currentTime = t
    })

  const frames = []
  for (const t of [0.1, v.duration * 0.25, v.duration * 0.5, v.duration * 0.9]) {
    await seek(t)
    ctx.drawImage(v, 0, 0)
    const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let sum = 0
    let max = 0
    let lit = 0
    for (let i = 0; i < px.length; i += 4) {
      const l = (px[i] + px[i + 1] + px[i + 2]) / 3
      sum += l
      if (l > max) max = l
      if (l > 24) lit++
    }
    frames.push({
      t: +t.toFixed(2),
      meanLuma: +(sum / (px.length / 4)).toFixed(2),
      maxLuma: max,
      litPercent: +((lit / (px.length / 4)) * 100).toFixed(1),
    })
  }

  // Middle frame out, for eyeballing.
  await seek(v.duration * 0.5)
  ctx.drawImage(v, 0, 0)
  return {
    width: v.videoWidth,
    height: v.videoHeight,
    duration: +v.duration.toFixed(2),
    frames,
    png: canvas.toDataURL('image/png'),
  }
}, b64)

const { png, ...rest } = report
console.log(JSON.stringify(rest, null, 2))
writeFileSync(join(OUT, 'frame-mid.png'), Buffer.from(png.split(',')[1], 'base64'))
await browser.close()
