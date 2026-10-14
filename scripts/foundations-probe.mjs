#!/usr/bin/env node
// foundations-probe.mjs: measures every sized control in a real browser and compares it to the derived
// geometry (ADR-0245). For each `ui-*` whose descriptor declares a `size` attribute, at sizes sm, md and lg, it
// mounts the control twice, once on a plain page (the root register since the cut, product at scale sm) and once
// under `data-foundations="legacy"` (clause 10e, today's geometry), and measures the element clause 3 rules on:
// the host, a named part or a pseudo-element. CLASSES is clause 3 as a table: each control class names its
// measured element and the quantities clause 3 fixes for it (a frame control: height 4n, inline padding n, the
// pill radius 2n of Amendment 5; the button and toggle pill; a 2n indicator box; a listbox at the group level; and so on). Amendment 4 adds
// the control rule: where a class names a `slot` (the text slot inside the host) its inline padding is the label
// inset n - c, and a control whose label is anonymous host content carries margin + inset on the host. A control whose
// host clause 3 gives no rule (a panel, an overlay, a preset widget, a display atom) is listed in EXEMPT with the
// gate that pins its derived geometry instead, so nothing is skipped silently.
//
// The page is served by an in-process Vite dev server (the docs-site resolution: workspace packages through
// their exports maps) and driven by Playwright's Chromium.
//
// Usage:
//   node scripts/foundations-probe.mjs [--tags ui-button,ui-select] [--json] [--strict]
//     --json    print the rows as JSON instead of the table
//     --strict  exit 1 when any derived row mismatches, or a sized control has no class and no exemption
//   node scripts/foundations-probe.mjs selftest   prove the expectations and the comparison, no browser

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { resolve as derive } from '../packages/agent-ui/shared/src/tokens/scale.mjs'
import { freePort } from './lib/dev-server.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const CONTROLS = join(REPO, 'packages/agent-ui/components/src/controls')
const STEPS = ['sm', 'md', 'lg']
const ROOT_REGISTER = ['product', 'md'] // the library root (clause 2, product / md since Amendment 8)
const TOLERANCE = 0.5

/**
 * Clause 3 as a table: class -> the element measured (`part` is a `[data-part]` name, `selector` any selector
 * inside the host, `pseudo` a pseudo-element of the host; `parent` wraps the control in its container; `slot` is
 * the text slot inside the host, measured for its label inset) and the quantities clause 3 and the control rule
 * (Amendment 4) fix for it, from scale.mjs resolve() at the control's own n.
 */
const LABEL = '[data-part="label"]'
const EDITOR = '[data-part="editor"]'
export const CLASSES = {
  frame: { slot: EDITOR, rule: (r) => ({ height: r.h, padding: r.control.margin, inset: r.labelMargin, radius: 2 * r.n }) }, // a field: height 4n, margin n, the editor's label inset n - c, the pill 2n (Amendment 5)
  pill: { slot: LABEL, rule: (r) => ({ height: r.h, padding: r.control.margin, inset: r.labelMargin, radius: 2 * r.n }) }, // button: margin n, the label's inset n - c, the pill radius 2n (Amendment 3)
  // toggle: its label is anonymous host content (toggle.md), so the host edge carries margin + inset = 2n - c
  barePill: { rule: (r) => ({ height: r.h, padding: r.control.margin + r.labelMargin, radius: 2 * r.n }) },
  trigger: { part: 'trigger', slot: LABEL, rule: (r) => ({ height: r.h, padding: r.control.margin, inset: r.labelMargin, radius: 2 * r.n }) }, // a popup field's frame, the pill 2n
  cell: { part: 'cell', rule: (r) => ({ height: r.h, radius: r.n }) }, // one frame per character cell, the round square n (Amendment 6)
  multiline: { slot: EDITOR, rule: (r) => ({ padding: r.control.margin, inset: r.labelMargin, radius: 2 * r.n }) }, // margin n, the editor's inset, the single-line control radius 2n; rows set the height
  listbox: { rule: (r) => ({ padding: r.c, radius: 2 * r.n + r.c }) }, // padding c; concentric radius: the row pill 2n plus the inset c (Amendment 5)
  // segments 4n, text edge 2n - c on the segment (an anonymous label); a segment's own size is unconsumed
  // (segment.md), so the size goes on the group
  segment: { parent: 'ui-segmented-control', sizeOnParent: true, rule: (r) => ({ height: r.h, padding: r.control.margin + r.labelMargin }) },
  avatar: { rule: (r) => ({ height: r.h, radius: r.h / 2 }) }, // a 4n circle (Amendment 3)
  checkbox: { pseudo: '::before', rule: (r) => ({ height: r.icon, radius: r.parts.checkboxRadius }) }, // 2n box, radius ceil(n/2) (Amendment 4)
  radio: { pseudo: '::before', rule: (r) => ({ height: r.icon, radius: r.icon / 2 }) }, // 2n circle
  switch: { pseudo: '::before', rule: (r) => ({ height: r.icon, radius: r.n }) }, // track 2n tall, fully rounded
  range: { selector: '.rail', rule: (r) => ({ height: r.icon }) }, // ui-slider's .rail is its box: the 2n indicator box
  rail: { selector: '.rail', rule: (r) => ({ height: 2 * r.c }) }, // ui-slider-multi's .rail is the rail itself: 2c
  stars: { part: 'stars', rule: (r) => ({ height: r.icon }) }, // each star is an icon in a 2n box
  type: { rule: (r) => ({ font: r.type.body }) }, // ui-text body at its own n (clause 7)
}

