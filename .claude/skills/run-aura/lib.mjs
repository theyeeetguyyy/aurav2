import { chromium } from 'playwright'

export const STEMS_DIR = 'C:/Users/astit/Desktop/aura/aurav2/ridz stems'
export const STEMS = ['main_bass.mp3', 'kick_snare.mp3', 'cymbals.mp3'].map((f) => `${STEMS_DIR}/${f}`)
export const OUT = 'C:/Users/astit/Desktop/aura/renders'

export async function launch() {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  })
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true })
  const page = await context.newPage()
  const problems = []
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
  page.on('pageerror', (e) => problems.push('[pageerror] ' + e.message))
  await page.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  return { browser, page, problems }
}

export const tab = async (page, id) => { await page.click(`#tab-${id}`); await page.waitForTimeout(900) }

/** Import all three stems and wait for decode + offline analysis. */
export async function importStems(page) {
  await tab(page, 'media-stems')
  const chooser = page.waitForEvent('filechooser')
  await page.click('div.border-dashed')
  await (await chooser).setFiles(STEMS)
  await page.waitForTimeout(14000)
}

/** Pick the signals: onset on the bass, envelope on the two percussion stems. */
export async function selectMetrics(page, spec) {
  for (const [stem, metrics] of Object.entries(spec)) {
    const row = page.locator('div').filter({ hasText: new RegExp(`^${stem}`) }).first()
    const picker = row.locator('button[title*="signals you want"]').first()
    await picker.click()
    await page.waitForTimeout(350)
    for (const m of metrics) {
      await page.locator(`button:has-text("${m}")`).last().click()
      await page.waitForTimeout(250)
    }
    await page.keyboard.press('Escape')
    await page.mouse.click(800, 30)
    await page.waitForTimeout(300)
  }
}

/** Shorten the project so ten software-rendered exports finish this century. */
export async function trimTo(page, seconds) {
  const rows = page.locator('div[data-stem-lane]')
  const n = await rows.count()
  for (let i = 0; i < n; i++) {
    const lane = rows.nth(i)
    const box = await lane.boundingBox()
    if (!box) continue
    const handles = lane.locator('div.cursor-col-resize')
    const end = handles.last()
    const eb = await end.boundingBox()
    if (!eb) continue
    const total = await page.evaluate(() => window.aura.duration?.() ?? 0).catch(() => 0)
    // Fraction of the row width equal to the wanted seconds over the clip's own length.
    const target = box.x + box.width * Math.min(1, seconds / (total || seconds))
    await page.mouse.move(eb.x + eb.width / 2, eb.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(target, eb.y + box.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(250)
  }
}
