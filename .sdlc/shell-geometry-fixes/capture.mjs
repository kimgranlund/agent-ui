#!/usr/bin/env node
// T-0121 evidence: screenshots and measured px for the docs page, a card page, agent-admin and the chat shell,
// at 400px and 1000px, light and dark. Boots the docs site on a free port (vite, site root) and drives Chromium.
//
//   node .sdlc/shell-geometry-fixes/capture.mjs <before|after>
//
// Writes screens/<page>-<width>-<scheme>-<label>.png and metrics-<label>.json next to this file.
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { freePort, waitForHttp, killTree } from '../../scripts/lib/dev-server.mjs'

const label = process.argv[2]
if (label !== 'before' && label !== 'after') {
  console.error('usage: capture.mjs <before|after>')
  process.exit(2)
}
const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const OUT = path.join(HERE, 'screens')
await mkdir(OUT, { recursive: true })

const PAGES = [
  { key: 'docs', url: '/button-doc.html' },
  { key: 'cards', url: '/card-demo.html' },
  { key: 'admin', url: '/agent-admin-app.html' },
  { key: 'chat', url: '/a2ui-chat.html' },
]
const WIDTHS = [400, 1000]
const SCHEMES = ['light', 'dark']

const port = await freePort()
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  cwd: REPO,
  detached: true,
  stdio: 'ignore',
})
const base = `http://127.0.0.1:${port}`
const metrics = {}
const { chromium } = await import('playwright')
const browser = await chromium.launch()
try {
  await waitForHttp(`${base}/index.html`, { timeoutMs: 90_000 })
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1, colorScheme: scheme })
      const page = await context.newPage()
      for (const { key, url } of PAGES) {
        await page.goto(`${base}${url}`, { waitUntil: 'networkidle' })
        await page.waitForFunction(() => document.querySelector('ui-super-shell [data-part="frame"]'), null, { timeout: 30_000 })
        await page.waitForTimeout(400)
        await page.screenshot({ path: path.join(OUT, `${key}-${width}-${scheme}-${label}.png`) })
        if (scheme === 'light') metrics[`${key}-${width}`] = await page.evaluate(measure)
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
  await killTree(vite).catch(() => {})
}
await writeFile(path.join(HERE, `metrics-${label}.json`), JSON.stringify(metrics, null, 2) + '\n')
console.log(`capture ${label}: ${Object.keys(metrics).length} page/width rows`)

// Runs in the page: the box geometry the ticket moves, in px, rounded to 0.1.
function measure() {
  const r = (v) => Math.round(v * 10) / 10
  const px = (v) => r(parseFloat(v) || 0)
  const box = (sel, root = document) => {
    const el = root.querySelector(sel)
    return el ? el.getBoundingClientRect() : null
  }
  const out = {}
  const shell = document.querySelector('ui-super-shell')
  const frame = shell?.querySelector(':scope > [data-part="frame"]')
  const shellBox = shell?.getBoundingClientRect()
  const x = (b) => (b && shellBox ? r(b.left - shellBox.left) : null)
  const header = frame?.querySelector(':scope > [data-part="bar"][data-bar="header"]')
  const footer = frame?.querySelector(':scope > [data-part="bar"][data-bar="footer"]')
  const middle = frame?.querySelector(':scope > [data-part="middle"]')
  if (header) out.headerBar = r(header.getBoundingClientRect().height)
  if (footer) out.footerBar = r(footer.getBoundingClientRect().height)
  if (middle) out.middleGap = px(getComputedStyle(middle).columnGap)
  const brand = box('.app-brand')
  if (brand) out.brandX = x(brand)
  const right = (b) => (b && shellBox ? r(b.right - shellBox.left) : null)
  const toggle = header?.querySelector(':scope > [data-part="side-toggle"][data-side="start"]')
  if (toggle) {
    out.toggleX = x(toggle.getBoundingClientRect())
    const glyph = [...toggle.querySelectorAll('ui-icon')].find((i) => getComputedStyle(i).display !== 'none')
    if (glyph) out.toggleGlyphX = x(glyph.getBoundingClientRect())
  }
  const headerRow = document.querySelector('.app-context-header')
  if (headerRow) {
    out.headerRowX = x(headerRow.getBoundingClientRect())
    out.headerRowGap = px(getComputedStyle(headerRow).columnGap)
    const buttons = headerRow.querySelectorAll('.app-context-actions ui-button')
    const last = buttons[buttons.length - 1]
    if (last) out.lastActionRight = right(last.getBoundingClientRect())
  }
  const appFooter = box('.app-context-footer-inner')
  if (appFooter) {
    out.appFooterX = x(appFooter)
    out.appFooterRight = right(appFooter)
  }
  const pageHeader = box('.page-header-inner')
  if (pageHeader) out.pageHeaderX = x(pageHeader)
  const content = document.querySelector('[data-page-content]')
  if (content) {
    out.contentX = x(content.getBoundingClientRect())
    out.contentPadBlock = px(getComputedStyle(content).paddingBlockStart)
  }
  const card = document.querySelector('ui-card')
  if (card) {
    const region = card.querySelector(':scope > ui-card-header, :scope > ui-card-content')
    if (region) {
      const cs = getComputedStyle(region)
      out.cardRegionPadInline = px(cs.paddingInlineStart)
      out.cardRegionPadBlock = px(cs.paddingBlockStart)
      out.cardRegionMargin = px(cs.marginBlockStart)
    }
  }
  const admin = document.querySelector('ui-agent-admin')
  if (admin) {
    const inner = admin.querySelector('ui-super-shell')
    if (inner) {
      const probe = document.createElement('div')
      probe.style.paddingInline = 'var(--ui-agent-admin-shell-gutter)'
      inner.append(probe)
      out.adminShellGutter = px(getComputedStyle(probe).paddingInlineStart)
      probe.remove()
    }
  }
  const chat = document.querySelector('ui-chat-shell ui-super-shell')
  if (chat) {
    const bar = chat.querySelector('[data-part="bar"][data-bar="header"]')
    const mid = chat.querySelector('[data-part="middle"]')
    if (bar) out.chatHeaderBar = r(bar.getBoundingClientRect().height)
    if (mid) out.chatMiddleGap = px(getComputedStyle(mid).columnGap)
  }
  if (shell) {
    const probe = document.createElement('div')
    probe.style.cssText = 'padding-inline: var(--ui-super-shell-overlay-inset); padding-block: var(--ui-super-shell-narrow-tabs-seam); inline-size: var(--ui-super-shell-pane-size); min-inline-size: 0'
    shell.append(probe)
    const cs = getComputedStyle(probe)
    out.overlayInset = px(cs.paddingInlineStart)
    out.narrowTabsSeam = px(cs.paddingBlockStart)
    out.paneSize = px(cs.inlineSize)
    probe.style.inlineSize = 'var(--ui-super-shell-canvas-min-size)'
    out.canvasFloor = px(getComputedStyle(probe).inlineSize)
    probe.style.inlineSize = 'var(--ui-super-shell-radius)'
    out.shellRadius = px(getComputedStyle(probe).inlineSize)
    probe.remove()
  }
  return out
}