/** Each sized control's clause 3 class. */
export const CLASS_OF = {
  'ui-text-field': 'frame',
  'ui-button': 'pill',
  'ui-toggle': 'barePill',
  'ui-select': 'trigger',
  'ui-otp-field': 'cell',
  'ui-textarea': 'multiline',
  'ui-multi-select': 'listbox',
  'ui-segment': 'segment',
  'ui-avatar': 'avatar',
  'ui-checkbox': 'checkbox',
  'ui-radio': 'radio',
  'ui-switch': 'switch',
  'ui-slider': 'range',
  'ui-slider-multi': 'rail',
  'ui-rating': 'stars',
  'ui-text': 'type',
}

/** Sized controls whose host clause 3 gives no rule, and the gate that pins their derived geometry instead. */
export const EXEMPT = {
  'ui-calendar': 'a panel; its 4n day cells are pinned by calendar-foundations.browser.test.ts',
  'ui-form-popover': 'an overlay container at the widget level; the closed host has no box (containers-foundations)',
  'ui-playing-card': 'a preset widget sized by its own card ratio (ADR-0245 lane 4b)',
  'ui-status-stream': 'a display atom; its 2n marker box is pinned by timeline-item-foundations.browser.test.ts',
  'ui-timeline': 'a display atom list; its items carry the 2n marker box (timeline-item-foundations)',
  'ui-timeline-item': 'a display atom; its 2n marker box and 2n - 2c dot are pinned by timeline-item-foundations',
}

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

/** What clause 3 says the measured element reads at the root register for `size` (null: no class). */
export function expected(tag, size) {
  const cls = CLASSES[CLASS_OF[tag]]
  return cls ? cls.rule(derive(ROOT_REGISTER[0], ROOT_REGISTER[1], size)) : null
}

/** The fields of a measured derived row that differ from `expected` by more than TOLERANCE. */
export function mismatches(row) {
  const want = expected(row.tag, row.size)
  if (want === null) return ['no clause 3 class']
  if (row.found === false) return ['measured element not found']
  return Object.keys(want).filter((k) => !(Math.abs(row[k] - want[k]) <= TOLERANCE))
}

/** What the page measures for each tag: the class's element spec. */
const specOf = (tag) => {
  const { part, selector, pseudo, parent, sizeOnParent, slot } = CLASSES[CLASS_OF[tag]] ?? {}
  return { part, selector, pseudo, parent, sizeOnParent, slot }
}

