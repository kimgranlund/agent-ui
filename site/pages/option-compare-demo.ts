// site/pages/option-compare-demo.ts: the ui-option-compare demo (T-0393; pairs with option-compare-doc.ts, the
// descriptor-derived API page). Mounts the real control over the approved Direction A mockup data
// (.sdlc/tickets/.0199-itinerary-compare/mockup/option-compare.html) on the A2UI canvas register (widget / md): the
// Lisbon to Porto legs with the best mark and the select and action events logged, the picked state set from
// outside, and four options in the 400px column scrolling inside the control with the label column pinned.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-option-compare: demo',
  intro:
    'The option compare, live: each option is one column over rows that align across options, and the whole ' +
    'column is the choice. A pick marks the column with the Your pick pill and fires select, then action when ' +
    'actionName is set. The API table is on the ui-option-compare API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

/** A canvas-register surface (widget / md), the register an A2UI surface renders the control at. */
const surface = (width: string, ...nodes: Node[]): HTMLElement => {
  const node = el('div', { 'data-tier': 'widget', 'data-scale': 'md', style: `max-inline-size:${width};` })
  node.append(...nodes)
  return node
}
const compare = (props: Record<string, unknown>): HTMLElement => {
  const node = el('ui-option-compare')
  Object.assign(node, { heading: 'Lisbon to Porto', best: 'train', rows: ROWS, ...props })
  return node
}

const ROWS = [
  { key: 'duration', label: 'Duration' },
  { key: 'price', label: 'Price' },
  { key: 'departs', label: 'Departs' },
  { key: 'changes', label: 'Changes' },
]
const LEGS = [
  { value: 'train', title: 'Train', subtitle: 'Alfa Pendular', values: { duration: '2h 50m', price: 'EUR 32', departs: '09:09', changes: 'None' } },
  { value: 'bus', title: 'Bus', subtitle: 'Rede Expressos', values: { duration: '3h 30m', price: 'EUR 19', departs: '08:30', changes: 'None' } },
  { value: 'flight', title: 'Flight', subtitle: 'TP 1940', values: { duration: '55m', price: 'EUR 89', departs: '11:15', changes: 'None' } },
]
const CAR = { value: 'car', title: 'Car', subtitle: 'Rental, A1', values: { duration: '3h 10m', price: 'EUR 64', departs: 'Any', changes: 'None' } }

// ── [1] Three options, the best marked, with the events logged ──────────────────────────────────────────
const picker = compare({ actionName: 'pick_leg', options: LEGS })
const log = el('pre', { class: 'event-log', 'aria-live': 'polite' }, [text('Pick a column.')])
for (const type of ['select', 'action']) {
  picker.addEventListener(type, (e) => {
    log.textContent = `${type} ${JSON.stringify((e as CustomEvent).detail)}\n${log.textContent === 'Pick a column.' ? '' : log.textContent}`
  })
}
const pickerNote = el('p', {}, [
  text('A click, Enter or Space on a column fires one '), code('select'), text(' with its value, then one '), code('action'),
  text(' because '), code('actionName'), text(' is set. '), code('best'), text(' marks the train with a Best pill and a ring.'),
])

// ── [2] The picked state, value set from outside ────────────────────────────────────────────────────────
const picked = compare({ value: 'bus', options: LEGS })
const pickedNote = el('p', {}, [
  code('value'), text(' was set from outside, so the Bus column is marked without a click. A second pick moves the mark.'),
])

// ── [3] Four options in the 400px column ────────────────────────────────────────────────────────────────
const four = compare({ options: [...LEGS, CAR] })
const fourNote = el('p', {}, [
  text('The fourth option scrolls inside the control; the label column stays pinned at the start while it scrolls.'),
])

content.append(
  exampleSection('Three options, the best marked', surface('32rem', picker), log, pickerNote),
  exampleSection('The picked state', surface('32rem', picked), pickedNote),
  exampleSection('Four options in the 400px column', surface('400px', four), fourNote),
)
