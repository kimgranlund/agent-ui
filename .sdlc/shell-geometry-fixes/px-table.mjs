#!/usr/bin/env node
// T-0121 evidence: builds px-table.md from metrics-before.json and metrics-after.json (capture.mjs output).
// The "derived" column is computed here from scale.mjs resolve() at the root register, never typed in, and
// each measured after value is checked against it.
//
//   node .sdlc/shell-geometry-fixes/px-table.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { resolve } from '../../packages/agent-ui/shared/src/tokens/scale.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const before = JSON.parse(await readFile(path.join(HERE, 'metrics-before.json'), 'utf8'))
const after = JSON.parse(await readFile(path.join(HERE, 'metrics-after.json'), 'utf8'))
const R = resolve('product', 'sm', 'md') // the root register (foundations.gen.css :root)

const bar = R.h + 2 * R.widget.margin
const pane = 9 * R.page.margin
const floor = 6 * R.page.margin
const COMPACT = 840 // SHELL_COMPACT_BREAKPOINT 52.5rem: below it the docs nav pane is an overlay, not in flow
const canvasX = (w) => (w >= COMPACT ? pane + R.page.gutter : 0)

// key, label, formula text, derived px for a width (null = no derived value, measured only)
const ROWS = [
  ['headerBar', 'Shell bar height (header)', 'h + 2 x widget.margin (8n)', () => bar],
  ['footerBar', 'Shell bar height (footer)', 'h + 2 x widget.margin (8n), a minimum', () => bar],
  ['middleGap', 'Shell inter-card gap', 'page.gutter (3n)', () => R.page.gutter],
  ['shellRadius', 'Shell card radius', 'card.radius (3n)', () => R.card.radius],
  ['overlayInset', 'Overlay pane inset', 'widget.margin (2n)', () => R.widget.margin],
  ['narrowTabsSeam', 'Narrow-tabs seam, pane-tabs pad', 'control.margin (n)', () => R.control.margin],
  ['paneSize', 'Pane width', '9 x page.margin (36n)', () => pane],
  ['canvasFloor', 'Canvas and pane floor', '6 x page.margin (24n)', () => floor],
  ['adminShellGutter', 'Agent-admin shell gutter', 'widget.margin (2n)', () => R.widget.margin],
  ['toggleX', 'Docs header: nav toggle box x', 'page.margin - control.margin', () => R.page.margin - R.control.margin],
  ['toggleGlyphX', 'Docs header: nav toggle glyph x', 'page.margin (the footer text x)', () => R.page.margin],
  ['brandX', 'Docs header: brand x', 'toggle box x + h + page.gutter', () => R.page.margin - R.control.margin + R.h + R.page.gutter],
  ['headerRowGap', 'Docs header: brand to actions gap', 'page.gutter (3n)', () => R.page.gutter],
  ['lastActionRight', 'Docs header: last action box right', 'W - page.margin + control.margin', (w) => w - R.page.margin + R.control.margin],
  ['appFooterX', 'App footer column x', 'page.margin (below the 64rem cap)', () => R.page.margin],
  ['appFooterRight', 'App footer column right', 'W - page.margin', (w) => w - R.page.margin],
  ['pageHeaderX', 'Page header column x', 'canvas x + page.margin', (w) => canvasX(w) + R.page.margin],
  ['contentX', 'Content column x', 'canvas x + page.margin', (w) => canvasX(w) + R.page.margin],
  ['contentPadBlock', 'Content block padding', 'page.margin (4n)', () => R.page.margin],
  ['cardRegionMargin', 'Card region margin', 'control.margin (n)', () => R.control.margin],
  ['cardRegionPadInline', 'Card region inline padding', 'card.gutter (2n)', () => R.card.gutter],
  ['cardRegionPadBlock', 'Card region block padding', 'card.gutter (2n)', () => R.card.gutter],
  ['chatHeaderBar', 'Chat shell header bar height', 'its content, at least 8n', null],
  ['chatMiddleGap', 'Chat shell inter-card gap', 'page.gutter (3n)', () => R.page.gutter],
]
// A page whose value is not the default formula: [formula text, derived fn or null].
const OVERRIDE = {
  'admin:canvasFloor': ["agent-admin's own 16rem override, unchanged", () => 256],
  'chat:contentX': ['full-bleed page: the canvas x only', (w) => canvasX(w)],
  'chat:contentPadBlock': ['full-bleed page: none', () => 0],
}
const PAGES = [['docs', 'Docs page (button-doc)'], ['cards', 'Card page (card-demo)'], ['admin', 'Agent-admin app'], ['chat', 'Chat shell (a2ui-chat)']]
const WIDTHS = [400, 1000]

const fmt = (v) => (v == null ? '-' : Number.isInteger(v) ? String(v) : String(v))
const out = [
  '# T-0121 px table: page and shell geometry before and after',
  '',
  `Measured by \`capture.mjs\` in Chromium, light scheme (dark renders the same geometry). Before is origin/main`,
  `(e2a43515, T-0120 merged); after is this branch. The root register is ${R.tier} at scale ${R.scale}: n ${R.n}, c ${R.c}, h ${R.h},`,
  `control ${R.control.margin}, group ${R.group.margin}, widget ${R.widget.margin} / ${R.widget.gutter}, card ${R.card.margin} / ${R.card.gutter}, page ${R.page.margin} / ${R.page.gutter} (margin / gutter).`,
  'The derived column is computed by `px-table.mjs` from `scale.mjs` `resolve()`, never typed in; "ok" means the measured',
  'after value equals it within 0.5px. x values are relative to the docs shell\'s inline start. Screenshots:',
  '`screens/<page>-<width>-<scheme>-<before|after>.png`, and `screens/contact-sheet-<scheme>.png` side by side.',
  '',
]
const off = []
for (const [key, title] of PAGES) {
  const rows = []
  for (const [mkey, label, formula, derive] of ROWS) {
    const [text, fn] = OVERRIDE[`${key}:${mkey}`] ?? [formula, derive]
    const cells = []
    let present = false
    for (const w of WIDTHS) {
      const b = before[`${key}-${w}`]?.[mkey]
      const a = after[`${key}-${w}`]?.[mkey]
      if (b == null && a == null) { cells.push('-', '-'); continue }
      present = true
      const d = fn ? fn(w) : null
      const verdict = d == null ? 'measured' : Math.abs(a - d) <= 0.5 ? `${fmt(d)} ok` : `${fmt(d)} OFF`
      if (verdict.endsWith('OFF')) off.push(`${title}, ${label}, ${w}px: measured ${fmt(a)}, derived ${fmt(d)}`)
      cells.push(b === a ? `${fmt(b)} (same)` : `${fmt(b)} to ${fmt(a)}`, verdict)
    }
    if (present) rows.push(`| ${label} | ${text} | ${cells[0]} | ${cells[1]} | ${cells[2]} | ${cells[3]} |`)
  }
  out.push(`## ${title}`, '', '| Quantity | Formula (resolve()) | 400px before to after | 400px derived | 1000px before to after | 1000px derived |', '|---|---|---|---|---|---|', ...rows, '')
}
out.push('## Measured values off the derived value', '', ...(off.length ? off.map((o) => `- ${o}`) : ['None.']), '')
await writeFile(path.join(HERE, 'px-table.md'), out.join('\n'))
console.log(`px-table: ${out.length} lines, ${off.length} off`)
for (const o of off) console.log(`OFF ${o}`)
