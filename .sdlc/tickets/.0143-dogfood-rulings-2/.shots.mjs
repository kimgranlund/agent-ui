// usage: node shots.mjs <outDir> <page[:selector]>...  (run from the worktree so playwright resolves)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const [outDir, ...pages] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
for (const spec of pages) {
  const [name, selector] = spec.split('@')
  for (const width of [400, 1000]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, deviceScaleFactor: 2 })
      const page = await ctx.newPage()
      await page.goto(`http://localhost:5391/${name}.html`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      const file = `${outDir}/${name}${selector ? '-' + selector.replace(/[^a-z0-9]+/gi, '_').slice(0, 30) : ''}__${width}__${scheme}.png`
      if (selector) {
        const loc = page.locator(selector).first()
        await loc.scrollIntoViewIfNeeded()
        await loc.screenshot({ path: file })
      } else {
        await page.screenshot({ path: file, fullPage: true })
      }
      await ctx.close()
      console.log(file)
    }
  }
}
await browser.close()
