// usage: node measure.mjs <label> [port]  -> writes <label>-<widget>.png and <label>.json beside this script
import { chromium } from '/Users/kimgranlund/Projects/nonoun/agent-ui/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const OUT = dirname(fileURLToPath(import.meta.url))
const R = process.argv[4] ?? '/Users/kimgranlund/Projects/nonoun/agent-ui/.claude/worktrees/wave-gu/'
const label = process.argv[2] ?? 'before'
const port = process.argv[3] ?? '5297'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`http://localhost:${port}/a2ui-catalog.html`)
await p.waitForTimeout(3000)
const res = await p.evaluate(async (R) => {
  const ex = await import('/@fs' + R + 'packages/agent-ui/a2ui/src/examples/index.ts')
  const cs = await import('/@fs' + R + 'site/lib/canvas-surface.ts')
  const { createRenderer } = await import('/@fs' + R + 'packages/agent-ui/a2ui/src/index.ts')
  const persona = (n) => ex.personaExemplarSeeds.find((x) => x.name === n)
  const seeds = {
    ProductCard: ex.productCardRoomsSeed,
    BoardGrid: ex.boardGridGuessesSeed,
    GameHud: ex.gameHudQuestSeed,
    CardTable: persona('persona-croupier-card-table'),
    QuestionCard: persona('persona-quizmaster-question'),
  }
  const r2 = (v) => Math.round(v * 100) / 100
  const firstText = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.data.trim() && n.parentElement.getClientRects().length ? 1 : 3) })
    return w.nextNode()
  }
  const ink = (el) => {
    const t = firstText(el)
    if (!t) return el.getBoundingClientRect()
    const rg = document.createRange()
    const i = t.data.search(/\S/)
    rg.setStart(t, i)
    rg.setEnd(t, i + 1)
    return rg.getBoundingClientRect()
  }
  document.body.innerHTML = ''
  document.body.style.cssText = 'margin:0;display:grid;gap:8px;padding:8px;background:#888'
  const out = {}
  for (const [name, seed] of Object.entries(seeds)) {
    const cid = seed.catalogId ?? seed.catalog
    const { stage, surface } = cs.createCanvasSurface()
    stage.style.cssText = 'block-size:1100px;inline-size:900px'
    stage.dataset.widget = name
    document.body.append(stage)
    const host = createRenderer()
    host.mount(surface)
    if (cid) await host.preload(cid).catch(() => {})
    for (const m of seed.messages) host.ingest(JSON.stringify(m))
    host.finalize(seed.surfaceId)
    cs.applyRootStretch(surface)
    await host.settled()
    await new Promise((r) => setTimeout(r, 400))
    const sr = surface.getBoundingClientRect()
    const scs = getComputedStyle(surface)
    const root = surface.firstElementChild
    const tag = { ProductCard: 'ui-product-card', BoardGrid: 'ui-board-grid', GameHud: 'ui-game-hud', CardTable: 'ui-card', QuestionCard: 'ui-card' }[name]
    const w = tag ? surface.querySelector(tag) : root
    const wr = w.getBoundingClientRect()
    const wcs = getComputedStyle(w)
    const rel = (rect) => ({ l: r2(rect.left - wr.left), t: r2(rect.top - wr.top), r: r2(wr.right - rect.right), b: r2(wr.bottom - rect.bottom) })
    const kids = [...w.children].filter((c) => c.getClientRects().length)
    const parts = {}
    const sel = {
      ProductCard: { title: '[data-part=title]', subtitle: '[data-part=subtitle]', rating: '[data-part=rating]', price: '[data-part=price]', action: '[data-part=action]' },
      GameHud: { title: '[data-part=title]', status: '[data-part=status]', progressText: '[data-part=progress-text]', track: '[data-part=progress-track]', stats: '[data-part=stats]', statLabel: '[data-part=stat] [data-part=label]' },
      BoardGrid: { cell: '[data-part=cell]' },
      CardTable: { title: '[data-part=title]', status: '[data-part=status]', zoneLabel: '[data-part=zone-label]', felt: '[data-part=felt]', readout: '[data-part=readout]', button: 'ui-button' },
      QuestionCard: { label: '[data-part=label]', meta: '[data-part=meta]', question: '[data-part=question]', option: '[data-part=option]', explanation: '[data-part=explanation]', button: 'ui-button' },
    }[name]
    for (const [k, s] of Object.entries(sel)) {
      const e = w.querySelector(s)
      if (!e || !e.getClientRects().length) { parts[k] = null; continue }
      parts[k] = { box: rel(e.getBoundingClientRect()), ink: rel(ink(e)) }
    }
    const gaps = []
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), c = kids[i].getBoundingClientRect()
      gaps.push(`${kids[i - 1].dataset.part ?? kids[i - 1].localName}->${kids[i].dataset.part ?? kids[i].localName}: ${r2(c.top - a.bottom)}`)
    }
    out[name] = {
      surfaceContentW: r2(sr.width - parseFloat(scs.paddingLeft) - parseFloat(scs.paddingRight)),
      rootTag: root.localName,
      widgetW: r2(wr.width),
      widgetPad: [wcs.paddingTop, wcs.paddingRight, wcs.paddingBottom, wcs.paddingLeft].join(' '),
      widgetGap: wcs.rowGap,
      kids: kids.map((k) => { const cs2 = getComputedStyle(k); return `${k.dataset.part ?? k.localName} l${rel(k.getBoundingClientRect()).l} pad ${cs2.padding} mar ${cs2.margin}` }),
      gaps,
      parts,
    }
    if (name === 'BoardGrid') {
      const cells = [...w.querySelectorAll('[data-part=cell]')].slice(0, 2).map((c) => c.getBoundingClientRect())
      out[name].cellGap = r2(cells[1].left - cells[0].right)
      const boards = [...surface.querySelectorAll('ui-board-grid')]
      out[name].boards = boards.map((bd) => ({ w: r2(bd.getBoundingClientRect().width), pad: getComputedStyle(bd).padding, gap: getComputedStyle(bd).rowGap }))
      const col = root.getBoundingClientRect()
      out[name].column = { w: r2(col.width), gap: getComputedStyle(root).rowGap, kids: [...root.children].map((k) => `${k.localName} w${r2(k.getBoundingClientRect().width)} l${r2(k.getBoundingClientRect().left - col.left)}`) }
    }
  }
  return out
}, R)
writeFileSync(`${OUT}/${label}.json`, JSON.stringify(res, null, 1))
for (const name of Object.keys(res)) {
  const st = p.locator(`[data-widget=${name}] .ui-artboard-surface`)
  await st.screenshot({ path: `${OUT}/${label}-${name}.png` })
}
const pcs = p.locator('[data-widget=ProductCard] ui-product-card')
await pcs.first().screenshot({ path: `${OUT}/${label}-PCfirst.png` })
await pcs.last().screenshot({ path: `${OUT}/${label}-PCtile.png` })
console.log(JSON.stringify(res, null, 1))
await b.close()