const ENTRY = (tags) => `
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
const TAGS = ${JSON.stringify(tags)}
const SPECS = ${JSON.stringify(Object.fromEntries(tags.map((t) => [t, specOf(t)])))}
const STEPS = ${JSON.stringify(STEPS)}
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const len = (v, basis) => (String(v).endsWith('%') ? (parseFloat(v) / 100) * basis : parseFloat(v) || 0)
async function measure(tag, size, legacy) {
  const spec = SPECS[tag]
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '320px'
  if (legacy) wrap.setAttribute('data-foundations', 'legacy')
  const el = document.createElement(tag)
  if (!spec.sizeOnParent) el.setAttribute('size', size)
  el.setAttribute('label', 'Label')
  if (!el.childElementCount) el.textContent = 'Label'
  if (spec.parent) {
    const parent = document.createElement(spec.parent)
    if (spec.sizeOnParent) parent.setAttribute('size', size)
    parent.append(el)
    wrap.append(parent)
  } else wrap.append(el)
  document.body.append(wrap)
  await el.updateComplete
  await frame()
  const target = spec.part ? el.querySelector('[data-part="' + spec.part + '"]') : spec.selector ? el.querySelector(spec.selector) : el
  const node = target ?? el
  const cs = getComputedStyle(node, spec.pseudo ?? null)
  const width = spec.pseudo ? parseFloat(cs.inlineSize) || 0 : node.getBoundingClientRect().width
  const height = spec.pseudo ? parseFloat(cs.blockSize) || 0 : node.getBoundingClientRect().height
  const slot = spec.slot ? el.querySelector(spec.slot) : null
  const inset = slot ? parseFloat(getComputedStyle(slot).paddingInlineStart) || 0 : 0
  const row = { tag, size, found: target !== null && (!spec.slot || slot !== null), height, padding: parseFloat(cs.paddingInlineStart) || 0, inset, radius: len(cs.borderStartStartRadius, width), font: parseFloat(cs.fontSize) || 0 }
  wrap.remove()
  return row
}
window.__probe = (async () => {
  await Promise.all(TAGS.map((t) => customElements.whenDefined(t)))
  const rows = []
  for (const tag of TAGS) for (const size of STEPS) rows.push({ ...(await measure(tag, size, false)), today: await measure(tag, size, true) })
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

/** Only the quantities the class asserts, e.g. `h 24 · pad 6 · inset 4 · r 6`. */
const fmt = (o, keys) => keys.map((k) => `${k === 'height' ? 'h' : k === 'padding' ? 'pad' : k === 'radius' ? 'r' : k} ${Math.round(o[k] * 100) / 100}`).join(' · ')

/** Sized tags with neither a class nor an exemption: a new sized control the table has not ruled on yet. */
export const unruled = (tags) => tags.filter((t) => !CLASS_OF[t] && !EXEMPT[t])

async function main() {
  const tagArg = process.argv.indexOf('--tags')
  const all = tagArg === -1 ? sizedTags() : process.argv[tagArg + 1].split(',')
  const loose = unruled(all)
  const tags = all.filter((t) => CLASS_OF[t])
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
      console.log('control size (class) | legacy today | derived | expected | mismatch')
      for (const r of rows) {
        const keys = Object.keys(expected(r.tag, r.size))
        console.log(`${r.tag} ${r.size} (${CLASS_OF[r.tag]}) | ${fmt(r.today, keys)} | ${fmt(r, keys)} | ${fmt(expected(r.tag, r.size), keys)} | ${mismatches(r).join(', ') || 'none'}`)
      }
      for (const t of all.filter((x) => EXEMPT[x])) console.log(`${t} exempt: ${EXEMPT[t]}`)
    }
    for (const t of loose) console.log(`${t}: no clause 3 class and no exemption`)
    console.log(`foundations-probe: ${rows.length} rows over ${tags.length} classed controls at ${ROOT_REGISTER.join('/')} (${all.length - tags.length - loose.length} exempt); ${bad.length} mismatch the derived geometry, ${loose.length} unruled`)
    if (process.argv.includes('--strict') && (bad.length || loose.length)) process.exitCode = 1
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
  check('a field at the root md: height 32, margin n 8, label inset n - c 6, the pill radius 2n 16', md.height === 32 && md.padding === 8 && md.inset === 6 && md.radius === 16)
  const lg = expected('ui-button', 'lg')
  check('a button at the root lg: height 40, margin n 10, label inset 7 (text edge 2n - c 17), the pill radius 2n 20', lg.height === 40 && lg.padding === 10 && lg.inset === 7 && lg.padding + lg.inset === 17 && lg.radius === 20)
  const bare = expected('ui-toggle', 'lg')
  check('a toggle carries margin + inset on the host (anonymous label): padding 2n - c 17, no slot quantity', bare.padding === 17 && !('inset' in bare))
  check('a segment reads the same text edge 2n - c on the segment: 14 at md', expected('ui-segment', 'md').padding === 14)
  check('a derived row on the formula has no mismatch', mismatches({ tag: 'ui-select', size: 'sm', height: 24, padding: 6, inset: 4, radius: 12 }).length === 0)
  check('the product / sm pill 10 at sm is a radius mismatch (the pill is 12)', mismatches({ tag: 'ui-select', size: 'sm', height: 24, padding: 6, inset: 4, radius: 10 }).join() === 'radius')
  check('the old field radius n 8 at md is a radius mismatch (the pill is 16)', mismatches({ tag: 'ui-select', size: 'md', height: 32, padding: 8, inset: 6, radius: 8 }).join() === 'radius')
  check('a text slot with no label inset is an inset mismatch (the old n edge)', mismatches({ tag: 'ui-select', size: 'md', height: 32, padding: 8, inset: 0, radius: 16 }).join() === 'inset')
  check('sub-pixel layout noise is tolerated', mismatches({ tag: 'ui-select', size: 'md', height: 32.25, padding: 8, inset: 6, radius: 16 }).length === 0)
  const box = expected('ui-checkbox', 'md')
  check('an indicator is ruled on its 2n box, not the 4n frame: checkbox md box 16, radius ceil(n/2) 4', box.height === 16 && box.radius === 4 && !('padding' in box))
  check('the checkbox radius is ceil(n/2): 3 at sm (n 6), 5 at lg (n 10)', expected('ui-checkbox', 'sm').radius === 3 && expected('ui-checkbox', 'lg').radius === 5)
  check('a listbox nests its rows: padding c 2, radius 2n + c 18', expected('ui-multi-select', 'md').padding === 2 && expected('ui-multi-select', 'md').radius === 18)
  check('a measured element that is missing is a mismatch, never a pass', mismatches({ tag: 'ui-select', size: 'md', found: false, height: 32, padding: 8, inset: 6, radius: 16 }).join() === 'measured element not found')
  check('a sized tag with no class is reported, and an unruled new tag would be caught', mismatches({ tag: 'ui-zz', size: 'md' }).join() === 'no clause 3 class' && unruled(['ui-zz']).join() === 'ui-zz')
  const tags = sizedTags()
  check('the sized fleet is found and includes button and text-field', tags.includes('ui-button') && tags.includes('ui-text-field') && !tags.includes('ui-icon'))
  check('every sized control has a clause 3 class or a stated exemption', unruled(tags).length === 0)
  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  if (failures) process.exit(1)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'selftest') selftest()
  else await main()
}
