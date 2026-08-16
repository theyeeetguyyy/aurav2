import * as B from './build.mjs'
import { RECIPES } from './recipes.mjs'
import { appendFileSync } from 'node:fs'

const only = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n))
const list = only.length ? RECIPES.filter((_, i) => only.includes(i + 1)) : RECIPES

for (const [i, recipe] of list.entries()) {
  const n = only.length ? only[i] : i + 1
  const t0 = Date.now()
  const { browser, page, problems } = await B.launch()
  const log = []
  const s = async (name, fn) => {
    try {
      const r = await fn()
      log.push(`  ${r && r.ok === false ? 'MISS' : 'ok  '} ${name}${r && r.ok === false ? ' — ' + r.why : ''}`)
      return r
    } catch (e) { log.push(`  FAIL ${name}: ${e.message.split('\n')[0].slice(0, 90)}`) }
  }

  try {
    await s('stems', () => B.readyStems(page))
    await s('metrics', () => B.setMetrics(page))
    await s('trim', () => B.trim(page, 6))
    await s('clear', () => B.clearScene(page))
    await recipe.build(page, s)

    const state = await page.evaluate(() => ({
      objects: window.aura.objects().map((o) => ({ b: o.backend, m: o.materialId, fx: o.effects.map((e) => e.effectId) })),
      wires: window.aura.connections().length,
      triggers: window.aura.triggers().length,
      post: window.aura.post(),
      strips: window.aura.strips().length,
      palette: window.aura.palette().colors[0],
      duration: window.aura.duration(),
    }))

    const bytes = await B.exportMp4(page, recipe.file, 30)
    const secs = Math.round((Date.now() - t0) / 1000)
    const line = [
      `\n## ${n} · ${recipe.file}  (${secs}s, ${(bytes / 1e6).toFixed(2)} MB)`,
      `   ${recipe.note}`,
      `   scene: ${JSON.stringify(state.objects)}`,
      `   wires ${state.wires} · triggers ${state.triggers} · post ${state.post.join(',')} · strips ${state.strips} · ${state.duration.toFixed(1)}s`,
      log.join('\n'),
      problems.length ? `   console: ${[...new Set(problems)].slice(0, 3).join(' | ')}` : '   console: clean',
    ].join('\n')
    console.log(line)
    appendFileSync('./report.md', line + '\n')
  } catch (e) {
    const line = `\n## ${n} · ${recipe.file} — ABORTED: ${e.message.split('\n')[0]}\n${log.join('\n')}`
    console.log(line)
    appendFileSync('./report.md', line + '\n')
  }
  await browser.close()
}
