#!/usr/bin/env node
// foundations-probe.mjs: measures every sized control in a real browser and compares it to the derived
// geometry (ADR-0245). For each `ui-*` whose descriptor declares a `size` attribute, at sizes sm, md and lg, it
// mounts the control twice, once on a plain page (today's geometry) and once inside the library root register
// `data-tier="product" data-scale="sm"` (the opt-in region), and reads the host's computed height, inline
// padding and corner radius. The derived row is compared to scale.mjs resolve() under clause 3's rules:
// height 4n; radius n, the pill h/2 for button and toggle; inline padding n, 2n for button, toggle and segment.
//
// It is a measurement tool, not a gate: before a lane migrates a control every derived row mismatches by
// design, and the Wave 2 sweep reads these numbers before and after each lane. The page is served by an
// in-process Vite dev server (the docs-site resolution: workspace packages through their exports maps) and
// driven by Playwright's Chromium.
//
// Usage:
//   node scripts/foundations-probe.mjs [--tags ui-button,ui-select] [--json] [--strict]
//     --json    print the rows as JSON instead of the table
//     --strict  exit 1 when any derived row mismatches (for a lane that has migrated its controls)
//   node scripts/foundations-probe.mjs selftest   prove the expectations and the comparison, no browser

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { resolve as derive } from '../packages/agent-ui/shared/src/tokens/scale.mjs'
import { freePort } from './lib/dev-server.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const CONTROLS = join(REPO, 'packages/agent-ui/components/src/controls')
const STEPS = ['sm', 'md', 'lg']
const ROOT_REGISTER = ['product', 'sm'] // clause 2: the library root
const PILL = new Set(['ui-button', 'ui-toggle']) // clause 3: radius h/2 = 2n, kept at step 0
const LABEL_PAD_2N = new Set(['ui-button', 'ui-toggle', 'ui-segment']) // clause 3: padding 2n beside a label
const TOLERANCE = 0.5

/** Every control tag whose descriptor declares a `size` attribute. */
export function sizedTags(dir = CONTROLS) {
  const tags = []
  for (const folder of readdirSync(dir, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name.startsWith('_')) continue
    for (const f of readdirSync(join(dir, folder.name))) {
      if (!f.endsWith('.md')) continue
      const md = readFileSync(join(dir, folder.name, f), 'utf8')
      const tag = /^tag:\s*(ui-[\w-]+)/m.exec(md)?.[1]
      if (tag && /^\s*- name: size\s*$/m.test(md.split(/^---\s*$/m)[1] ?? '')) tags.push(tag)
    }
  }
  return tags.sort()
}

/** What clause 3 says the host measures at the root register for `size`. */
export function expected(tag, size) {
  const r = derive(ROOT_REGISTER[0], ROOT_REGISTER[1], size)
  return { height: r.h, padding: LABEL_PAD_2N.has(tag) ? 2 * r.n : r.n, radius: PILL.has(tag) ? r.h / 2 : r.radius }
}

/** The fields of a measured derived row that differ from `expected` by more than TOLERANCE. */
export function mismatches(row) {
  const want = expected(row.tag, row.size)
  return Object.keys(want).filter((k) => Math.abs(row[k] - want[k]) > TOLERANCE)
}

const ENTRY = (tags) => `
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
const TAGS = ${JSON.stringify(tags)}
const STEPS = ${JSON.stringify(STEPS)}
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
async function measure(tag, size, region) {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '320px'
  if (region) { wrap.setAttribute('data-tier', ${JSON.stringify(ROOT_REGISTER[0])}); wrap.setAttribute('data-scale', ${JSON.stringify(ROOT_REGISTER[1])}) }
  const el = document.createElement(tag)
  el.setAttribute('size', size)
  el.setAttribute('label', 'Label')
  if (!el.childElementCount) el.textContent = 'Label'
  wrap.append(el)
  document.body.append(wrap)
  await el.updateComplete
  await frame()
  const cs = getComputedStyle(el)
  const row = { tag, size, height: el.getBoundingClientRect().height, padding: parseFloat(cs.paddingInlineStart) || 0, radius: parseFloat(cs.borderStartStartRadius) || 0 }
  wrap.remove()
  return row
}
window.__probe = (async () => {
  await Promise.all(TAGS.map((t) => customElements.whenDefined(t)))
  const rows = []
  for (const tag of TAGS) for (const size of STEPS) rows.push({ ...(await measure(tag, size, true)), today: await measure(tag, size, false) })
  return rows
})()
`

