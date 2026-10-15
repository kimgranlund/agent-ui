// usage: node compose.mjs mock|<labels...>  -> mock: screenshot mockup sections; else side-<widget>.png (mockup | labels...)
import { chromium } from '/Users/kimgranlund/Projects/nonoun/agent-ui/node_modules/playwright/index.mjs'
import { existsSync, readFileSync } from "node:fs"
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const OUT = dirname(fileURLToPath(import.meta.url))
const ids = { ProductCard: 'pc', BoardGrid: 'bg', GameHud: 'gh', CardTable: 'ct', QuestionCard: 'qc', PCfirst: 'pc', PCtile: 'pc' }
const b = await chromium.launch()
const args = process.argv.slice(2)
if (args[0] === 'mock') {
  const p = await b.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 })
  await p.goto('file:///private/tmp/claude-501/local-artifact/mockups.html')
  await p.waitForTimeout(1500)
  for (const [n, id] of Object.entries(ids)) if (!n.startsWith('PC')) await p.locator(`#${id} .stage`).first().screenshot({ path: `${OUT}/mock-${n}.png` })
} else {
  const p = await b.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 })
  for (const n of Object.keys(ids)) {
    const cols = [['mockup', `mock-${n.startsWith('PC') ? 'ProductCard' : n}.png`], ...args.map((l) => [l, `${l}-${n}.png`])].filter(([, f]) => existsSync(`${OUT}/${f}`))
    const html = `<body style="margin:0;font:14px system-ui;background:#fff"><div style="display:flex;gap:16px;align-items:start;padding:12px">${cols
      .map(([l, f]) => `<figure style="margin:0;flex:1 1 0;min-width:0"><figcaption style="font-weight:700;margin-bottom:6px">${n}: ${l}</figcaption><img src="data:image/png;base64,${readFileSync(`${OUT}/${f}`).toString("base64")}" style="max-width:100%;border:1px solid #ccc"></figure>`)
      .join('')}</div></body>`
    await p.setContent(html)
    await p.waitForTimeout(300)
    await p.screenshot({ path: `${OUT}/side-${n}.png`, fullPage: true })
  }
}
await b.close()
