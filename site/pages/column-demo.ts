// site/pages/column-demo.ts — the ui-column interaction demo (the ratified layout `demo`; pairs with
// column-doc.html, the API page). Mounts the REAL vertical primitive as a card column (a stacked feed of real
// ui-cards) and a bounded-height stack, and lets the reader flip its live props — gap / align / justify / wrap /
// stretch / reflow — with real ui-button knobs; the knob log records every attribute write (column.md
// `events: []` — a layout primitive's whole contract is attribute-in → layout-out). column.css owns the mechanics.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log · .demo-box · .reflow-frame)
import { applyDemoWidth, captioned, demoBox, el, exampleSection, uiButton } from '../lib/specimens.ts'
import { booleanKnob, enumKnob, knobLog } from '../lib/layout-demo-knobs.ts'

const { content } = mountPage({
  title: 'ui-column — demo',
  intro: 'The vertical layout primitive, live. A card column (a stacked release feed) and a bounded-height ' +
    'stack are laid out by real ui-column instances; the knobs flip gap / align / justify / wrap / stretch / ' +
    'reflow and the log records every attribute write. The API table is on the ui-column API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── scenario 1: a card column — a release feed, three real ui-cards stacked by ONE ui-column ──────────────
const release = (version: string, date: string, note: string, intent: string, badge: string): HTMLElement =>
  el('ui-card', { elevation: '1' }, [
    el('ui-card-header', {}, [
      text(`${version} · ${date}`),
      el('ui-badge', { slot: 'trailing', intent, label: badge }),
    ]),
    el('ui-card-content', {}, [text(note)]),
    el('ui-card-footer', {}, [el('ui-row', { gap: 'sm', justify: 'end' }, [uiButton('Changelog', 'ghost'), uiButton('Upgrade', 'soft')])]),
  ])

const feed = el('ui-column', { gap: 'md' }, [
  release('v2.4.0', 'Aug 18', 'ui-grid gains span-aware auto-fit; the layout demos ship on the docs site.', 'success', 'Stable'),
  release('v2.3.2', 'Aug 11', 'ui-column stretch fixed under a wide @container reflow; no API change.', 'neutral', 'Patch'),
  release('v2.5.0-rc.1', 'Aug 20', 'Split-pane keyboard resize lands behind a flag — try it in the harness.', 'warning', 'Preview'),
])
applyDemoWidth(feed, '28rem') // a feed column, not a page-wide band — the width lets `stretch` and `align` read

// ── scenario 2: a bounded-height stack — justify only reads when the column is taller than its content ────
const stack = el('ui-column', { gap: 'sm', elevation: '1', style: 'min-block-size: 16rem' }, [
  demoBox('Header'),
  demoBox('Body'),
  demoBox('Footer'),
])
applyDemoWidth(stack, '20rem')

// The knobs drive BOTH columns so one flip shows the same prop on two compositions.
const targets = [feed, stack]
const log = knobLog()
const knobs = el('ui-column', { gap: 'sm' }, [
  enumKnob(targets, 'gap', ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'], log),
  enumKnob(targets, 'align', ['stretch', 'start', 'end', 'baseline'], log),
  enumKnob(targets, 'justify', ['start', 'center', 'end', 'between', 'around', 'evenly'], log),
  booleanKnob(targets, 'wrap', log),
  booleanKnob(targets, 'stretch', log),
  enumKnob(targets, 'reflow', ['locked', 'auto'], log),
])

// ── scenario 3: reflow="auto" — a column that becomes a row when its container is WIDE (the inverse of row) ─
const reflowColumn = el('ui-column', { gap: 'sm', reflow: 'auto' }, [
  demoBox('Plan: Team'),
  demoBox('Seats: 12 / 25'),
  demoBox('Renews: Sep 1'),
])
const reflowFrame = el('div', { class: 'reflow-frame' }, [reflowColumn])
const reflowNote = el('p', {}, [
  text('ui-column is '), code('reflow="locked"'), text(' by default — it stays a column at every width. This one opts into '),
  code('reflow="auto"'), text(': drag the frame '), strong('wider'),
  text(' than the container-query line and the stack turns into a row (ADR-0096 — the column flips to locked-by-default; auto is the opt-in).'),
])

// ── the axis specimens — align (the narrowed 4-member enum: no `center` on a column, by ruling) ─────────────
const alignGrid = el('div', { class: 'demo-grid' }, ['stretch', 'start', 'end', 'baseline'].map((v) =>
  captioned(`align="${v}"`, el('ui-column', { gap: 'xs', align: v }, [demoBox('short'), demoBox('a longer item'), demoBox('mid')])),
))
const justifyGrid = el('div', { class: 'demo-grid' }, ['start', 'center', 'end', 'between'].map((v) =>
  captioned(`justify="${v}"`, el('ui-column', { gap: 'xs', justify: v, style: 'min-block-size: 10rem' }, [demoBox('A'), demoBox('B')])),
))

content.append(
  exampleSection('Card column', feed),
  exampleSection('Bounded-height stack', stack),
  exampleSection('Knobs', el('p', {}, [text('Each knob writes the attribute on both columns above; the active value is solid.')]), knobs),
  exampleSection('Knob log', log.list),
  exampleSection('Reflow', reflowFrame, reflowNote),
  exampleSection('align', alignGrid),
  exampleSection('justify', justifyGrid),
)
