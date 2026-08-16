import { launch, importStems, tab, OUT } from './lib.mjs'
import { statSync } from 'node:fs'
import { join } from 'node:path'

/* ── helpers ─────────────────────────────────────────────────────────────── */

export const wait = (page, ms) => page.waitForTimeout(ms)

export async function readyStems(page) {
  await importStems(page)
  await page.waitForFunction(
    () => { const t = window.aura.tracks(); return t.length === 3 && t.every((x) => x.analysed) },
    null, { timeout: 240000 })
}

/** bass → Onset, the other two keep Envelope. */
export async function setMetrics(page) {
  const pickers = page.locator('button[title*="signals you want"]')
  await pickers.nth(0).click(); await wait(page, 300)
  await page.locator('div.absolute button:has-text("Onset")').last().click(); await wait(page, 300)
  await page.locator('div.absolute button:has-text("Envelope")').last().click(); await wait(page, 300)
  await page.mouse.click(900, 25); await wait(page, 400)
}

/** Shorten every stem so ten software-rendered exports are finishable. */
export async function trim(page, seconds) {
  const total = await page.evaluate(() => window.aura.duration())
  const frac = Math.min(0.95, seconds / total)
  const toggles = page.locator('button[title="Show the waveform and trim handles"]')
  const n = await toggles.count()
  for (let i = 0; i < n; i++) { await toggles.nth(0).click(); await wait(page, 250) }

  const lanes = page.locator('div[data-stem-lane]')
  for (let i = 0; i < await lanes.count(); i++) {
    const lane = lanes.nth(i)
    const box = await lane.boundingBox()
    const end = lane.locator('div.cursor-col-resize').last()
    const eb = await end.boundingBox()
    if (!box || !eb) continue
    const y = box.y + box.height / 2
    await page.mouse.move(eb.x + eb.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(eb.x - 5, y, { steps: 3 })
    await page.mouse.move(box.x + box.width * frac, y, { steps: 20 })
    await page.mouse.up()
    await wait(page, 200)
  }
  return page.evaluate(() => window.aura.duration())
}

/** A new project ships with one object. Recipes build their own scene, so clear it first. */
export async function clearScene(page) {
  for (let i = 0; i < 8; i++) {
    const del = page.locator('[title="Delete"]')
    if (await del.count() === 0) break
    await del.first().click({ force: true })
    await wait(page, 200)
  }
}

export async function addShape(page, label) {
  await page.locator(`button[title="Add ${label}"]`).click()
  await wait(page, 700)
}

export async function selectObject(page, index = 0) {
  await page.locator('span[title*="double-click to rename"]').nth(index).click()
  await wait(page, 400)
}

/** Inspector → Effects → add a deformer / cloner / effector by name. */
export async function addEffect(page, name) {
  await page.locator('[title="Add an effect"]').last().click()
  await wait(page, 400)
  await page.locator(`button:has-text("${name}")`).last().click()
  await wait(page, 700)
}

/** Every number in the app is a ScrubField: a div, not an input. */
export async function setField(page, label, value, which = 'last') {
  const f = page.locator(`div[title^="${label} — drag to scrub"]`)
  const el = which === 'first' ? f.first() : f.last()
  await el.scrollIntoViewIfNeeded()
  await el.dblclick()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(String(value))
  await page.keyboard.press('Enter')
  await wait(page, 400)
}

export async function setBackend(page, mode) {
  await page.locator(`button:has-text("${mode}")`).first().click()
  await wait(page, 700)
}

export async function setMaterial(page, label) {
  await page.locator('select').nth(1).selectOption({ label })
  await wait(page, 600)
}

export async function setPalette(page, name) {
  await tab(page, 'look')
  await page.locator(`button[title="${name}"]`).first().click()
  await wait(page, 500)
}

export async function addPost(page, name) {
  await tab(page, 'look')
  await page.locator('[title="Add an effect"]').last().click()
  await wait(page, 400)
  await page.locator(`button:has-text("${name}")`).last().click()
  await wait(page, 800)
}

export async function addBehaviour(page, name) {
  await tab(page, 'camera')
  await page.locator('[title="Add a behaviour"]').click()
  await wait(page, 400)
  await page.locator(`button:has-text("${name}")`).last().click()
  await wait(page, 800)
}

/** Drag a source row onto a target row. `source` is the row's visible text. */
export async function wire(page, sourceText, sourceIndex, targetSuffix) {
  await tab(page, 'routing')
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll('[data-target-id]')].map((d) => d.getAttribute('data-target-id')))
  const key = targets.find((t) => t.endsWith(targetSuffix))
  if (!key) return { ok: false, why: `no target ${targetSuffix}` }

  const src = page.locator(`div[title*="Drag onto a parameter"]:has-text("${sourceText}")`).nth(sourceIndex)
  const tgt = page.locator(`[data-target-id="${key}"]`)
  await tgt.scrollIntoViewIfNeeded()
  const sb = await src.boundingBox(), tb = await tgt.boundingBox()
  if (!sb || !tb) return { ok: false, why: 'no box' }

  // An onset drop creates a TRIGGER, not a connection (D-30), so both have to be counted.
  const count = () => page.evaluate(() => window.aura.connections().length + window.aura.triggers().length)
  const before = await count()
  await page.mouse.move(sb.x + 100, sb.y + sb.height / 2)
  await page.mouse.down()
  await page.mouse.move(sb.x + 120, sb.y + sb.height / 2, { steps: 3 })
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 25 })
  await page.mouse.up()
  await wait(page, 600)
  const after = await count()
  return { ok: after > before, why: after > before ? '' : 'no connection made' }
}

export async function exportMp4(page, filename, fps = 30) {
  await tab(page, 'deliver')
  await page.selectOption('select', { value: '720p' })
  await page.locator(`button:has-text("${fps} fps")`).click()
  await wait(page, 500)
  const dl = page.waitForEvent('download', { timeout: 1800000 })
  await page.locator('button:has-text("Export MP4")').click()
  const d = await dl
  const out = join(OUT, filename)
  await d.saveAs(out)
  return statSync(out).size
}

export { launch, tab, OUT }