function probePagePlugin(tags) {
  return {
    name: 'foundations-probe-page',
    resolveId: (id) => (id === '/__foundations-probe.js' ? '\0foundations-probe' : null),
    load: (id) => (id === '\0foundations-probe' ? ENTRY(tags) : null),
    configureServer(server) {
      server.middlewares.use('/__foundations-probe.html', (_req, res) => {
        res.setHeader('content-type', 'text/html')
        res.end('<!doctype html><html><body><script type="module" src="/__foundations-probe.js"></script></body></html>')
      })
    },
  }
}

const fmt = (o) => `${o.height} / ${o.padding} / ${o.radius}`

async function main() {
  const tagArg = process.argv.indexOf('--tags')
  const tags = tagArg === -1 ? sizedTags() : process.argv[tagArg + 1].split(',')
  const { createServer } = await import('vite')
  const { chromium } = await import('playwright')
  const port = await freePort()
  const server = await createServer({ configFile: false, root: REPO, logLevel: 'error', server: { port, strictPort: true }, plugins: [probePagePlugin(tags)] })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch()
    const page = await browser.newPage()
    await page.goto(`http://localhost:${port}/__foundations-probe.html`)
    const rows = await page.evaluate(() => window.__probe)
    const bad = rows.filter((r) => mismatches(r).length > 0)
    if (process.argv.includes('--json')) console.log(JSON.stringify(rows.map((r) => ({ ...r, expected: expected(r.tag, r.size), mismatches: mismatches(r) })), null, 2))
    else {
      console.log('control size | today h / pad / r | derived h / pad / r | expected h / pad / r | mismatch')
      for (const r of rows) console.log(`${r.tag} ${r.size} | ${fmt(r.today)} | ${fmt(r)} | ${fmt(expected(r.tag, r.size))} | ${mismatches(r).join(', ') || 'none'}`)
    }
    console.log(`foundations-probe: ${rows.length} rows over ${tags.length} controls at ${ROOT_REGISTER.join('/')}; ${bad.length} mismatch the derived geometry`)
    if (process.argv.includes('--strict') && bad.length) process.exitCode = 1
  } finally {
    await browser?.close()
    await server.close()
  }
}

function selftest() {
  let failures = 0
  const check = (label, cond) => {
    if (!cond) failures++
    console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`)
  }
  const md = expected('ui-text-field', 'md')
  check('a field at the root md: height 28, padding n 7, radius n 7', md.height === 28 && md.padding === 7 && md.radius === 7)
  const lg = expected('ui-button', 'lg')
  check('a button at the root lg: height 32, padding 2n 16, the pill radius 16', lg.height === 32 && lg.padding === 16 && lg.radius === 16)
  check('a derived row on the formula has no mismatch', mismatches({ tag: 'ui-select', size: 'sm', height: 24, padding: 6, radius: 6 }).length === 0)
  check('today\'s field radius 12 at md is a radius mismatch', mismatches({ tag: 'ui-select', size: 'md', height: 28, padding: 7, radius: 12 }).join() === 'radius')
  check('sub-pixel layout noise is tolerated', mismatches({ tag: 'ui-select', size: 'md', height: 28.25, padding: 7, radius: 7 }).length === 0)
  const tags = sizedTags()
  check('the sized fleet is found and includes button and text-field', tags.includes('ui-button') && tags.includes('ui-text-field') && !tags.includes('ui-icon'))
  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  if (failures) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'selftest') selftest()
  else await main()
}
