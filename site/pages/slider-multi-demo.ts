// site/pages/slider-multi-demo.ts — the ui-slider-multi interaction demo (the ratified pattern `demo`; pairs
// with the slider-multi-doc.html API page). Mounts the REAL two-thumb Range control as a store's price-range
// filter and proves the contract honestly: `input` fires on every live change to valueLo OR valueHi (the pair
// is already updated when it fires), `change` fires on focusout once either moved since the focusin baseline
// (slider-multi.md) — the from–to readout + a matching-results line mirror the pair, the event log proves the
// timing. The control owns drag/keyboard/clamp/snap and the lo ≤ hi ordering guard (slider-multi.ts); this
// page stages, filters a small catalogue, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-slider-multi — demo',
  intro:
    'The two-thumb range, live: a price filter over a small headphone catalogue. Drag either thumb or focus one ' +
    'and use Arrow/Page/Home/End — input fires on every live change to valueLo or valueHi, change fires on ' +
    'blur once either moved; the thumbs can meet but never cross. The API table is on the ui-slider-multi API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

type RangeHost = HTMLElement & { valueLo: number; valueHi: number }

const CATALOGUE: readonly { name: string; price: number }[] = [
  { name: 'Aria Lite (on-ear)', price: 39 },
  { name: 'Aria Go (in-ear)', price: 59 },
  { name: 'Studio One', price: 129 },
  { name: 'Studio One ANC', price: 199 },
  { name: 'Reference 40', price: 249 },
  { name: 'Reference 60 Wireless', price: 329 },
  { name: 'Reference 80 Pro', price: 449 },
]
const money = (n: number): string => `$${n}`

// ── the event log ───────────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (kind: string, lo: number, hi: number): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${kind}  valueLo=${lo}  valueHi=${hi}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── the price filter — $0..$500, step 10, starting at $50–$300 ──────────────────────────────────────────
const price = el('ui-slider-multi', {
  id: 'price', name: 'price', label: 'Price', min: '0', max: '500', step: '10', 'value-lo': '50', 'value-hi': '300',
  'readout-hidden': '', // the page renders its own currency-formatted from–to readout below
}) as RangeHost
applyDemoWidth(price, '22rem')

const readout = el('output', { for: 'price', 'aria-live': 'polite' })
const results = el('ul', { style: 'margin:0.5rem 0 0; padding-inline-start:1.25rem;', 'aria-label': 'Matching products' })
const summary = el('p', { class: 'demo-caption', style: 'margin:0.25rem 0 0;' })
const refresh = (): void => {
  const lo = price.valueLo
  const hi = price.valueHi
  readout.textContent = `${money(lo)} – ${money(hi)}`
  const hits = CATALOGUE.filter((p) => p.price >= lo && p.price <= hi)
  results.replaceChildren(...hits.map((p) => el('li', {}, [text(`${p.name} — ${money(p.price)}`)])))
  summary.textContent = hits.length === 0 ? 'No products in this range.' : `${hits.length} of ${CATALOGUE.length} products`
}
price.addEventListener('input', () => { refresh(); record('input', price.valueLo, price.valueHi) })
price.addEventListener('change', () => record('change', price.valueLo, price.valueHi))

// A model-driven preset — writes both ends programmatically (the shape an agent's two-way bind takes); the
// page refreshes its own readout, and the log stays quiet: a programmatic write never emits.
const preset = uiButton('Preset: under $150 (model-driven)', 'soft')
preset.addEventListener('click', () => {
  price.valueLo = 0
  price.valueHi = 150
  refresh()
})
const filterNote = el('p', {}, [
  text('Step 10 — both thumbs snap to tens. The lo thumb cannot pass the hi thumb: they can meet at one value ' +
    'and part again. The preset writes '), code('valueLo'), text(' / '), code('valueHi'),
  text(' directly; the readout follows because the page re-reads them, and no event fires (binding hygiene).'),
])

// ── a second scenario — a working-hours window in the inline layout, with the control's OWN readout ──────
const hours = el('ui-slider-multi', {
  name: 'hours', label: 'Notify me between', min: '0', max: '24', step: '1', 'value-lo': '9', 'value-hi': '18',
  layout: 'inline',
}) as RangeHost
applyDemoWidth(hours, '26rem')
hours.addEventListener('input', () => record('hours input', hours.valueLo, hours.valueHi))
hours.addEventListener('change', () => record('hours change', hours.valueLo, hours.valueHi))
const hoursNote = el('p', {}, [
  code('layout="inline"'), text(' puts label · rail · the control\'s own "lo – hi" readout on one row.'),
])

// ── sizes — every parsed [size] tier ────────────────────────────────────────────────────────────────────
const sized = (size: string): HTMLElement => {
  const s = el('ui-slider-multi', { name: `size-${size}`, size, label: 'Range', 'value-lo': '20', 'value-hi': '70', 'readout-hidden': '' })
  applyDemoWidth(s, '12rem')
  return s
}
const sizeRow = el('div', { style: 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap;' }, [
  captioned('size="sm"', sized('sm')),
  captioned('size="md"', sized('md')),
  captioned('size="lg"', sized('lg')),
])

// ── disabled ───────────────────────────────────────────────────────────────────────────────────────────
const disabled = el('ui-slider-multi', { name: 'locked', label: 'Budget (set by plan)', 'value-lo': '100', 'value-hi': '400', min: '0', max: '500', disabled: '' })
applyDemoWidth(disabled, '18rem')

const keyboard = el('p', {}, [
  text('Tab reaches each thumb in turn. '), code('ArrowLeft/Right'), text(' or '), code('ArrowUp/Down'),
  text(' step the focused thumb, '), code('PageUp/PageDown'), text(' jump, '), code('Home/End'),
  text(' go to min/max (bounded by the other thumb). Each keystroke emits '), code('input'),
  text('; blurring the control after a net move emits one '), code('change'), text('.'),
])

refresh()
content.append(
  exampleSection('Price filter', price, readout, summary, results, preset, filterNote),
  exampleSection('Working hours (inline layout)', hours, hoursNote),
  exampleSection('input / change event log', log, keyboard),
  exampleSection('Sizes', sizeRow),
  exampleSection('Disabled', captioned('disabled', disabled)),
)
