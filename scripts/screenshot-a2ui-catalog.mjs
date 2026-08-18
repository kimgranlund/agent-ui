#!/usr/bin/env node
// Screenshot every card on the A2UI catalog page (site/a2ui-catalog.html) — one PNG per catalog
// component, per theme — via headless Chromium (playwright, an existing devDep; precedent:
// scripts/e2e-devtools.mjs). Reads the LIVE page: tabs (one per tier) → `section.catalog-item`
// cards → each card's `component-preview` canvas, so it never hand-lists components.
//
//   node scripts/screenshot-a2ui-catalog.mjs [--base http://localhost:5174] [--out DIR]
//        [--theme dark|light|both] [--crop card|canvas] [--only NAME] [--scale 2]
//
// Output: DIR/<theme>/<tier>/<name>.png + DIR/index.json (name, tier, theme, file, size, status).
// Exit 0 when every card captured; 1 when any card's canvas stayed empty (listed, never skipped
// silently); 2 on a usage/launch error.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const args = parseArgs(process.argv.slice(2))
const BASE = (args.base ?? 'http://localhost:5174').replace(/\/$/, '')
const OUT = path.resolve(args.out ?? 'screenshots/a2ui-catalog')
const THEMES = args.theme === 'both' ? ['dark', 'light'] : [args.theme ?? 'dark']
const CROP = args.crop ?? 'card' // 'card' = whole section (title+knobs+canvas+uses) · 'canvas' = preview canvas only
const ONLY = args.only ?? null
const SCALE = Number(args.scale ?? 2)
if (!['dark', 'light'].every((t) => t === 'dark' || t === 'light') || !['card', 'canvas'].includes(CROP)) usage()

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') usage()
    if (!a.startsWith('--')) usage(`unexpected argument ${a}`)
    out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
  }
  return out
}
function usage(msg) {
  if (msg) console.error(`error: ${msg}`)
  console.error(
    'usage: node scripts/screenshot-a2ui-catalog.mjs [--base URL] [--out DIR] [--theme dark|light|both] [--crop card|canvas] [--only NAME] [--scale N]',
  )
  process.exit(2)
}

const { chromium } = await import('playwright')
const browser = await chromium.launch()
const rows = []
let failures = 0
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: SCALE,
      colorScheme: theme, // page follows `:root { color-scheme: light dark }` in Auto mode
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => console.error(`[page error] ${e.message}`))
    await page.goto(`${BASE}/a2ui-catalog.html`, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      () => customElements.get('ui-tabs') && customElements.get('component-preview') && document.querySelector('section.catalog-item'),
      null,
      { timeout: 30_000 },
    )

    const tabs = page.locator('ui-tabs.catalog-tabs > [data-part=tablist] > ui-tab')
    const tabCount = await tabs.count()
    for (let t = 0; t < tabCount; t++) {
      const tab = tabs.nth(t)
      const tier = (await tab.getAttribute('key')) ?? `tab-${t}`
      await tab.click()
      // the panel that becomes visible after the click is this tier's
      const panel = page.locator('ui-tabs.catalog-tabs > ui-tab-panel:visible').first()
      await panel.waitFor({ state: 'visible', timeout: 10_000 })

      const cards = panel.locator('section.catalog-item')
      const n = await cards.count()
      for (let i = 0; i < n; i++) {
        const card = cards.nth(i)
        const name = (await card.locator('h2.catalog-item-title').innerText()).trim()
        if (ONLY && name !== ONLY) continue
        await card.scrollIntoViewIfNeeded()
        // wait for the canvas to have rendered children — the renderer paints async
        const canvas = card.locator('.preview-canvas').first()
        let status = 'ok'
        try {
          await canvas.waitFor({ state: 'visible', timeout: 10_000 })
          await page.waitForFunction(
            (el) => el instanceof Element && el.querySelector(':scope > *') !== null && el.getBoundingClientRect().height > 8,
            await canvas.elementHandle(),
            { timeout: 10_000 },
          )
          await page.waitForTimeout(150) // let transitions/animations settle
        } catch {
          status = 'empty-canvas'
          failures++
        }
        const target = CROP === 'canvas' ? canvas : card
        const dir = path.join(OUT, theme, tier)
        await mkdir(dir, { recursive: true })
        const file = path.join(dir, `${name}.png`)
        await target.screenshot({ path: file, animations: 'disabled' })
        const box = await target.boundingBox()
        rows.push({ name, tier, theme, file: path.relative(OUT, file), width: box?.width, height: box?.height, status })
        console.log(`${status === 'ok' ? '✓' : '✗'} ${theme}/${tier}/${name}${status === 'ok' ? '' : ` (${status})`}`)
      }
    }
    await context.close()
  }
} finally {
  await browser.close().catch(() => {})
}

await mkdir(OUT, { recursive: true })
await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ base: BASE, crop: CROP, themes: THEMES, rows }, null, 2))
console.log(`\n${rows.length} screenshots → ${OUT} (${failures} with empty canvas)`)
process.exit(failures > 0 ? 1 : 0)
